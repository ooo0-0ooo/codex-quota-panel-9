const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('codexWidget', {
  hide: () => ipcRenderer.invoke('window:hide'),
  minimize: () => ipcRenderer.invoke('window:minimize'),
  quit: () => ipcRenderer.invoke('window:quit'),
  getAlwaysOnTop: () => ipcRenderer.invoke('window:get-always-on-top'),
  setAlwaysOnTop: (value) => ipcRenderer.invoke('window:set-always-on-top', value),
  setContentHeight: (height) => ipcRenderer.invoke('window:set-content-height', height),
  getCodexData: () => ipcRenderer.invoke('codex:get-data'),
  consumeResetCredit: (creditId) => ipcRenderer.invoke('codex:consume-reset-credit', creditId),
});
