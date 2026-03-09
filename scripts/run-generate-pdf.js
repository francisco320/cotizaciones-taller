const fs = require('fs');
const path = require('path');
const { generarPDFCotizacion } = require('../src/services/cotizacion.service');

(async () => {
  try {
    const cotizacion = {
      empresa: {
        nombre: 'ACME S.A.',
        rif: 'J-12345678-9',
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
    const buffer = await generarPDFCotizacion(cotizacion);
    fs.writeFileSync(outPath, buffer);
    console.log('PDF generado en:', outPath);
  } catch (err) {
    console.error('Error generando PDF de prueba:', err);
    process.exit(1);
  }
})();
