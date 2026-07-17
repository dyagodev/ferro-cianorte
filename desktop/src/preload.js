const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: true,
  minimizeToBubble: () => ipcRenderer.send("app:minimize-to-bubble"),
  toggleMaximize: () => ipcRenderer.send("app:toggle-maximize"),
  platform: () => ipcRenderer.invoke("app:platform"),
  imprimirSilencioso: () => ipcRenderer.invoke("app:print-silent"),
  versaoApp: () => ipcRenderer.invoke("app:versao"),
  verificarAtualizacao: () => ipcRenderer.invoke("app:verificar-atualizacao"),
  instalarAtualizacao: () => ipcRenderer.invoke("app:instalar-atualizacao"),
  onStatusAtualizacao: (callback) => {
    const listener = (_event, status) => callback(status);
    ipcRenderer.on("update:status", listener);
    return () => ipcRenderer.removeListener("update:status", listener);
  },
});
