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
  assert.equal(await evaluate('document.querySelectorAll("#mode-grid [role=radio]").length'), 3);
  assert.ok(await evaluate('getComputedStyle(document.body).backgroundColor !== "rgba(0, 0, 0, 0)"'));
  assert.equal(await evaluate('document.querySelector("#modifier").min'), '-100');
  assert.equal(await evaluate('document.querySelector("#modifier").max'), '100');
  assert.equal(await evaluate('document.querySelector("#quantity").max'), '1');
  assert.equal(await evaluate('document.querySelector("#quantity").readOnly'), true);
  assert.equal(await evaluate('document.querySelector("#sound-button").getAttribute("aria-pressed")'), 'true');
  assert.ok(await evaluate('document.querySelector("#reset-button").getBoundingClientRect().right <= window.innerWidth - 4'), 'A barra de ações ultrapassou a janela.');
  assert.ok(await evaluate('document.documentElement.scrollHeight <= window.innerHeight + 400'), 'A tela inicial ficou alta demais.');
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
  await waitFor('document.querySelector("#roll-badge").textContent === "VALOR BRUTO"');
  await waitFor('document.querySelector("#roll-badge").textContent.includes("BÔNUS 1/")');
  await waitFor('document.querySelectorAll("#history-list li").length === 1');
  assert.equal(await evaluate('document.querySelector("#reroll-button").disabled'), false);
  assert.ok(await evaluate('document.querySelector("#result-value").textContent.includes("Total:")'));
  assert.ok(await evaluate('document.querySelector("#result-meta").textContent.includes("CD: 1")'));
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
  for (const [dice, maximum] of [['d4', 12], ['d6', 12], ['d8', 12], ['d10', 4], ['d12', 4], ['d20', 1], ['d100', 1], ['dpercent', 1]]) {
    await evaluate(`document.querySelector('#dice-grid [data-value=${dice}]').click()`);
    await evaluate(`document.querySelector('#quantity').value = '${maximum}'; document.querySelector('#quantity').dispatchEvent(new Event('input'))`);
    assert.equal(await evaluate('document.querySelectorAll("#dice-labels .die-result-chip").length'), maximum);
    assert.equal(await evaluate('document.querySelector("#quantity").max'), String(maximum));
    await evaluate('document.querySelector("#roll-form button[type=submit]").click()');
    const expectedCount = 3 + ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100', 'dpercent'].indexOf(dice);
    await waitFor(`document.querySelectorAll('#history-list li').length === ${expectedCount}`);
    assert.equal(await evaluate('document.querySelectorAll("#dice-labels .die-result-chip[data-selected=true]").length'), maximum);
    assert.ok(await evaluate('document.querySelector("#result-value").textContent.includes("Total:")'));
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
  const flight = await client.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  await writeFile(path.join(folder, 'd20-flight.png'), Buffer.from(flight.data, 'base64'));
  await waitFor('document.querySelectorAll("#history-list li").length === 11');
  assert.ok(await evaluate('document.querySelector("#result-value").textContent.includes("Total:")'));
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
  await evaluate('document.querySelector("#roll-form button[type=submit]").click()');
  assert.ok(await evaluate('document.querySelector("#roll-form button[type=submit]").textContent.includes("Pular")'));
  await evaluate('document.querySelector("#reset-button").click()');
  await waitFor('document.querySelector("#roll-form button[type=submit]").textContent.includes("Rolar")');
  assert.equal(await evaluate('document.querySelectorAll("#history-list li").length'), 13);
  await evaluate('document.querySelector("#sound-button").click()');
  assert.equal(await evaluate('document.querySelector("#sound-button").getAttribute("aria-pressed")'), 'false');
  await evaluate('document.querySelector("#theme-button").click()');
  assert.equal(await evaluate('document.documentElement.dataset.theme'), 'light');
  await evaluate('document.querySelector("#reset-button").click()');
  assert.equal(await evaluate('document.querySelector("#reroll-button").disabled'), true);
  await evaluate('document.querySelector("#history-heading").click()');
  assert.equal(await evaluate('document.querySelector("#history-panel").open'), true);
  await evaluate('document.querySelector("#clear-history-button").click()');
  assert.equal(await evaluate('document.querySelectorAll("#history-list li").length'), 0);

  console.log(`Janela e interações validadas. Captura: ${image}`);
} finally {
  client?.close();
  child.kill();
}
