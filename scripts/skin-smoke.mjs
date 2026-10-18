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
const server = createServer();
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
server.close();
const child = spawn(electron, ['.', `--remote-debugging-port=${port}`, '--remote-debugging-address=127.0.0.1'], { cwd: root, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
let stderr = '';
child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
let socket;

try {
  let target;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (child.exitCode !== null) throw new Error(`Electron encerrou: ${stderr}`);
    try {
      const pages = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json());
      target = pages.find((page) => page.type === 'page' && page.url.includes('index.html'));
      if (target) break;
    } catch {}
    await delay(250);
  }
  assert.ok(target, `Janela indisponível: ${stderr}`);
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  let nextId = 0;
  const pending = new Map();
  socket.addEventListener('message', ({ data }) => {
    const response = JSON.parse(data);
    if (!pending.has(response.id)) return;
    const { resolve, reject } = pending.get(response.id);
    pending.delete(response.id);
    if (response.error) reject(new Error(response.error.message));
    else resolve(response.result);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId;
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`${method} demorou demais.`)); }, 12000);
    pending.set(id, { resolve: (value) => { clearTimeout(timeout); resolve(value); }, reject: (error) => { clearTimeout(timeout); reject(error); } });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => {
    const response = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.text);
    return response.result.value;
  };
  const waitFor = async (expression) => {
    for (let attempt = 0; attempt < 300; attempt++) {
      if (await evaluate(expression)) return;
      await delay(100);
    }
    throw new Error(`Estado não alcançado: ${expression}; ${await evaluate('JSON.stringify({error: document.querySelector("#form-error").textContent, result: document.querySelector("#result-value").textContent, button: document.querySelector("#roll-form button[type=submit]").textContent})')}`);
  };
  await waitFor('document.querySelectorAll("#skin-menu [role=menuitemradio]").length === 4');
  const folder = await mkdtemp(path.join(os.tmpdir(), 'dice-skins-'));
  const captured = new Map();
  for (const skin of ['classic', 'scuffed', 'behir', 'dragonflame']) {
    await evaluate(`document.querySelector('#skin-trigger').click(); document.querySelector('#skin-menu [data-value=${skin}]').click()`);
    await delay(450);
    const clip = await evaluate('(() => { const { x, y, width, height } = document.querySelector("#dice-stage").getBoundingClientRect(); return { x, y, width, height, scale: 1 }; })()');
    const image = (await send('Page.captureScreenshot', { format: 'png', clip })).data;
    captured.set(skin, image);
    await writeFile(path.join(folder, `${skin}.png`), Buffer.from(image, 'base64'));
  }
  assert.equal(new Set(captured.values()).size, 4);
  assert.equal(await evaluate(`document.fonts.check('700 24px "Caudex Bold"')`), true);
  const dragonFamily = await evaluate('window.diceFonts.loadDragonFont().then((font) => font.family)');
  assert.ok(['Trajan Pro Bold', 'Palatino Linotype Bold', 'Times New Roman Bold'].includes(dragonFamily));
  await evaluate('document.querySelector("#skin-trigger").click(); document.querySelector("#skin-menu [data-value=classic]").click()');
  await evaluate('document.querySelector("#mode-grid [data-value=normal]").click()');
  await evaluate('window.__previousRandom = Math.random; Math.random = () => .999999; document.querySelector("#roll-form button[type=submit]").click(); Math.random = window.__previousRandom; delete window.__previousRandom');
  await waitFor('document.querySelectorAll("#history-list li").length === 1');
  assert.match(await evaluate('document.querySelector("#result-value").textContent'), /^D20: 20 • Total: /);
  const rolled = (await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })).data;
  await writeFile(path.join(folder, 'lightning-rolled.png'), Buffer.from(rolled, 'base64'));
  await evaluate('window.__previousRandom = Math.random; Math.random = () => .875; document.querySelector("#roll-form button[type=submit]").click(); Math.random = window.__previousRandom; delete window.__previousRandom');
  await waitFor('document.querySelectorAll("#history-list li").length === 2');
  assert.match(await evaluate('document.querySelector("#result-value").textContent'), /^D20: 18 . Total: /);
  const eighteen = (await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })).data;
  await writeFile(path.join(folder, 'lightning-18.png'), Buffer.from(eighteen, 'base64'));
  for (const [index, skin] of ['scuffed', 'behir', 'dragonflame'].entries()) {
    await evaluate(`document.querySelector('#skin-trigger').click(); document.querySelector('#skin-menu [data-value=${skin}]').click()`);
    await delay(450);
    await evaluate('window.__previousRandom = Math.random; Math.random = () => .875; document.querySelector("#roll-form button[type=submit]").click(); Math.random = window.__previousRandom; delete window.__previousRandom');
    await waitFor(`document.querySelectorAll("#history-list li").length === ${index + 3}`);
    assert.match(await evaluate('document.querySelector("#result-value").textContent'), /^D20: 18 . Total: /);
    const image = (await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })).data;
    await writeFile(path.join(folder, `${skin}-18.png`), Buffer.from(image, 'base64'));
  }
  if (process.argv.includes('--audit-numbers')) {
    let historyCount = 5;
    for (const skin of ['behir', 'dragonflame']) {
      await evaluate(`document.querySelector('#skin-trigger').click(); document.querySelector('#skin-menu [data-value=${skin}]').click()`);
      await delay(450);
      for (let value = 1; value <= 20; value++) {
        await evaluate(`window.__previousRandom = Math.random; Math.random = () => ${(value - .5) / 20}; document.querySelector('#roll-form button[type=submit]').click(); Math.random = window.__previousRandom; delete window.__previousRandom; document.querySelector('#roll-form button[type=submit]').click()`);
        historyCount++;
        await waitFor(`document.querySelectorAll("#history-list li").length === ${historyCount}`);
        const clip = await evaluate('(() => { const { x, y, width, height } = document.querySelector("#dice-stage").getBoundingClientRect(); return { x, y, width, height, scale: 1 }; })()');
        const image = (await send('Page.captureScreenshot', { format: 'png', clip })).data;
        await writeFile(path.join(folder, `${skin}-${String(value).padStart(2, '0')}.png`), Buffer.from(image, 'base64'));
      }
    }
  }
  console.log(`Skins e D20 validados. Fonte Dragonflame: ${dragonFamily}. Capturas: ${folder}`);
} finally {
  socket?.close();
  child.kill();
}
