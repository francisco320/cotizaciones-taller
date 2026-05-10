const path = require('path');
const { generarPDF } = require('./electron/pdfGenerator');

const cotizacionTest = {
    numero: 1234,
    fechaEmision: new Date().toISOString(),
    empresa: {
        nombre: 'Taller Motor V8',
        telefono: '0414-1234567',
        email: 'taller@motorv8.com',
        direccion: 'Av. Siempre Viva 123, Zona Industrial'
    },
    cliente: {
        nombre: 'Francisco Jose',
        telefono: '0424-9876543',
        rif: 'V-12345678-9',
        direccion: 'Urbanización El Bosque, Sector 4'
    },
    tipoServicio: 'vehiculo',
    vehiculo: {
        vehiculo: 'F-250 Super Duty Cabina Doble Turbo Diesel 4x4',
        modelo: '2024 Lariat con Kit Offroad',
        color: 'Gris Grafito Perlado',
        placa: 'AS123KD'
    },
    items: [
        { descripcion: 'Cambio de aceite sintético 5W-30', cantidad: 1, precioBase: 45, subtotal: 45 },
        { descripcion: 'Filtro de aceite original Motorcraft', cantidad: 1, precioBase: 15, subtotal: 15 },
        { descripcion: 'Alineación y balanceo computarizado de 4 ruedas con plomos', cantidad: 1, precioBase: 40, subtotal: 40 }
    ],
    aplicaIVA: true,
    porcentajeIVA: 16
};

generarPDF(cotizacionTest, path.join(__dirname, 'test_cotizacion.pdf'))
    .then(p => console.log('✅ PDF de prueba generado con éxito en:', p))
    .catch(e => console.error('❌ Error generando PDF:', e));
