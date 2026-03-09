const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // --- Metodos básicos sobre app ---
    getBackendUrl: () => ipcRenderer.invoke('get-backend-url'),

    // --- Metodos de SQLite Local ---
    getCotizaciones: (limit, skip) => ipcRenderer.invoke('cotizaciones:list', limit, skip),
    getCotizacion: (id) => ipcRenderer.invoke('cotizaciones:get', id),
    createCotizacion: (data) => ipcRenderer.invoke('cotizaciones:create', data),
    updateCotizacion: (id, data) => ipcRenderer.invoke('cotizaciones:update', id, data),
    deleteCotizacion: (id) => ipcRenderer.invoke('cotizaciones:delete', id),

    // --- PDFs y Ficheros ---
    generarPDF: (id, options) => ipcRenderer.invoke('cotizaciones:pdf', id, options),
    openExternal: (url) => ipcRenderer.invoke('open-external', url),
    getPdfPath: (numero) => ipcRenderer.invoke('get-pdf-path', numero),
    getPdfFolder: () => ipcRenderer.invoke('get-pdf-folder'),
    selectPdfFolder: () => ipcRenderer.invoke('select-pdf-folder'),
});

// Compatibilidad: algunos componentes usan `window.api` en vez de `window.electronAPI`.
// Exponemos un alias mínimo para evitar errores "cannot read properties of undefined".
contextBridge.exposeInMainWorld('api', {
    getBackendUrl: () => ipcRenderer.invoke('get-backend-url'),
    getCotizaciones: (limit, skip) => ipcRenderer.invoke('cotizaciones:list', limit, skip),
    getCotizacion: (id) => ipcRenderer.invoke('cotizaciones:get', id),
    createCotizacion: (data) => ipcRenderer.invoke('cotizaciones:create', data),
    updateCotizacion: (id, data) => ipcRenderer.invoke('cotizaciones:update', id, data),
    deleteCotizacion: (id) => ipcRenderer.invoke('cotizaciones:delete', id),
    generarPDF: (id, options) => ipcRenderer.invoke('cotizaciones:pdf', id, options),
    openExternal: (url) => ipcRenderer.invoke('open-external', url),
    getPdfPath: (numero) => ipcRenderer.invoke('get-pdf-path', numero),
    getPdfFolder: () => ipcRenderer.invoke('get-pdf-folder'),
    selectPdfFolder: () => ipcRenderer.invoke('select-pdf-folder'),
});
