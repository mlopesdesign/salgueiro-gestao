const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  invoke: (canal, payload) => ipcRenderer.invoke('api', { canal, payload })
});
