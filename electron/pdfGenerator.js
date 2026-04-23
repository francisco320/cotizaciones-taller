/**
 * Generador de PDF para cotizaciones integrado con Electron
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
        // Buscar el logo dinámicamente si no se pasa uno por parámetro
        if (!options.logoPath) {
            // En modo desarrollo, __dirname apunta a /.../electron
            // En modo empaquetado, app.getAppPath() apunta a /.../resources/app.asar
            const basePath = app.isPackaged ? app.getAppPath() : __dirname;

            const candidates = [
                // Desarrollo: assets/ en la raíz del proyecto
                path.join(__dirname, '..', 'assets', 'logo.png'),
                // Empaquetado: assets/ dentro del ASAR
                path.join(basePath, 'assets', 'logo.png'),
                // Si el logo se genera en el frontend (por ejemplo, Vite), buscarlo allí también
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

        const doc = new PDFDocument({ margin: layout.page.margin, size: layout.page.size || 'letter' });
        const writeStream = fs.createWriteStream(filePath);

        doc.pipe(writeStream);

        writeStream.on('finish', () => resolve(filePath));
        writeStream.on('error', reject);
        doc.on('error', reject);

        let y = layout.page.marginTop;

        y = drawHeader(doc, cotizacion, options.logoPath, y);
        y = drawClientInfo(doc, cotizacion, y);
        y = drawServiceInfo(doc, cotizacion, y);
        y = drawItemsTable(doc, cotizacion, y);
        y = drawTotals(doc, cotizacion, y);
        y = drawObservations(doc, cotizacion, y);
        drawFooter(doc, cotizacion);

        doc.end();
    });
}

function drawHeader(doc, cotizacion, logoPath, startY) {
    const margin = layout.page.margin;
    let y = startY;

    // ----- Header -----
    const printableWidth = doc.page.width - margin * 2;
    let headerTextX = margin;

    // Calcular primero la altura del bloque de texto del membrete
    const companyName = cotizacion.empresa?.nombre || 'Empresa';
    doc.font('Helvetica-Bold').fontSize(layout.fonts.title || 20);
    const titleHeight = doc.heightOfString(companyName, { width: 300 }) + 4; // Add padding

    doc.font('Helvetica').fontSize(layout.fonts.small || 9);
    let contactHeight = 0;
    if (cotizacion.empresa?.telefono) contactHeight += 12;
    if (cotizacion.empresa?.email) contactHeight += 12;
    if (cotizacion.empresa?.direccion) contactHeight += doc.heightOfString(cotizacion.empresa.direccion, { width: 300 }) + 4;

    const textBlockHeight = titleHeight + contactHeight;
    let drawW = 100;
    let drawH = textBlockHeight > 0 ? textBlockHeight : 80;

    if (logoPath) {
        try {
            const img = doc.openImage(logoPath);
            const imgW = img.width || 100;
            const imgH = img.height || 80;

            // Escalar el logo para que su altura coincida exactamente con la del bloque de texto
            const scale = textBlockHeight / imgH;
            
            drawW = Math.round(imgW * scale);
            drawH = Math.round(textBlockHeight);

            // Evitar que el logo sea extremadamente ancho
            const maxLogoW = Math.floor(printableWidth * 0.4);
            if (drawW > maxLogoW) {
                const reduceScale = maxLogoW / drawW;
                drawW = maxLogoW;
                drawH = Math.round(drawH * reduceScale);
            }

            doc.image(logoPath, margin, startY, { width: drawW, height: drawH });
            headerTextX += drawW + (layout.logo?.spacing || 12);
        } catch (err) {
            console.warn('Could not load logo:', err.message);
        }
    }

    // Dibujar el texto a la derecha del logo
    // Company Name
    doc.font('Helvetica-Bold').fontSize(layout.fonts.title || 20).fillColor(layout.colors.header);
    doc.text(cotizacion.empresa?.nombre || 'Empresa', headerTextX, y, { width: 300 });
    y += doc.heightOfString(cotizacion.empresa?.nombre || 'Empresa', { width: 300 }) + 4;

    doc.font('Helvetica').fontSize(layout.fonts.small || 9).fillColor(layout.colors.light);
    if (cotizacion.empresa?.telefono) {
        doc.text(`Teléfono: ${cotizacion.empresa.telefono}`, headerTextX, y);
        y += 12;
    }
    if (cotizacion.empresa?.email) {
        doc.text(`Email: ${cotizacion.empresa.email}`, headerTextX, y);
        y += 12;
    }
    if (cotizacion.empresa?.direccion) {
        doc.text(cotizacion.empresa.direccion, headerTextX, y, { width: 300 });
        y += doc.heightOfString(cotizacion.empresa.direccion, { width: 300 }) + 4;
    }

    // Invoice details (Top Right)
    const numeroFormateado = cotizacion.numeroFormateado ?? String(cotizacion.numero || 0).padStart(7, '0');
    const pageWidth = doc.page.width;
    const rightMargin = pageWidth - margin;

    doc.font('Helvetica-Bold').fontSize(layout.fonts.title || 20).fillColor(layout.colors.brand || '#0f766e');
    doc.text(`COTIZACIÓN`, 0, startY, { align: 'right', margin: margin, width: rightMargin });

    doc.font('Helvetica-Bold').fontSize(layout.fonts.subtitle || 13).fillColor(layout.colors.text);
    doc.text(`# ${numeroFormateado}`, 0, startY + 22, { align: 'right', margin: margin, width: rightMargin });

    let topY = startY + 45;
    doc.font('Helvetica-Bold').fontSize(layout.fonts.small || 9).fillColor(layout.colors.text);
    doc.text(`Fecha de Emisión:`, 0, topY, { align: 'right', margin: margin, width: rightMargin - 70 });
    doc.font('Helvetica').text(formatDate(cotizacion.fechaEmision), 0, topY, { align: 'right', margin: margin, width: rightMargin });
    topY += 15;

    if (cotizacion.fechaVencimiento) {
        doc.font('Helvetica-Bold').text(`Vencimiento:`, 0, topY, { align: 'right', margin: margin, width: rightMargin - 70 });
        doc.font('Helvetica').text(formatDate(cotizacion.fechaVencimiento), 0, topY, { align: 'right', margin: margin, width: rightMargin });
    }

    let nextY = Math.max(y, startY + drawH, topY + 20) + 15;

    // Line separator
    doc.moveTo(margin, nextY).lineTo(rightMargin, nextY).lineWidth(1).strokeColor(layout.colors.border || '#e6e8eb').stroke();
    return nextY + 15;
}

function drawClientInfo(doc, cotizacion, startY) {
    const margin = layout.page.margin;
    const blockWidth = doc.page.width - margin * 2;
    const padding = 10;
    const lineHeight = 14;
    const headerHeight = 16;
    
    // Calculamos el alto dinámicamente o mantenemos uno base
    const blockHeight = 75; 

    // Card-style background
    doc.roundedRect(margin, startY, blockWidth, blockHeight, 4)
        .fill(layout.table.headerBg)
        .strokeColor(layout.colors.border)
        .lineWidth(0.8)
        .stroke();

    let y = startY + padding;

    // Título de la sección
    doc.font('Helvetica-Bold').fontSize(layout.fonts.subtitle || 12).fillColor(layout.colors.header);
    doc.text('DATOS DEL CLIENTE', margin + padding, y);
    y += headerHeight;

    doc.font('Helvetica').fontSize(layout.fonts.body || 10).fillColor(layout.colors.text);

    const col1 = margin + padding;
    const col2 = doc.page.width / 2 + padding;

    // Fila 1: Nombre y Teléfono
    drawField(doc, 'Cliente:', cotizacion.cliente?.nombre, col1, y);
    drawField(doc, 'Teléfono:', cotizacion.cliente?.telefono, col2, y);
    y += lineHeight;

    // Fila 2: RIF (en la primera columna)
    drawField(doc, 'CI/RIF:', cotizacion.cliente?.rif, col1, y);
    y += lineHeight + 2; // Espacio extra antes de la dirección

    // Fila 3: DIRECCIÓN (Abarcando todo el ancho y con letra más pequeña)
    const fullWidth = blockWidth - (padding * 2);
    
    doc.font('Helvetica-Bold').fontSize(8); // Tamaño reducido para el label
    doc.text('Dirección:', col1, y, { continued: true });
    
    doc.font('Helvetica').fontSize(8); // Tamaño reducido para el valor
    doc.text(` ${cotizacion.cliente?.direccion || '—'}`, {
        width: fullWidth,
        align: 'left'
    });

    return startY + blockHeight + 8;
}

function drawServiceInfo(doc, cotizacion, startY) {
    const tipo = cotizacion.tipoServicio;
    const v = cotizacion.vehiculo || {};

    if (!tipo && !v.vehiculo && !v.modelo && !v.placa && !v.marca && !v.serial) return startY;

    const margin = layout.page.margin;
    const blockWidth = doc.page.width - margin * 2;
    const padding = 10;
    const lineHeight = 14;
    const headerHeight = 16;
    const blockHeight = 90;

    // Card-style background
    doc.roundedRect(margin, startY, blockWidth, blockHeight, 4)
        .fill(layout.table.headerBg)
        .strokeColor(layout.colors.border)
        .lineWidth(0.8)
        .stroke();

    let y = startY + padding;

    doc.font('Helvetica-Bold').fontSize(layout.fonts.subtitle || 12).fillColor(layout.colors.header);
    doc.text(tipo === 'bomba_inyeccion' ? 'DATOS DE LA BOMBA DE INYECCIÓN' : 'DATOS DEL VEHÍCULO', margin + padding, y);
    y += headerHeight;

    doc.font('Helvetica').fontSize(layout.fonts.body || 10).fillColor(layout.colors.text);

    const colW = (doc.page.width - margin * 2 - padding * 2) / 4;
    const startCol = margin + padding;

    if (tipo === 'bomba_inyeccion') {
        // Soportar campos enviados desde el frontend como propiedades top-level
        const marca = cotizacion.marcaBomba || v.marca || v.vehiculo || '—';
        const modeloVal = cotizacion.modeloBomba || v.modelo || '—';
        const serial = cotizacion.serialBomba || v.serial || v.placa || '—';
        const otroVal = cotizacion.otroBomba || cotizacion.otro || v.otroBomba || v.otro || '—';

        drawField(doc, 'Marca:', marca, startCol, y);
        drawField(doc, 'Modelo:', modeloVal, startCol + colW, y);
        drawField(doc, 'Serial:', serial, startCol + colW * 2, y);
        // Nueva fila para campo adicional "Otro" específico de la bomba
        const extraY = y + lineHeight;
        drawField(doc, 'Otro:', otroVal, startCol, extraY, { maxWidth: blockWidth - padding * 2 });
    } else {
        drawField(doc, 'Vehículo:', v.vehiculo, startCol, y);
        drawField(doc, 'Modelo:', v.modelo, startCol + colW, y);
        drawField(doc, 'Color:', v.color, startCol + colW * 2, y);
        drawField(doc, 'Placa:', v.placa, startCol + colW * 3, y);
    }

    return startY + blockHeight + 8;
}

function drawItemsTable(doc, cotizacion, startY) {
    let y = startY;
    const margin = layout.page.margin;
    const pageWidth = doc.page.width;
    const innerWidth = pageWidth - margin * 2;

    const resumen = cotizacion.resumen || calcularResumenInMemory(cotizacion);
    const items = resumen.items || cotizacion.items || [];

    const wRef = 30;
    const wCant = 50;
    const wUnit = 70;
    const wTotal = 70;
    const wDesc = innerWidth - wRef - wCant - wUnit - wTotal;

    const headerFontSize = 8.5;
    const bodyFontSize = 9;
    const pad = layout.table.colPadding || 6;

    // Table Header
    doc.roundedRect(margin, y, innerWidth, 22, 4).fill(layout.table.headerBg);
    doc.fillColor(layout.colors.header).font('Helvetica-Bold').fontSize(headerFontSize);

    const textY = y + 6;

    const xRef = margin;
    const xDesc = xRef + wRef;
    const xCant = xDesc + wDesc;
    const xUnit = xCant + wCant;
    const xTot = xUnit + wUnit;

    doc.text('REF', xRef + pad, textY, { width: wRef - pad * 2, align: 'left' });
    doc.text('DESCRIPCIÓN', xDesc + pad, textY, { width: wDesc - pad * 2, align: 'left' });
    doc.text('CANT.', xCant + pad, textY, { width: wCant - pad * 2, align: 'right' });
    doc.text('P. UNIT.', xUnit + pad, textY, { width: wUnit - pad * 2, align: 'right' });
    doc.text('TOTAL', xTot + pad, textY, { width: wTotal - pad * 2, align: 'right' });

    y += 26;

    doc.font('Helvetica').fontSize(bodyFontSize).fillColor(layout.colors.text);

    const maxY = doc.page.height - margin - (layout.footer?.marginTop || 24) - 20;

    items.forEach((item, i) => {
        const bg = i % 2 === 0 ? layout.table.rowBg : '#ffffff';
        const itemText = String(item.descripcion || '');
        const itemHeight = Math.max(16, doc.heightOfString(itemText, { width: wDesc - pad * 2 }) + 6);

        const rowHeight = itemHeight;

        // Ensure we stay inside a single page
        if (y + rowHeight > maxY) {
            // clamp to remaining space
            y = Math.max(margin, maxY - rowHeight);
        }

        doc.save();
        doc.rect(margin, y, innerWidth, rowHeight).fill(bg);
        doc.restore();

        const itemY = y + 4;
        doc.fillColor(layout.colors.text);
        doc.text(String(i + 1), xRef + pad, itemY, { width: wRef - pad * 2, align: 'left' });
        doc.text(itemText, xDesc + pad, itemY, { width: wDesc - pad * 2, align: 'left' });
        doc.text(String(item.cantidad || ''), xCant + pad, itemY, { width: wCant - pad * 2, align: 'right' });
        doc.text(formatMoney(item.precioBase), xUnit + pad, itemY, { width: wUnit - pad * 2, align: 'right' });
        doc.text(formatMoney(item.subtotal), xTot + pad, itemY, { width: wTotal - pad * 2, align: 'right' });

        y += rowHeight;
    });

    return y + 12;
}

function drawTotals(doc, cotizacion, startY) {
    const resumen = cotizacion.resumen || calcularResumenInMemory(cotizacion);
    let y = startY;
    const margin = layout.page.margin;

    const maxY = doc.page.height - margin - (layout.footer?.marginTop || 24) - 30;
    if (y > maxY) {
        y = Math.max(margin, maxY - 60);
    }

    const wTotalBlock = 220;
    const xTotalBlock = doc.page.width - margin - wTotalBlock;

    doc.font('Helvetica').fontSize(10).fillColor(layout.colors.text);

    // Subtotal
    doc.text('Subtotal:', xTotalBlock, y, { width: 100 });
    doc.text(formatMoney(resumen.subtotalGeneral), xTotalBlock + 100, y, { width: wTotalBlock - 100, align: 'right' });
    y += 16;

    // IVA
    if (resumen.aplicaIVA) {
        doc.text(`IVA (${cotizacion.porcentajeIVA || 16}%):`, xTotalBlock, y, { width: 100 });
        doc.text(formatMoney(resumen.montoIVA), xTotalBlock + 100, y, { width: wTotalBlock - 100, align: 'right' });
        y += 16;
    }

    y += 6;

    // Total destacado
    const totalBoxHeight = 42;
    doc.roundedRect(xTotalBlock - 4, y - 4, wTotalBlock + 8, totalBoxHeight, 5)
        .fill(layout.colors.brand);

    doc.font('Helvetica-Bold').fontSize(14).fillColor('#ffffff');
    doc.text('TOTAL', xTotalBlock + 8, y + 8, { width: 80 });
    doc.text(formatMoney(resumen.total), xTotalBlock + 90, y + 8, { width: wTotalBlock - 98, align: 'right' });

    // Firma / aceptación
    // Asegurarse de que siempre haya un valor para 'elaboradoPor'
    const firmadoPor = cotizacion.elaboradoPor || 'Lariannys Villazana';
    const labelY = startY;
    const fecha = formatDate(cotizacion.fechaAceptacion || cotizacion.fechaEmision);

    doc.font('Helvetica').fontSize(layout.fonts.small).fillColor(layout.colors.light);
    doc.text('Aceptada, firma y/o sello:', margin, labelY);
    doc.font('Helvetica-Bold').fontSize(layout.fonts.body).fillColor(layout.colors.text);
    doc.text(firmadoPor, margin, labelY + 12);

    if (fecha && fecha !== '—') {
        doc.font('Helvetica').fontSize(layout.fonts.small).fillColor(layout.colors.light);
        doc.text(`Fecha: ${fecha}`, margin, labelY + 26);
    }

    return y + totalBoxHeight + 6;
}

function drawObservations(doc, cotizacion, startY) {
    let y = startY;
    const margin = layout.page.margin;
    const rightMargin = doc.page.width - margin;

    // Always render an observations section (default text if empty)
    if (y > doc.page.height - 80) {
        doc.addPage();
        y = layout.page.marginTop;
    }

    doc.font('Helvetica-Bold').fontSize(10).fillColor('#374151');
    doc.text('OBSERVACIONES:', margin, y);
    y += 10;

    doc.font('Helvetica').fontSize(9).fillColor('#4b5563');

    const hasObs = Boolean(cotizacion.observaciones?.trim());
    const hasNotes = Boolean(cotizacion.notas?.trim());

    if (hasObs) {
        doc.text(cotizacion.observaciones, margin, y, { width: rightMargin - margin });
        y += doc.heightOfString(cotizacion.observaciones, { width: rightMargin - margin }) + 8;
    }

    if (hasNotes) {
        doc.text(cotizacion.notas, margin, y, { width: rightMargin - margin });
        y += doc.heightOfString(cotizacion.notas, { width: rightMargin - margin }) + 8;
    }

    if (!hasObs && !hasNotes) {
        const defaultObs = 'Sin observaciones.';
        doc.text(defaultObs, margin, y, { width: rightMargin - margin });
        y += doc.heightOfString(defaultObs, { width: rightMargin - margin }) + 8;
    }

    return y;
}

function drawFooter(doc, cotizacion) {
    const margin = layout.page.margin;

    doc.font('Helvetica-Oblique').fontSize(layout.footer?.noteSize || 9).fillColor('#9ca3af');
    // Colocar el footer dentro del área imprimible para evitar creación automática
    // de una página adicional por parte de PDFKit cuando la Y está fuera del límite.
    const footerOffset = layout.footer?.marginTop || 24;
    const y = doc.page.height - margin - footerOffset;
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