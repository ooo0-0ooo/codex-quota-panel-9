const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('codexWidget', {
  hide: () => ipcRenderer.invoke('window:hide'),
  quit: () => ipcRenderer.invoke('window:quit'),
  getAlwaysOnTop: () => ipcRenderer.invoke('window:get-always-on-top'),
  setAlwaysOnTop: (value) => ipcRenderer.invoke('window:set-always-on-top', value),
  getCodexData: () => ipcRenderer.invoke('codex:get-data'),
});
