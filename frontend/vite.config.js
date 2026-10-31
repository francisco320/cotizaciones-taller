import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],

  /**
   * BASE URL
   * · Producción (Electron): usa './' para rutas relativas, obligatorio con loadFile()
   * · Desarrollo (Vite dev server): '/' es el valor por defecto de Vite
   *
   * La variable VITE_ELECTRON_BUILD se pasa a través del script de build
   * en package.json ("build:frontend") para forzar base relativa.
   */
  base: process.env.VITE_ELECTRON_BUILD === 'true' ? './' : '/',

  server: {
    port: 5173,
    // Proxy en desarrollo: el frontend de Vite delega /api al backend Express
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },

  build: {
    // Directorio de salida del build (relativo a frontend/)
    outDir: 'dist',
    // Vaciar outDir antes de cada build
    emptyOutDir: true,
  },
})
