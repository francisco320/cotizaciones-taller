/**
 * Constantes de diseño para el PDF (márgenes, fuentes, colores).
 * Centralizar aquí facilita cambiar el aspecto sin tocar la lógica del generador.
 */
module.exports = {
  page: {
    margin: 40,      // Reducido un poco (de 48) para ganar espacio lateral
    marginTop: 50,   // Ajustado para compensar que el papel es más corto
    size: 'LETTER',
  },
  logo: {
    width: 120,      // Un poco más grande para aprovechar el ancho
    height: 80,
  },
  fonts: {
    title: 22,
    subtitle: 13,
    body: 11,
    small: 9,
  },
  colors: {
    brand: '#059669', // emerald-600 accent
    header: '#1e293b', // slate-800
    text: '#475569', // slate-600
    light: '#94a3b8', // slate-400
    border: '#cbd5e1', // slate-200
  },
  table: {
    headerBg: '#f1f5f9', // soft slate background
    rowBg: '#f8fafc',
    headerText: '#1e293b',
    rowHeight: 24,
    colPadding: 6,
    borderWidth: 0.5,
  },
  footer: {
    noteSize: 9,
    marginTop: 24,
  },
};
