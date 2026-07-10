const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("bubbleAPI", {
  expand: () => ipcRenderer.send("bubble:expand"),
  move: (x, y) => ipcRenderer.send("bubble:move", { x, y }),
  contextMenu: () => ipcRenderer.send("bubble:context-menu"),
});
