/**
 * API Client adaptado para Electron IPC Offline
 * Reemplaza los endpoints expuestos mediante Express.
 */

export const electronAPI = {
  listar: (params = {}) => {
    const limit = params.limit || 50;
    const skip = params.skip || 0;
    // Window.api fue inyectado por preload.js
    return window.electronAPI.getCotizaciones(limit, skip);
  },

  obtener: (id) => {
    return window.electronAPI.getCotizacion(id);
  },

  crear: (body) => {
    return window.electronAPI.createCotizacion(body);
  },

  actualizar: (id, body) => {
    return window.electronAPI.updateCotizacion(id, body);
  },

  eliminar: (id) => {
    return window.electronAPI.deleteCotizacion(id);
  },

  generarYGuardarPdf: async (id, options = {}) => {
    const filePath = await window.electronAPI.generarPDF(id, options);
    if (!filePath) {
      // Usuario canceló o hubo error silencioso
      return null;
    }
    return filePath;
  },

  getPdfFolder: () => window.electronAPI.getPdfFolder(),
  selectPdfFolder: () => window.electronAPI.selectPdfFolder(),
}
