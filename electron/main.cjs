const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');

ipcMain.handle('dice-font:dragon', async () => {
  const projectFonts = path.join(__dirname, '..', 'assets', 'fonts');
  const systemFonts = process.platform === 'win32' ? path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts') : '/Library/Fonts';
  const installedTrajan = (await fs.readdir(systemFonts).catch(() => [])).filter((name) => /trajan.*(?:bold|bd).*\.(?:otf|ttf)$/i.test(name));
  const candidates = [
    ['Trajan Pro Bold', path.join(projectFonts, 'TrajanPro-Bold.otf')],
    ['Trajan Pro Bold', path.join(projectFonts, 'TrajanPro-Bold.ttf')],
    ...installedTrajan.map((name) => ['Trajan Pro Bold', path.join(systemFonts, name)]),
    ['Palatino Linotype Bold', path.join(systemFonts, 'palab.ttf')],
    ['Times New Roman Bold', path.join(systemFonts, process.platform === 'win32' ? 'timesbd.ttf' : 'Times New Roman Bold.ttf')],
  ];
  for (const [family, file] of candidates) {
    try { return { family, data: await fs.readFile(file) }; } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  throw new Error('Nenhuma fonte Dragonflame disponível.');
});

function createWindow() {
  const window = new BrowserWindow({
    width: 650,
    height: 850,
    minWidth: 500,
    minHeight: 640,
    backgroundColor: '#12191c',
    title: 'Dado RPG',
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  window.loadFile(path.join(__dirname, '..', 'src', 'index.html'));
  window.once('ready-to-show', () => window.show());
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
