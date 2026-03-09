const cotizacionService = require('./src/services/cotizacion.service.js');

async function test() {
  console.log('Testing create...');
  const cot = await cotizacionService.crear({
    empresa: { nombre: 'Test Empresa', rif: 'J-12345678-9' },
    cliente: { nombre: 'Test Cliente' },
    vehiculo: { marca: 'Toyota', modelo: 'Corolla' },
    items: [
      { descripcion: 'Item 1', precioBase: 100, cantidad: 2 },
      { descripcion: 'Item 2', precioBase: 50, cantidad: 1 }
    ]
  });
  console.log('Created:', cot);

  console.log('Testing get by ID...');
  const fetched = await cotizacionService.obtenerPorId(cot.id);
  console.log('Fetched:', fetched);

  console.log('Testing list...');
  const list = await cotizacionService.listar();
  console.log('List total:', list.total, 'Items count:', list.items.length);

  try {
    console.log('Testing PDF Preview generation...');
    const pdfPreviewBytes = await cotizacionService.generarPDFCotizacion(cot.id, {});
    console.log('PDF Generated size:', pdfPreviewBytes ? pdfPreviewBytes.length : 0);
  } catch (e) {
    console.error('Error generating PDF:', e);
  }
}

test().catch(console.error);
