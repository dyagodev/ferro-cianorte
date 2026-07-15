const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: true,
  minimizeToBubble: () => ipcRenderer.send("app:minimize-to-bubble"),
  toggleMaximize: () => ipcRenderer.send("app:toggle-maximize"),
  platform: () => ipcRenderer.invoke("app:platform"),
  imprimirSilencioso: () => ipcRenderer.invoke("app:print-silent"),
});
