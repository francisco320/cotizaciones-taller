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

    // --- Metodos de Clientes ---
    getClientes: (searchTerm) => ipcRenderer.invoke('clientes:list', searchTerm),
    getCliente: (id) => ipcRenderer.invoke('clientes:get', id),
    createCliente: (data) => ipcRenderer.invoke('clientes:create', data),
    updateCliente: (id, data) => ipcRenderer.invoke('clientes:update', id, data),
    deleteCliente: (id) => ipcRenderer.invoke('clientes:delete', id),

    // --- Metodos de Inventario ---
    getInventory: (searchTerm) => ipcRenderer.invoke('inventory:list', searchTerm),
    getProduct: (id) => ipcRenderer.invoke('inventory:get', id),
    createProduct: (data) => ipcRenderer.invoke('inventory:create', data),
    updateProduct: (id, data) => ipcRenderer.invoke('inventory:update', id, data),
    deleteProduct: (id) => ipcRenderer.invoke('inventory:delete', id),
    updateProductStock: (id, stock) => ipcRenderer.invoke('inventory:updateStock', id, stock),

    // --- PDFs y Ficheros ---
    generarPDF: (id, options) => ipcRenderer.invoke('cotizaciones:pdf', id, options),
    openExternal: (url) => ipcRenderer.invoke('open-external', url),
    getPdfPath: (numero) => ipcRenderer.invoke('get-pdf-path', numero),
    getPdfFolder: () => ipcRenderer.invoke('get-pdf-folder'),
    selectPdfFolder: () => ipcRenderer.invoke('select-pdf-folder'),

    // --- Respaldos ---
    exportBackup: () => ipcRenderer.invoke('backup:export'),
    importBackup: () => ipcRenderer.invoke('backup:import'),
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
    getClientes: (searchTerm) => ipcRenderer.invoke('clientes:list', searchTerm),
    getCliente: (id) => ipcRenderer.invoke('clientes:get', id),
    createCliente: (data) => ipcRenderer.invoke('clientes:create', data),
    updateCliente: (id, data) => ipcRenderer.invoke('clientes:update', id, data),
    deleteCliente: (id) => ipcRenderer.invoke('clientes:delete', id),
    
    getInventory: (searchTerm) => ipcRenderer.invoke('inventory:list', searchTerm),
    getProduct: (id) => ipcRenderer.invoke('inventory:get', id),
    createProduct: (data) => ipcRenderer.invoke('inventory:create', data),
    updateProduct: (id, data) => ipcRenderer.invoke('inventory:update', id, data),
    deleteProduct: (id) => ipcRenderer.invoke('inventory:delete', id),
    updateProductStock: (id, stock) => ipcRenderer.invoke('inventory:updateStock', id, stock),
    generarPDF: (id, options) => ipcRenderer.invoke('cotizaciones:pdf', id, options),
    openExternal: (url) => ipcRenderer.invoke('open-external', url),
    getPdfPath: (numero) => ipcRenderer.invoke('get-pdf-path', numero),
    getPdfFolder: () => ipcRenderer.invoke('get-pdf-folder'),
    selectPdfFolder: () => ipcRenderer.invoke('select-pdf-folder'),
    exportBackup: () => ipcRenderer.invoke('backup:export'),
    importBackup: () => ipcRenderer.invoke('backup:import'),
});
