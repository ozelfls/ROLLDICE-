const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('diceFonts', {
  loadDragonFont: () => ipcRenderer.invoke('dice-font:dragon'),
});
