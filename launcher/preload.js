// Secure bridge between the renderer (UI) and the Electron main process.
// Only these specific, validated calls are exposed — no Node access in the UI.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('oath', {
  getConfig: () => ipcRenderer.invoke('config:get'),
  setRealm: (host) => ipcRenderer.invoke('config:setRealm', host),
  pickWow: () => ipcRenderer.invoke('launcher:pickWow'),
  register: (username, password, pin) => ipcRenderer.invoke('account:register', { username, password, pin }),
  login: (username, password, pin) => ipcRenderer.invoke('account:login', { username, password, pin }),
  manifest: () => ipcRenderer.invoke('launcher:manifest'),
  checkUpdate: () => ipcRenderer.invoke('launcher:checkUpdate'),
  download: () => ipcRenderer.invoke('launcher:download'),
  play: () => ipcRenderer.invoke('launcher:play'),
  pickFolder: () => ipcRenderer.invoke('launcher:pickFolder'),
  installGame: (folder) => ipcRenderer.invoke('launcher:installGame', folder),
  isInstalled: () => ipcRenderer.invoke('launcher:isInstalled'),
  openExternal: (url) => ipcRenderer.invoke('open:external', url),
  onDownloadProgress: (cb) => ipcRenderer.on('download:progress', (_e, p) => cb(p)),
  onInstallProgress: (cb) => ipcRenderer.on('install:progress', (_e, p) => cb(p))
});
