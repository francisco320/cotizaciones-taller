/**
 * Generador de PDF para cotizaciones integrado con Electron (versión compacta)
 */
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
let app;
try {
    const electron = require('electron');
    app = electron && electron.app ? electron.app : { isPackaged: false, getAppPath: () => __dirname };
} catch (err) {
    app = { isPackaged: false, getAppPath: () => __dirname };
}
const layout = require('./layout');

/**
 * Genera y guarda un archivo PDF en la ruta especificada
 * @param {Object} cotizacion - Documento completo de la cotización
 * @param {string} filePath - Ruta absoluta donde se guardará el PDF
 * @param {Object} [options] - Opciones extra
 * @returns {Promise<string>} La ruta del archivo guardado
 */
async function generarPDF(cotizacion, filePath, options = {}) {
    return new Promise((resolve, reject) => {
        if (!options.logoPath) {
            const basePath = app.isPackaged ? app.getAppPath() : __dirname;

            const candidates = [
                path.join(__dirname, '..', 'assets', 'logo.png'),
                path.join(basePath, 'assets', 'logo.png'),
                path.join(__dirname, '..', 'frontend', 'dist', 'logo.png'),
                path.join(__dirname, '..', 'frontend', 'public', 'logo.png'),
            ];

            for (const p of candidates) {
                if (fs.existsSync(p)) {
                    options.logoPath = p;
                    break;
                }
            }
        }

        const sourceItems = cotizacion.resumen?.items || cotizacion.items || [];
        const compact = true;
        const pageSize = sourceItems.length > 50
            ? [21.6 * 72 / 2.54, 33 * 72 / 2.54]
            : layout.page.size || 'letter';
        const pageLayout = {
            compact,
            margin: 24
        };
        const doc = new PDFDocument({ margin: pageLayout.margin, size: pageSize });
        const writeStream = fs.createWriteStream(filePath);

        doc.pipe(writeStream);

        writeStream.on('finish', () => resolve(filePath));
        writeStream.on('error', reject);
        doc.on('error', reject);

        let y = 24;

        y = drawHeader(doc, cotizacion, options.logoPath, y, pageLayout);
        y = drawClientInfo(doc, cotizacion, y, pageLayout);
        y = drawServiceInfo(doc, cotizacion, y, pageLayout);
        y = drawItemsTable(doc, cotizacion, y, pageLayout);
        y = drawTotals(doc, cotizacion, y, pageLayout);
        y = drawObservations(doc, cotizacion, y, pageLayout);
        drawFooter(doc, cotizacion, pageLayout);

        doc.end();
    });
}

function drawHeader(doc, cotizacion, logoPath, startY, pageLayout = {}) {
    const margin = pageLayout.margin ?? 24;
    let y = startY;
    let headerTextX = margin;

    const maxLogoW = 44;
    const maxLogoH = 34;
    let drawW = maxLogoW;
    let drawH = maxLogoH;

    if (logoPath) {
        try {
            const img = doc.openImage(logoPath);
            const scale = Math.min(1, maxLogoW / img.width, maxLogoH / img.height);
            drawW = Math.round(img.width * scale);
            drawH = Math.round(img.height * scale);
            doc.image(logoPath, margin, y, { width: drawW, height: drawH });
            headerTextX += drawW + 7;
        } catch (err) {
            console.warn('Could not load logo:', err.message);
        }
    }

    const rightBlockWidth = 180;
    const rightBlockX = doc.page.width - margin - rightBlockWidth;
    const companyWidth = Math.max(130, rightBlockX - headerTextX - 8);
    const companyName = cotizacion.empresa?.nombre || 'Empresa';

    doc.font('Helvetica-Bold').fontSize(12).fillColor(layout.colors.header);
    doc.text(companyName, headerTextX, y, { width: companyWidth });
    let companyY = y + doc.heightOfString(companyName, { width: companyWidth, font: 'Helvetica-Bold', fontSize: 12 }) + 2;

    const contacts = [
        cotizacion.empresa?.telefono && `Tel: ${cotizacion.empresa.telefono}`,
        cotizacion.empresa?.email
    ].filter(Boolean).join(' | ');

    doc.font('Helvetica').fontSize(7).fillColor(layout.colors.light);
    if (contacts) {
        doc.text(contacts, headerTextX, companyY, { width: companyWidth });
        companyY += doc.heightOfString(contacts, { width: companyWidth, font: 'Helvetica', fontSize: 7 }) + 1;
    }
    if (cotizacion.empresa?.direccion) {
        doc.text(cotizacion.empresa.direccion, headerTextX, companyY, { width: companyWidth });
        companyY += doc.heightOfString(cotizacion.empresa.direccion, {
            width: companyWidth,
            font: 'Helvetica',
            fontSize: 7
        }) + 1;
    }

    const numeroFormateado = cotizacion.numeroFormateado ?? String(cotizacion.numero || 0).padStart(7, '0');
    doc.font('Helvetica-Bold').fontSize(14).fillColor(layout.colors.brand || '#0f766e');
    doc.text('COTIZACIÓN', rightBlockX, y, { width: rightBlockWidth, align: 'right' });
    doc.font('Helvetica-Bold').fontSize(10).fillColor(layout.colors.text);
    doc.text(`# ${numeroFormateado}`, rightBlockX, y + 16, { width: rightBlockWidth, align: 'right' });
    doc.font('Helvetica').fontSize(7).fillColor(layout.colors.text);
    doc.text(`Emisión: ${formatDate(cotizacion.fechaEmision)}`, rightBlockX, y + 29, {
        width: rightBlockWidth,
        align: 'right'
    });
    if (cotizacion.fechaVencimiento) {
        doc.text(`Vence: ${formatDate(cotizacion.fechaVencimiento)}`, rightBlockX, y + 39, {
            width: rightBlockWidth,
            align: 'right'
        });
    }

    const nextY = Math.max(companyY, y + (cotizacion.fechaVencimiento ? 50 : 40), y + drawH) + 4;
    doc.moveTo(margin, nextY).lineTo(doc.page.width - margin, nextY)
        .lineWidth(0.7).strokeColor(layout.colors.border || '#e6e8eb').stroke();
    return nextY + 5;
}

function drawClientInfo(doc, cotizacion, startY, pageLayout = {}) {
    const margin = pageLayout.margin ?? 24;
    const width = doc.page.width - margin * 2;
    let y = startY;

    const clientLine = [
        `Cliente: ${cotizacion.cliente?.nombre || '—'}`,
        cotizacion.cliente?.telefono && `Tel: ${cotizacion.cliente.telefono}`,
        cotizacion.cliente?.rif && `CI/RIF: ${cotizacion.cliente.rif}`
    ].filter(Boolean).join('   |   ');
    const addressLine = `Dirección: ${cotizacion.cliente?.direccion || '—'}`;

    const titleSize = 10;
    const bodySize = 9.5;

    doc.font('Helvetica-Bold').fontSize(titleSize).fillColor(layout.colors.header);
    doc.text('CLIENTE', margin, y, { width });
    y += 13;

    doc.font('Helvetica').fontSize(bodySize).fillColor(layout.colors.text);
    doc.text(clientLine, margin, y, { width });
    y += doc.heightOfString(clientLine, { width, font: 'Helvetica', fontSize: bodySize }) + 2;

    doc.text(addressLine, margin, y, { width });
    y += doc.heightOfString(addressLine, { width, font: 'Helvetica', fontSize: bodySize }) + 5;

    return y;
}

function drawServiceInfo(doc, cotizacion, startY, pageLayout = {}) {
    const tipo = cotizacion.tipoServicio;
    const v = cotizacion.vehiculo || {};

    if (!tipo && !v.vehiculo && !v.modelo && !v.placa && !v.marca && !v.serial) return startY;

    const margin = pageLayout.margin ?? 24;
    const width = doc.page.width - margin * 2;

    const fields = tipo === 'bomba_inyeccion'
        ? [
            { label: 'Marca', value: cotizacion.marcaBomba || v.marca || v.vehiculo || '—' },
            { label: 'Modelo', value: cotizacion.modeloBomba || v.modelo || '—' },
            { label: 'Serial', value: cotizacion.serialBomba || v.serial || v.placa || '—' },
            { label: 'Otro', value: cotizacion.otroBomba || cotizacion.otro || v.otroBomba || v.otro || '—' }
        ]
        : [
            { label: 'Vehículo', value: v.vehiculo || '—' },
            { label: 'Modelo', value: v.modelo || '—' },
            { label: 'Color', value: v.color || '—' },
            { label: 'Placa', value: v.placa || '—' }
        ];

    const text = fields.map(field => `${field.label}: ${field.value}`).join('   |   ');
    const titleSize = 10;
    const bodySize = 9.5;

    doc.font('Helvetica-Bold').fontSize(titleSize).fillColor(layout.colors.header);
    doc.text(tipo === 'bomba_inyeccion' ? 'BOMBA DE INYECCIÓN' : 'VEHÍCULO', margin, startY, { width });

    doc.font('Helvetica').fontSize(bodySize).fillColor(layout.colors.text);
    doc.text(text, margin, startY + 13, { width });

    return startY + 13 + doc.heightOfString(text, { width, font: 'Helvetica', fontSize: bodySize }) + 5;
}

function drawItemsTable(doc, cotizacion, startY, pageLayout = {}) {
    let y = startY;
    const margin = pageLayout.margin ?? 24;
    const innerWidth = doc.page.width - margin * 2;

    const resumen = cotizacion.resumen || calcularResumenInMemory(cotizacion);
    const items = resumen.items || cotizacion.items || [];

    const wRef = 30;
    const wCant = 48;
    const wUnit = 72;
    const wTotal = 72;
    const wDesc = innerWidth - wRef - wCant - wUnit - wTotal;

    const headerFontSize = 10;
    const bodyFontSize = 10;
    const pad = 3;

    const xRef = margin;
    const xDesc = xRef + wRef;
    const xCant = xDesc + wDesc;
    const xUnit = xCant + wCant;
    const xTot = xUnit + wUnit;

    const contentBottom = doc.page.height - margin - 34;
    const headerHeight = 18;
    const headerTextOffset = 4;
    const headerAfter = 21;

    const drawTableHeader = (headerY) => {
        doc.roundedRect(margin, headerY, innerWidth, headerHeight, 4).fill(layout.table.headerBg);
        doc.fillColor(layout.colors.header).font('Helvetica-Bold').fontSize(headerFontSize);

        const textY = headerY + headerTextOffset;
        doc.text('REF', xRef + pad, textY, { width: wRef - pad * 2, align: 'left' });
        doc.text('DESCRIPCIÓN', xDesc + pad, textY, { width: wDesc - pad * 2, align: 'left' });
        doc.text('CANT.', xCant + pad, textY, { width: wCant - pad * 2, align: 'right' });
        doc.text('P. UNIT.', xUnit + pad, textY, { width: wUnit - pad * 2, align: 'right' });
        doc.text('TOTAL', xTot + pad, textY, { width: wTotal - pad * 2, align: 'right' });

        doc.font('Helvetica').fontSize(bodyFontSize).fillColor(layout.colors.text);
        return headerY + headerAfter;
    };

    y = drawTableHeader(y);

    items.forEach((item, i) => {
        const bg = i % 2 === 0 ? layout.table.rowBg : '#ffffff';
        const itemText = String(item.descripcion || '');
        const textHeight = doc.heightOfString(itemText, {
            width: wDesc - pad * 2,
            font: 'Helvetica',
            fontSize: bodyFontSize
        });
        const rowHeight = Math.max(14, textHeight + 3);

        if (y + rowHeight > contentBottom) {
            drawFooter(doc, cotizacion, pageLayout);
            doc.addPage();
            y = drawTableHeader(margin);
        }

        doc.save();
        doc.rect(margin, y, innerWidth, rowHeight).fill(bg);
        doc.restore();

        const itemY = y + 2;
        doc.font('Helvetica').fontSize(bodyFontSize).fillColor(layout.colors.text);
        doc.text(String(i + 1), xRef + pad, itemY, { width: wRef - pad * 2, align: 'left' });
        doc.text(itemText, xDesc + pad, itemY, { width: wDesc - pad * 2, align: 'left' });
        doc.text(String(item.cantidad || ''), xCant + pad, itemY, { width: wCant - pad * 2, align: 'right' });
        doc.text(formatMoney(item.precioBase), xUnit + pad, itemY, { width: wUnit - pad * 2, align: 'right' });
        doc.text(formatMoney(item.subtotal), xTot + pad, itemY, { width: wTotal - pad * 2, align: 'right' });

        y += rowHeight;
    });

    return y + 12;
}

function drawTotals(doc, cotizacion, startY, pageLayout = {}) {
    const resumen = cotizacion.resumen || calcularResumenInMemory(cotizacion);
    let y = startY;
    const margin = pageLayout.margin ?? 24;

    const contentBottom = doc.page.height - margin - 34;
    const totalsHeight = resumen.aplicaIVA ? 52 : 40;
    if (y + totalsHeight > contentBottom) {
        drawFooter(doc, cotizacion, pageLayout);
        doc.addPage();
        y = margin;
    }

    const wTotalBlock = 220;
    const xTotalBlock = doc.page.width - margin - wTotalBlock;

    const fontSize = 8;
    const lineHeight = 11;
    doc.font('Helvetica').fontSize(fontSize).fillColor(layout.colors.text);

    doc.text('Subtotal:', xTotalBlock, y, { width: 100 });
    doc.text(formatMoney(resumen.subtotalGeneral), xTotalBlock + 100, y, { width: wTotalBlock - 100, align: 'right' });
    y += lineHeight;

    if (resumen.aplicaIVA) {
        doc.text(`IVA (${cotizacion.porcentajeIVA || 16}%):`, xTotalBlock, y, { width: 100 });
        doc.text(formatMoney(resumen.montoIVA), xTotalBlock + 100, y, { width: wTotalBlock - 100, align: 'right' });
        y += lineHeight;
    }

    y += 2;

    const totalBoxHeight = 22;
    doc.roundedRect(xTotalBlock - 4, y - 4, wTotalBlock + 8, totalBoxHeight, 5)
        .fill(layout.colors.brand);

    doc.font('Helvetica-Bold').fontSize(10).fillColor('#ffffff');
    doc.text('TOTAL', xTotalBlock + 8, y + 5, { width: 80 });
    doc.text(formatMoney(resumen.total), xTotalBlock + 90, y + 5, {
        width: wTotalBlock - 98,
        align: 'right'
    });

    const firmadoPor = cotizacion.elaboradoPor || 'Lariannys Villazana';
    const labelY = startY;
    const fecha = formatDate(cotizacion.fechaAceptacion || cotizacion.fechaEmision);

    doc.font('Helvetica').fontSize(7).fillColor(layout.colors.light);
    doc.text('Aceptada, firma y/o sello:', margin, labelY);
    doc.font('Helvetica-Bold').fontSize(8).fillColor(layout.colors.text);
    doc.text(firmadoPor, margin, labelY + 9);

    if (fecha && fecha !== '—') {
        doc.font('Helvetica').fontSize(7).fillColor(layout.colors.light);
        doc.text(`Fecha: ${fecha}`, margin, labelY + 19);
    }

    return y + totalBoxHeight + 6;
}

function drawObservations(doc, cotizacion, startY, pageLayout = {}) {
    let y = startY;
    const margin = pageLayout.margin ?? 24;
    const rightMargin = doc.page.width - margin;
    const contentBottom = doc.page.height - margin - 34;
    const fontSize = 7;

    doc.font('Helvetica').fontSize(fontSize);
    const hasObs = Boolean(cotizacion.observaciones?.trim());
    const hasNotes = Boolean(cotizacion.notas?.trim());
    const texts = [
        ...(hasObs ? [cotizacion.observaciones] : []),
        ...(hasNotes ? [cotizacion.notas] : []),
        ...(!hasObs && !hasNotes ? ['Sin observaciones.'] : [])
    ];
    const observationsHeight = 8 + texts.reduce(
        (height, text) => height + doc.heightOfString(text, { width: rightMargin - margin }) + 3,
        0
    );

    if (y + observationsHeight > contentBottom && y > layout.page.marginTop) {
        drawFooter(doc, cotizacion, pageLayout);
        doc.addPage();
        y = margin;
    }

    doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#374151');
    doc.text('OBSERVACIONES:', margin, y);
    y += 8;

    doc.font('Helvetica').fontSize(fontSize).fillColor('#4b5563');

    if (hasObs) {
        doc.text(cotizacion.observaciones, margin, y, { width: rightMargin - margin });
        y += doc.heightOfString(cotizacion.observaciones, { width: rightMargin - margin }) + 3;
    }

    if (hasNotes) {
        doc.text(cotizacion.notas, margin, y, { width: rightMargin - margin });
        y += doc.heightOfString(cotizacion.notas, { width: rightMargin - margin }) + 3;
    }

    if (!hasObs && !hasNotes) {
        const defaultObs = 'Sin observaciones.';
        doc.text(defaultObs, margin, y, { width: rightMargin - margin });
        y += doc.heightOfString(defaultObs, { width: rightMargin - margin }) + 3;
    }

    return y;
}

function drawFooter(doc, cotizacion, pageLayout = {}) {
    const margin = pageLayout.margin ?? 24;

    doc.font('Helvetica-Oblique').fontSize(7).fillColor('#9ca3af');
    const y = doc.page.height - margin - 18;
    doc.text('Gracias por su preferencia', margin, y, { align: 'center', width: doc.page.width - margin * 2 });
}

function drawField(doc, label, value, x, y, options = {}) {
    const { maxWidth } = options;

    doc.font('Helvetica-Bold').text(label, x, y, { continued: true });

    const valueOpts = { continued: false };
    if (maxWidth) {
        valueOpts.width = maxWidth;
    }

    doc.font('Helvetica').text(` ${value || '—'}`, valueOpts);
}

function formatDate(value) {
    if (!value) return '—';
    const d = new Date(value);
    const [year, month, day] = value.split('T')[0].split('-');
    if (year && month && day) return `${day}/${month}/${year}`;
    return d.toLocaleDateString('es-VE', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function formatMoney(num) {
    const n = Number(num);
    if (Number.isNaN(n)) return '0,00';
    return n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function calcularResumenInMemory(cotizacion) {
    const { resumenCotizacion } = require('./calculations');
    return resumenCotizacion(
        cotizacion.items || [],
        cotizacion.aplicaIVA,
        cotizacion.porcentajeIVA
    );
}

module.exports = { generarPDF };
