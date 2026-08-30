const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('jobSecretary', {
  storage: {
    get: (key) => ipcRenderer.invoke('storage:get', key),
    set: (key, value) => ipcRenderer.invoke('storage:set', key, value),
    backup: () => ipcRenderer.invoke('storage:backup'),
    restore: () => ipcRenderer.invoke('storage:restore'),
  },
  jobs: {
    search: (request) => ipcRenderer.invoke('jobs:search', request),
    addSource: (source) => ipcRenderer.invoke('jobs:add-source', source),
  },
  advisor: {
    run: (task, payload) => ipcRenderer.invoke('advisor:run', task, payload),
  },
  documents: {
    importDocx: () => ipcRenderer.invoke('documents:import-docx'),
    exportDocx: (resume) => ipcRenderer.invoke('documents:export-docx', resume),
  },
  system: {
    openExternal: (url) => ipcRenderer.invoke('system:open-external', url),
    info: () => ipcRenderer.invoke('system:info'),
  },
});
