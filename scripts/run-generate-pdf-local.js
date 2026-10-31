const path = require('path');
const fs = require('fs');

// Ejecuta el generador de PDF del proyecto (electron/pdfGenerator.js) desde Node.js
(async () => {
  try {
    const { generarPDF } = require('../electron/pdfGenerator');

    const cotizacion = {
      empresa: {
        nombre: 'ACME S.A.',
        telefono: '+58 212-555-1234',
        email: 'info@acme.test',
        direccion: 'Av. Principal 123, Ciudad'
      },
      cliente: {
        nombre: 'Cliente Prueba',
        direccion: 'Calle Falsa 123',
        telefono: '+58 123 4567890'
      },
      fechaEmision: new Date().toISOString(),
      numero: 42,
      items: [
        { descripcion: 'Servicio A', precioBase: 150, cantidad: 2, subtotal: 300 },
        { descripcion: 'Producto B', precioBase: 450, cantidad: 1, subtotal: 450 }
      ],
      aplicaIVA: true,
      porcentajeIVA: 16
    };

    const outPath = path.resolve(process.cwd(), 'cotizacion-test.pdf');
    // Asegurar carpeta
    const outDir = path.dirname(outPath);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    await generarPDF(cotizacion, outPath);
    console.log('PDF generado en:', outPath);
  } catch (err) {
    console.error('Error generando PDF de prueba:', err);
    process.exitCode = 1;
  }
})();
