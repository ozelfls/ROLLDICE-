import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import electron from 'electron';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function availablePort() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function connect(url) {
  const socket = new WebSocket(url);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  let nextId = 0;
  const waiting = new Map();
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (!message.id || !waiting.has(message.id)) return;
    const { resolve, reject } = waiting.get(message.id);
    waiting.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  });
  return {
    send(method, params = {}) {
      const id = ++nextId;
      return new Promise((resolve, reject) => {
        waiting.set(id, { resolve, reject });
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
    close() { socket.close(); },
  };
}

const port = await availablePort();
const child = spawn(electron, ['.', `--remote-debugging-port=${port}`, '--remote-debugging-address=127.0.0.1'], {
  cwd: root,
  windowsHide: true,
  stdio: ['ignore', 'ignore', 'pipe'],
});
let stderr = '';
child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
let client;

try {
  let target;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (child.exitCode !== null) throw new Error(`Electron encerrou cedo: ${stderr}`);
    try {
      const pages = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json());
      target = pages.find((page) => page.type === 'page' && page.title === 'Dado RPG');
      if (target) break;
    } catch {}
    await delay(250);
  }
  assert.ok(target, `Janela não abriu em 15 segundos. ${stderr}`);
  client = await connect(target.webSocketDebuggerUrl);
  const evaluate = async (expression) => {
    const response = await client.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.text);
    return response.result.value;
  };
  const waitFor = async (expression) => {
    for (let attempt = 0; attempt < 150; attempt++) {
      if (await evaluate(expression)) return;
      await delay(100);
    }
    const status = await evaluate('({ badge: document.querySelector("#roll-badge").textContent, error: document.querySelector("#form-error").textContent, history: document.querySelectorAll("#history-list li").length, button: document.querySelector("#roll-form button[type=submit]").textContent })');
    throw new Error(`A interface não terminou: ${expression} ${JSON.stringify(status)}`);
  };
  const folder = await mkdtemp(path.join(os.tmpdir(), 'dado-rpg-'));

  await waitFor('document.querySelectorAll("#dice-grid [role=radio]").length === 8');
  assert.equal(await evaluate('document.querySelectorAll("#dice-grid [role=radio]").length'), 8, stderr);
  assert.equal(await evaluate('document.querySelectorAll("#skin-menu [role=menuitemradio]").length'), 4);
  assert.equal(await evaluate('document.querySelector("#dice-stage").dataset.skin'), 'classic');
  assert.equal(await evaluate('document.fonts.check(\'700 24px "Cinzel Bold"\')'), true);
  const resultPalette = await evaluate('({ panel: getComputedStyle(document.querySelector(".result-panel")).backgroundColor, badge: getComputedStyle(document.querySelector("#roll-badge")).backgroundColor, main: getComputedStyle(document.querySelector("#result-value")).color, secondary: getComputedStyle(document.querySelector("#result-meta")).color, stage: getComputedStyle(document.querySelector("#dice-stage canvas")).backgroundImage })');
  assert.equal(resultPalette.panel, 'rgb(247, 127, 94)');
  assert.equal(resultPalette.badge, 'rgb(230, 116, 84)');
  assert.equal(resultPalette.main, 'rgb(58, 33, 28)');
  assert.equal(resultPalette.secondary, 'rgb(92, 60, 52)');
  assert.ok(resultPalette.stage.includes('rgb(248, 160, 132)') && resultPalette.stage.includes('rgb(244, 136, 110)'));
  const chooseSkin = async (skin) => {
    await evaluate('document.querySelector("#skin-trigger").click()');
    assert.equal(await evaluate('document.querySelector("#skin-menu").hidden'), false);
    const colors = await evaluate('({ background: getComputedStyle(document.querySelector("#skin-menu")).backgroundColor, text: getComputedStyle(document.querySelector("#skin-menu [role=menuitemradio]")).color })');
    assert.notEqual(colors.background, colors.text, 'As opções de skin estão invisíveis.');
    await evaluate(`document.querySelector('#skin-menu [data-value=${skin}]').click()`);
    assert.equal(await evaluate('document.querySelector("#skin-menu").hidden'), true);
    assert.equal(await evaluate('document.querySelector("#dice-stage").dataset.skin'), skin);
    await evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
  };
  await evaluate('document.querySelector("#skin-trigger").click()');
  const skinMenuShot = await client.send('Page.captureScreenshot', { format: 'png' });
  await writeFile(path.join(folder, 'skin-menu-dark.png'), Buffer.from(skinMenuShot.data, 'base64'));
  assert.equal(await evaluate('document.querySelector("#skin-menu").hidden'), false);
  await evaluate('document.querySelector("#skin-trigger").click()');
  const stageClip = await evaluate('(() => { const { x, y, width, height } = document.querySelector("#dice-stage").getBoundingClientRect(); return { x, y, width, height, scale: 1 }; })()');
  let previousSkinImage = (await client.send('Page.captureScreenshot', { format: 'png', clip: stageClip })).data;
  assert.equal(await evaluate('document.querySelector("#skin-trigger-label").textContent'), 'Lightning Storm');
  assert.equal(await evaluate(`document.fonts.check('700 24px "Caudex Bold"')`), true);
  assert.ok(['Trajan Pro Bold', 'Palatino Linotype Bold', 'Times New Roman Bold'].includes(await evaluate('window.diceFonts.loadDragonFont().then((font) => font.family)')));
  await writeFile(path.join(folder, 'skin-lightning.png'), Buffer.from(previousSkinImage, 'base64'));
  let behirImage;
  for (const skin of ['scuffed', 'behir', 'dragonflame']) {
    await chooseSkin(skin);
    assert.equal(await evaluate('document.querySelector("#skin-trigger-label").textContent'), { scuffed: 'Scuffed Metal', behir: 'Behir Blue', dragonflame: 'Dragonflame Red' }[skin]);
    const capture = (await client.send('Page.captureScreenshot', { format: 'png', clip: stageClip })).data;
    assert.notEqual(capture, previousSkinImage, `${skin} não mudou a aparência do dado.`);
    await writeFile(path.join(folder, `skin-${skin}.png`), Buffer.from(capture, 'base64'));
    if (skin === 'behir') behirImage = capture;
    previousSkinImage = capture;
  }
  await chooseSkin('behir');
  const restoredBehirImage = (await client.send('Page.captureScreenshot', { format: 'png', clip: stageClip })).data;
  await writeFile(path.join(folder, 'skin-behir-restored.png'), Buffer.from(restoredBehirImage, 'base64'));
  assert.ok(restoredBehirImage === behirImage, 'A aparência azul mudou após selecionar a Dragonflame Red.');
  await chooseSkin('classic');
  assert.equal(await evaluate('document.querySelectorAll("#mode-grid [role=radio]").length'), 3);
  assert.ok(await evaluate('getComputedStyle(document.body).backgroundColor !== "rgba(0, 0, 0, 0)"'));
  assert.equal(await evaluate('document.querySelector("#modifier").min'), '-100');
  assert.equal(await evaluate('document.querySelector("#modifier").max'), '100');
  assert.equal(await evaluate('document.querySelector("#quantity").max'), '1');
  assert.equal(await evaluate('document.querySelector("#quantity").readOnly'), true);
  assert.ok(await evaluate('document.querySelector("#reset-button").getBoundingClientRect().right <= window.innerWidth - 4'), 'A barra de ações ultrapassou a janela.');
  const layout = await evaluate('({ scroll: document.documentElement.scrollHeight, viewport: window.innerHeight })');
  assert.ok(layout.scroll <= layout.viewport + 400, `A tela inicial ficou alta demais: ${JSON.stringify(layout)}`);
  assert.equal(await evaluate('document.querySelector("#history-panel").open'), false);
  await evaluate('document.querySelector("#dice-grid [data-value=d4]").click()');
  assert.equal(await evaluate('document.querySelector("#quantity").max'), '12');
  await evaluate('document.querySelector("#quantity").value = "12"');
  await evaluate('document.querySelector("#dice-grid [data-value=d10]").click()');
  assert.equal(await evaluate('document.querySelector("#quantity").value'), '4');
  await evaluate('document.querySelector("#dice-grid [data-value=d100]").click()');
  assert.equal(await evaluate('document.querySelector("#quantity").value'), '1');
  assert.equal(await evaluate('document.querySelector("#quantity-plus").disabled'), true);
  await evaluate('document.querySelector("#dice-grid [data-value=dpercent]").click()');
  assert.equal(await evaluate('document.querySelector("#quantity").max'), '1');
  await evaluate('document.querySelector("#dice-grid [data-value=d6]").click()');
  assert.equal(await evaluate('document.querySelector("#quantity").max'), '12');
  await evaluate('document.querySelector("#mode-grid [data-value=vantagem]").click()');
  await evaluate('document.querySelector("#quantity").value = "2"');
  await evaluate('document.querySelector("#modifier").value = "3"');
  await evaluate('document.querySelector("#bonuses").value = "+2"');
  await evaluate('document.querySelector("#difficulty").value = "1"');
  await evaluate('document.querySelector("#roll-form button[type=submit]").click()');
  assert.ok(await evaluate('document.querySelector("#roll-form button[type=submit]").textContent.includes("Pular")'));
  assert.equal(await evaluate('document.querySelector("#skin-trigger").disabled'), true);
  await waitFor('document.querySelector("#roll-badge").textContent === "VALOR BRUTO"');
  await waitFor('document.querySelector("#roll-badge").textContent.includes("BÔNUS 1/")');
  await waitFor('document.querySelectorAll("#history-list li").length === 1');
  assert.equal(await evaluate('document.querySelector("#skin-trigger").disabled'), false);
  assert.equal(await evaluate('document.querySelector("#reroll-button").disabled'), false);
  assert.ok(await evaluate('document.querySelector("#result-value").textContent.includes("Total:")'));
  assert.ok(await evaluate('document.querySelector("#result-meta").textContent.includes("CD: 1")'));
  const previousResult = await evaluate('document.querySelector("#result-value").textContent');
  const previousDice = await evaluate('document.querySelector("#dice-labels").textContent');
  await chooseSkin('dragonflame');
  assert.equal(await evaluate('document.querySelector("#result-value").textContent'), previousResult);
  assert.equal(await evaluate('document.querySelector("#dice-labels").textContent'), previousDice);
  await evaluate('document.querySelector("#reroll-button").click()');
  await waitFor('document.querySelectorAll("#history-list li").length === 2');
  assert.ok(await evaluate('document.querySelector("#result-meta").textContent.includes("rerrolagem")'));
  await evaluate('document.querySelector("#quantity").value = "0"');
  await evaluate('document.querySelector("#roll-form button[type=submit]").click()');
  assert.equal(await evaluate('document.querySelectorAll("#history-list li").length'), 2);
  assert.equal(await evaluate('document.querySelector("#form-error").hidden'), false);
  await evaluate('document.querySelector("#quantity").value = "13"');
  await evaluate('document.querySelector("#roll-form button[type=submit]").click()');
  assert.equal(await evaluate('document.querySelectorAll("#history-list li").length'), 2);
  assert.ok(await evaluate('document.querySelector("#form-error").textContent.includes("1 e 12")'));
  await chooseSkin('dragonflame');
  await evaluate('document.querySelector("#dice-grid [data-value=d100]").click()');
  const redHundred = await client.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  await writeFile(path.join(folder, 'd100-dragonflame.png'), Buffer.from(redHundred.data, 'base64'));
  for (const [index, [dice, maximum]] of [['d4', 12], ['d6', 12], ['d8', 12], ['d10', 4], ['d12', 4], ['d20', 1], ['d100', 1], ['dpercent', 1]].entries()) {
    const skin = dice === 'd20' ? 'scuffed' : ['scuffed', 'behir', 'dragonflame'][index % 3];
    await chooseSkin(skin);
    await evaluate(`document.querySelector('#dice-grid [data-value=${dice}]').click()`);
    await evaluate(`document.querySelector('#quantity').value = '${maximum}'; document.querySelector('#quantity').dispatchEvent(new Event('input'))`);
    assert.equal(await evaluate('document.querySelectorAll("#dice-labels .die-result-chip").length'), maximum);
    assert.equal(await evaluate('document.querySelector("#quantity").max'), String(maximum));
    if (dice === 'd20') await evaluate('window.__previousRandom = Math.random; Math.random = () => .999999');
    await evaluate('document.querySelector("#roll-form button[type=submit]").click()');
    if (dice === 'd20') await evaluate('Math.random = window.__previousRandom; delete window.__previousRandom');
    const expectedCount = 3 + ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100', 'dpercent'].indexOf(dice);
    await waitFor(`document.querySelectorAll('#history-list li').length === ${expectedCount}`);
    assert.equal(await evaluate('document.querySelectorAll("#dice-labels .die-result-chip[data-selected=true]").length'), maximum);
    assert.ok(await evaluate('document.querySelector("#result-value").textContent.includes("Total:")'));
    if (dice === 'd20') {
      assert.match(await evaluate('document.querySelector("#result-value").textContent'), /^D20: 20 • Total: /);
      const metalHighlight = await evaluate('({ background: getComputedStyle(document.querySelector("#dice-labels .die-result-chip[data-selected=true]")).backgroundColor, text: getComputedStyle(document.querySelector("#dice-labels .die-result-chip[data-selected=true]")).color })');
      assert.deepEqual(metalHighlight, { background: 'rgb(208, 180, 134)', text: 'rgb(45, 37, 34)' });
      const capture = await client.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
      await writeFile(path.join(folder, 'd20-scuffed.png'), Buffer.from(capture.data, 'base64'));
    }
    if (dice === 'd4' || dice === 'd100') {
      const capture = await client.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
      await writeFile(path.join(folder, `${dice}.png`), Buffer.from(capture.data, 'base64'));
    }
  }
  await evaluate('document.querySelector("#dice-grid [data-value=d20]").click()');
  assert.equal(await evaluate('document.querySelectorAll("#dice-stage canvas").length'), 1);
  await evaluate('document.querySelector("#mode-grid [data-value=normal]").click()');
  await evaluate('document.querySelector("#roll-form button[type=submit]").click()');
  assert.ok(await evaluate('document.querySelector("#roll-form button[type=submit]").textContent.includes("Pular")'));
  await delay(650);
  assert.equal(await evaluate('document.querySelectorAll("#dice-labels .die-result-chip").length'), 0);
  assert.ok(await evaluate('document.querySelector("#result-meta").textContent.includes("lançamento em andamento")'));
  assert.ok(await evaluate('document.querySelector("#dice-stage canvas").style.filter.startsWith("blur(")'));
  const flight = await client.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  await writeFile(path.join(folder, 'd20-flight.png'), Buffer.from(flight.data, 'base64'));
  await waitFor('document.querySelectorAll("#history-list li").length === 11');
  assert.ok(await evaluate('document.querySelector("#result-value").textContent.includes("Total:")'));
  assert.match(await evaluate('document.querySelector("#result-value").textContent'), /^D20: (?:[1-9]|1\d|20) • Total: -?\d+$/);
  assert.match(await evaluate('document.querySelector("#result-meta").textContent'), /^Subtotal: \d+ • Modificador: \+3 • Bônus: \+2 • CD: 1 • normal$/);
  assert.equal(await evaluate('document.querySelector("#dice-stage canvas").style.filter'), '');
  assert.equal(await evaluate('document.querySelectorAll("#dice-labels .die-result-chip").length'), 1);
  await evaluate('document.querySelector("#mode-grid [data-value=vantagem]").click()');
  assert.equal(await evaluate('document.querySelectorAll("#dice-labels .die-result-chip").length'), 1);
  await evaluate('document.querySelector("#roll-form button[type=submit]").click()');
  await waitFor('document.querySelectorAll("#history-list li").length === 12');
  assert.ok(await evaluate('document.querySelector("#dice-labels").textContent.includes("→")'));
  const screenshot = await client.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  const image = path.join(folder, 'desktop-smoke.png');
  await writeFile(image, Buffer.from(screenshot.data, 'base64'));
  await evaluate('document.querySelector("#roll-form button[type=submit]").click()');
  assert.ok(await evaluate('document.querySelector("#roll-form button[type=submit]").textContent.includes("Pular")'));
  await evaluate('document.querySelector("#roll-form button[type=submit]").click()');
  await waitFor('document.querySelectorAll("#history-list li").length === 13');
  assert.ok(await evaluate('document.querySelector("#result-value").textContent.includes("Total:")'));
  assert.equal(await evaluate('document.querySelector("#dice-stage canvas").style.filter'), '');
  await evaluate('document.querySelector("#roll-form button[type=submit]").click()');
  assert.ok(await evaluate('document.querySelector("#roll-form button[type=submit]").textContent.includes("Pular")'));
  await evaluate('document.querySelector("#reset-button").click()');
  await waitFor('document.querySelector("#roll-form button[type=submit]").textContent.includes("Rolar")');
  assert.equal(await evaluate('document.querySelectorAll("#history-list li").length'), 13);
  await evaluate('document.querySelector("#theme-button").click()');
  assert.equal(await evaluate('document.documentElement.dataset.theme'), 'light');
  await evaluate('document.querySelector("#reset-button").click()');
  assert.equal(await evaluate('document.querySelector("#reroll-button").disabled'), true);
  await evaluate('document.querySelector("#history-heading").click()');
  assert.equal(await evaluate('document.querySelector("#history-panel").open'), true);
  await evaluate('document.querySelector("#clear-history-button").click()');
  assert.equal(await evaluate('document.querySelectorAll("#history-list li").length'), 0);
  await chooseSkin('behir');
  await evaluate('document.querySelector("#dice-grid [data-value=d20]").click()');
  await evaluate('window.__previousRandom = Math.random; Math.random = () => .999999');
  await evaluate('document.querySelector("#roll-form button[type=submit]").click()');
  await evaluate('Math.random = window.__previousRandom; delete window.__previousRandom');
  await waitFor('document.querySelectorAll("#history-list li").length === 1');
  assert.match(await evaluate('document.querySelector("#result-value").textContent'), /^D20: 20 • Total: /);
  const blueTwenty = await client.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  await writeFile(path.join(folder, 'd20-behir.png'), Buffer.from(blueTwenty.data, 'base64'));

  await chooseSkin('classic');
  assert.equal(await evaluate(`document.fonts.check('700 24px "Rajdhani Bold"')`), true);
  await evaluate('window.__previousRandom = Math.random; Math.random = () => .999999');
  await evaluate('document.querySelector("#roll-form button[type=submit]").click()');
  await evaluate('Math.random = window.__previousRandom; delete window.__previousRandom');
  await waitFor('document.querySelectorAll("#history-list li").length === 2');
  assert.match(await evaluate('document.querySelector("#result-value").textContent'), /^D20: 20 • Total: /);
  assert.equal(await evaluate('document.querySelectorAll("#dice-labels .die-result-chip[data-selected=true]").length'), 1);
  const lightningTwenty = await client.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  await writeFile(path.join(folder, 'd20-lightning.png'), Buffer.from(lightningTwenty.data, 'base64'));

  console.log(`Janela e interações validadas. Captura: ${image}`);
} finally {
  client?.close();
  child.kill();
}
