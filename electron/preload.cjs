const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("airgallery", {
  nativeGlass: process.argv.includes("--airgallery-native-glass"),
  chooseDirectory: () => ipcRenderer.invoke("library:choose"),
  restoreDirectory: () => ipcRenderer.invoke("library:restore"),
  refreshDirectory: () => ipcRenderer.invoke("library:refresh"),
  setTheme: (dark) => ipcRenderer.invoke("appearance:set", dark),
  onLibraryChanged: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on("library:changed", listener);
    return () => ipcRenderer.removeListener("library:changed", listener);
  },
});
