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
    } catch { /* O servidor de depuração ainda está iniciando. */ }
    await delay(250);
  }
  assert.ok(target, `Janela não abriu em 15 segundos. ${stderr}`);
  client = await connect(target.webSocketDebuggerUrl);
  const evaluate = async (expression) => {
    const response = await client.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.text);
    return response.result.value;
  };

  assert.equal(await evaluate('document.querySelectorAll("#dice-grid [role=radio]").length'), 8);
  assert.equal(await evaluate('document.querySelectorAll("#mode-grid [role=radio]").length'), 3);
  assert.ok(await evaluate('getComputedStyle(document.body).backgroundColor !== "rgba(0, 0, 0, 0)"'));
  assert.ok(await evaluate('document.querySelector("#reset-button").getBoundingClientRect().right <= window.innerWidth - 4'), 'A barra de ações ultrapassou a janela.');
  assert.ok(await evaluate('document.documentElement.scrollHeight <= window.innerHeight + 180'), 'A tela inicial ficou alta demais.');
  assert.equal(await evaluate('document.querySelector("#history-panel").open'), false);
  await evaluate('document.querySelector("#dice-grid [data-value=d6]").click()');
  await evaluate('document.querySelector("#mode-grid [data-value=vantagem]").click()');
  await evaluate('document.querySelector("#quantity").value = "2"');
  await evaluate('document.querySelector("#modifier").value = "3"');
  await evaluate('document.querySelector("#roll-form button[type=submit]").click()');
  assert.equal(await evaluate('document.querySelectorAll("#history-list li").length'), 1);
  assert.equal(await evaluate('document.querySelector("#reroll-button").disabled'), false);
  assert.ok(await evaluate('document.querySelector("#result-value").textContent.includes(" = ")'));
  await evaluate('document.querySelector("#reroll-button").click()');
  assert.equal(await evaluate('document.querySelectorAll("#history-list li").length'), 2);
  assert.ok(await evaluate('document.querySelector("#result-value").textContent.startsWith("Rerol (Desvantagem):")'));
  await evaluate('document.querySelector("#quantity").value = "0"');
  await evaluate('document.querySelector("#roll-form button[type=submit]").click()');
  assert.equal(await evaluate('document.querySelectorAll("#history-list li").length'), 2);
  assert.equal(await evaluate('document.querySelector("#form-error").hidden'), false);
  await evaluate('document.querySelector("#quantity").value = "2"');
  const screenshot = await client.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  const folder = await mkdtemp(path.join(os.tmpdir(), 'dado-rpg-'));
  const image = path.join(folder, 'desktop-smoke.png');
  await writeFile(image, Buffer.from(screenshot.data, 'base64'));
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
