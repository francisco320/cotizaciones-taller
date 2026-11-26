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

        const sourceItems = cotizacion.resumen?.items || cotizacion.items || [];
        const compact = sourceItems.length >= 25;
        const pageSize = sourceItems.length > 50
            ? [21.6 * 72 / 2.54, 33 * 72 / 2.54]
            : layout.page.size || 'letter';
        const pageLayout = {
            compact,
            margin: compact ? 24 : layout.page.margin
        };
        const doc = new PDFDocument({ margin: pageLayout.margin, size: pageSize });
        const writeStream = fs.createWriteStream(filePath);

        doc.pipe(writeStream);

        writeStream.on('finish', () => resolve(filePath));
        writeStream.on('error', reject);
        doc.on('error', reject);

        let y = compact ? 24 : layout.page.marginTop;

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
    const compact = pageLayout.compact;
    const margin = pageLayout.margin ?? layout.page.margin;
    let y = startY;

    // ----- Header -----
    const logoCfg = layout.logo || {};
    const defaultLogoW = logoCfg.width || 100;
    const defaultLogoH = logoCfg.height || 80;
    const printableWidth = doc.page.width - margin * 2;
    let headerTextX = margin;
    // drawW/drawH represent el tamaño efectivo que dibujaremos
    let drawW = defaultLogoW;
    let drawH = defaultLogoH;

    if (compact) {
        const maxLogoW = 44;
        const maxLogoH = 34;
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

    if (logoPath) {
        try {
            const img = doc.openImage(logoPath);
            const imgW = img.width || defaultLogoW;
            const imgH = img.height || defaultLogoH;

            const maxLogoW = Math.min(defaultLogoW || 150, Math.floor(printableWidth * (logoCfg.maxFraction || 0.22)));
            const maxLogoH = logoCfg.maxHeight || defaultLogoH;

            const wScale = maxLogoW / imgW;
            const hScale = maxLogoH / imgH;
            const scale = Math.min(1, wScale, hScale);

            drawW = Math.round(imgW * scale);
            drawH = Math.round(imgH * scale);

            // Calcular altura estimada del bloque de texto del membrete para centrar verticalmente el logo
            const companyName = cotizacion.empresa?.nombre || 'Empresa';
            // Medimos usando los mismos estilos que se aplicarán al texto
            doc.font('Helvetica-Bold').fontSize(layout.fonts.title || 20);
            const titleHeight = doc.heightOfString(companyName, { width: 300 });

            doc.font('Helvetica').fontSize(layout.fonts.small || 9);
            let contactHeight = 0;
            if (cotizacion.empresa?.telefono) contactHeight += 12;
            if (cotizacion.empresa?.email) contactHeight += 12;
            if (cotizacion.empresa?.direccion) contactHeight += doc.heightOfString(cotizacion.empresa.direccion, { width: 300 }) + 4;

            const textBlockHeight = titleHeight + contactHeight;

            // Alinear la parte superior del logo con el tope del membrete
            const logoY = startY;

            doc.image(logoPath, margin, logoY, { width: drawW, height: drawH });
            headerTextX += drawW + (logoCfg.spacing || 12);
        } catch (err) {
            console.warn('Could not load logo:', err.message);
        }
    }

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

function drawClientInfo(doc, cotizacion, startY, pageLayout = {}) {
    const margin = pageLayout.margin ?? layout.page.margin;
    const blockWidth = doc.page.width - margin * 2;
    if (pageLayout.compact) {
        let y = startY;
        const width = blockWidth;
        const clientLine = [
            `Cliente: ${cotizacion.cliente?.nombre || '—'}`,
            cotizacion.cliente?.telefono && `Tel: ${cotizacion.cliente.telefono}`,
            cotizacion.cliente?.rif && `CI/RIF: ${cotizacion.cliente.rif}`
        ].filter(Boolean).join('   |   ');
        const addressLine = `Dirección: ${cotizacion.cliente?.direccion || '—'}`;

        doc.font('Helvetica-Bold').fontSize(7.5).fillColor(layout.colors.header);
        doc.text('CLIENTE', margin, y, { width });
        y += 9;
        doc.font('Helvetica').fontSize(7).fillColor(layout.colors.text);
        doc.text(clientLine, margin, y, { width });
        y += doc.heightOfString(clientLine, { width, font: 'Helvetica', fontSize: 7 }) + 1;
        doc.text(addressLine, margin, y, { width });
        y += doc.heightOfString(addressLine, { width, font: 'Helvetica', fontSize: 7 }) + 4;
        return y;
    }
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

function drawServiceInfo(doc, cotizacion, startY, pageLayout = {}) {
    const tipo = cotizacion.tipoServicio;
    const v = cotizacion.vehiculo || {};

    if (!tipo && !v.vehiculo && !v.modelo && !v.placa && !v.marca && !v.serial) return startY;

    const margin = pageLayout.margin ?? layout.page.margin;
    const blockWidth = doc.page.width - margin * 2;
    if (pageLayout.compact) {
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
        const width = blockWidth;
        doc.font('Helvetica-Bold').fontSize(7.5).fillColor(layout.colors.header);
        doc.text(tipo === 'bomba_inyeccion' ? 'BOMBA DE INYECCIÓN' : 'VEHÍCULO', margin, startY, { width });
        doc.font('Helvetica').fontSize(7).fillColor(layout.colors.text);
        doc.text(text, margin, startY + 9, { width });
        return startY + 9 + doc.heightOfString(text, { width, font: 'Helvetica', fontSize: 7 }) + 4;
    }
    const padding = 10;
    const headerHeight = 16;

    const startCol = margin + padding;
    const maxTextWidth = blockWidth - padding * 2;

    let fields = [];
    if (tipo === 'bomba_inyeccion') {
        const marca = cotizacion.marcaBomba || v.marca || v.vehiculo || '—';
        const modeloVal = cotizacion.modeloBomba || v.modelo || '—';
        const serial = cotizacion.serialBomba || v.serial || v.placa || '—';
        const otroVal = cotizacion.otroBomba || cotizacion.otro || v.otroBomba || v.otro || '—';

        fields = [
            { label: 'Marca:', value: marca },
            { label: 'Modelo:', value: modeloVal },
            { label: 'Serial:', value: serial },
            { label: 'Otro:', value: otroVal }
        ];
    } else {
        fields = [
            { label: 'Vehículo:', value: v.vehiculo || '—' },
            { label: 'Modelo:', value: v.modelo || '—' },
            { label: 'Color:', value: v.color || '—' },
            { label: 'Placa:', value: v.placa || '—' }
        ];
    }

    // Calcular altura total requerida dinámicamente
    let contentHeight = headerHeight;
    const lineSpacing = 6; // Espaciado limpio entre líneas
    const dataFontSize = 9; // Igualar tamaño con tabla de items
    const fieldHeights = [];

    // Pre-medir altura de cada campo para evitar overlaps
    for (const field of fields) {
        doc.font('Helvetica-Bold').fontSize(dataFontSize);
        const text = `${field.label} ${field.value}`;
        const h = doc.heightOfString(text, { width: maxTextWidth });
        fieldHeights.push(h);
        contentHeight += h + lineSpacing;
    }

    contentHeight -= lineSpacing; // Remover el espaciado extra del último elemento

    const blockHeight = padding + contentHeight + padding;

    // Card-style background
    doc.roundedRect(margin, startY, blockWidth, blockHeight, 4)
        .fill(layout.table.headerBg)
        .strokeColor(layout.colors.border)
        .lineWidth(0.8)
        .stroke();

    let y = startY + padding;

    doc.font('Helvetica-Bold').fontSize(layout.fonts.subtitle || 12).fillColor(layout.colors.header);
    doc.text(tipo === 'bomba_inyeccion' ? 'DATOS DE LA BOMBA DE INYECCIÓN' : 'DATOS DEL VEHÍCULO', startCol, y);
    y += headerHeight;

    // Renderizar datos en formato de lista vertical
    doc.fontSize(dataFontSize).fillColor(layout.colors.text);

    for (let i = 0; i < fields.length; i++) {
        const field = fields[i];

        doc.font('Helvetica-Bold').text(field.label, startCol, y, { continued: true, width: maxTextWidth });
        doc.font('Helvetica').text(` ${field.value}`, { continued: false });

        y += fieldHeights[i] + lineSpacing;
    }

    return startY + blockHeight + 8;
}

function drawItemsTable(doc, cotizacion, startY, pageLayout = {}) {
    let y = startY;
    const compact = pageLayout.compact;
    const margin = pageLayout.margin ?? layout.page.margin;
    const pageWidth = doc.page.width;
    const innerWidth = pageWidth - margin * 2;

    const resumen = cotizacion.resumen || calcularResumenInMemory(cotizacion);
    const items = resumen.items || cotizacion.items || [];

    const wRef = compact ? 25 : 30;
    const wCant = compact ? 42 : 50;
    const wUnit = compact ? 64 : 70;
    const wTotal = compact ? 64 : 70;
    const wDesc = innerWidth - wRef - wCant - wUnit - wTotal;

    const headerFontSize = compact ? 7 : 8.5;
    const bodyFontSize = compact ? 7 : 9;
    const pad = compact ? 3 : (layout.table.colPadding || 6);

    const xRef = margin;
    const xDesc = xRef + wRef;
    const xCant = xDesc + wDesc;
    const xUnit = xCant + wCant;
    const xTot = xUnit + wUnit;

    const contentBottom = doc.page.height - margin - (compact ? 34 : (layout.footer?.marginTop || 24) + 20);
    const headerHeight = compact ? 15 : 22;
    const headerTextOffset = compact ? 4 : 6;
    const headerAfter = compact ? 18 : 26;

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
        const itemHeight = Math.max(
            compact ? 9 : 16,
            doc.heightOfString(itemText, { width: wDesc - pad * 2 }) + (compact ? 1 : 6)
        );

        const rowHeight = itemHeight;

        if (y + rowHeight > contentBottom) {
            drawFooter(doc, cotizacion, pageLayout);
            doc.addPage();
            y = drawTableHeader(compact ? margin : layout.page.marginTop);
        }

        doc.save();
        doc.rect(margin, y, innerWidth, rowHeight).fill(bg);
        doc.restore();

        const itemY = y + (compact ? 1 : 4);
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

function drawTotals(doc, cotizacion, startY, pageLayout = {}) {
    const resumen = cotizacion.resumen || calcularResumenInMemory(cotizacion);
    const compact = pageLayout.compact;
    let y = startY;
    const margin = pageLayout.margin ?? layout.page.margin;

    const contentBottom = doc.page.height - margin - (compact ? 34 : (layout.footer?.marginTop || 24) + 20);
    const totalsHeight = compact ? (resumen.aplicaIVA ? 52 : 40) : (resumen.aplicaIVA ? 76 : 60);
    if (y + totalsHeight > contentBottom) {
        drawFooter(doc, cotizacion, pageLayout);
        doc.addPage();
        y = compact ? margin : layout.page.marginTop;
    }

    const wTotalBlock = 220;
    const xTotalBlock = doc.page.width - margin - wTotalBlock;

    const fontSize = compact ? 8 : 10;
    const lineHeight = compact ? 11 : 16;
    doc.font('Helvetica').fontSize(fontSize).fillColor(layout.colors.text);

    // Subtotal
    doc.text('Subtotal:', xTotalBlock, y, { width: 100 });
    doc.text(formatMoney(resumen.subtotalGeneral), xTotalBlock + 100, y, { width: wTotalBlock - 100, align: 'right' });
    y += lineHeight;

    // IVA
    if (resumen.aplicaIVA) {
        doc.text(`IVA (${cotizacion.porcentajeIVA || 16}%):`, xTotalBlock, y, { width: 100 });
        doc.text(formatMoney(resumen.montoIVA), xTotalBlock + 100, y, { width: wTotalBlock - 100, align: 'right' });
        y += lineHeight;
    }

    y += compact ? 2 : 6;

    // Total destacado
    const totalBoxHeight = compact ? 22 : 42;
    doc.roundedRect(xTotalBlock - 4, y - 4, wTotalBlock + 8, totalBoxHeight, 5)
        .fill(layout.colors.brand);

    doc.font('Helvetica-Bold').fontSize(compact ? 10 : 14).fillColor('#ffffff');
    doc.text('TOTAL', xTotalBlock + 8, y + (compact ? 5 : 8), { width: 80 });
    doc.text(formatMoney(resumen.total), xTotalBlock + 90, y + (compact ? 5 : 8), {
        width: wTotalBlock - 98,
        align: 'right'
    });

    // Firma / aceptación
    // Asegurarse de que siempre haya un valor para 'elaboradoPor'
    const firmadoPor = cotizacion.elaboradoPor || 'Lariannys Villazana';
    const labelY = startY;
    const fecha = formatDate(cotizacion.fechaAceptacion || cotizacion.fechaEmision);

    doc.font('Helvetica').fontSize(compact ? 7 : layout.fonts.small).fillColor(layout.colors.light);
    doc.text('Aceptada, firma y/o sello:', margin, labelY);
    doc.font('Helvetica-Bold').fontSize(compact ? 8 : layout.fonts.body).fillColor(layout.colors.text);
    doc.text(firmadoPor, margin, labelY + (compact ? 9 : 12));

    if (fecha && fecha !== '—') {
        doc.font('Helvetica').fontSize(compact ? 7 : layout.fonts.small).fillColor(layout.colors.light);
        doc.text(`Fecha: ${fecha}`, margin, labelY + (compact ? 19 : 26));
    }

    return y + totalBoxHeight + 6;
}

function drawObservations(doc, cotizacion, startY, pageLayout = {}) {
    let y = startY;
    const compact = pageLayout.compact;
    const margin = pageLayout.margin ?? layout.page.margin;
    const rightMargin = doc.page.width - margin;
    const contentBottom = doc.page.height - margin - (compact ? 34 : (layout.footer?.marginTop || 24) + 20);
    const fontSize = compact ? 7 : 9;

    doc.font('Helvetica').fontSize(fontSize);
    const hasObs = Boolean(cotizacion.observaciones?.trim());
    const hasNotes = Boolean(cotizacion.notas?.trim());
    const texts = [
        ...(hasObs ? [cotizacion.observaciones] : []),
        ...(hasNotes ? [cotizacion.notas] : []),
        ...(!hasObs && !hasNotes ? ['Sin observaciones.'] : [])
    ];
    const observationsHeight = (compact ? 8 : 10) + texts.reduce(
        (height, text) => height + doc.heightOfString(text, { width: rightMargin - margin }) + (compact ? 3 : 8),
        0
    );

    if (y + observationsHeight > contentBottom && y > layout.page.marginTop) {
        drawFooter(doc, cotizacion, pageLayout);
        doc.addPage();
        y = compact ? margin : layout.page.marginTop;
    }

    doc.font('Helvetica-Bold').fontSize(compact ? 7.5 : 10).fillColor('#374151');
    doc.text('OBSERVACIONES:', margin, y);
    y += compact ? 8 : 10;

    doc.font('Helvetica').fontSize(fontSize).fillColor('#4b5563');

    if (hasObs) {
        doc.text(cotizacion.observaciones, margin, y, { width: rightMargin - margin });
        y += doc.heightOfString(cotizacion.observaciones, { width: rightMargin - margin }) + (compact ? 3 : 8);
    }

    if (hasNotes) {
        doc.text(cotizacion.notas, margin, y, { width: rightMargin - margin });
        y += doc.heightOfString(cotizacion.notas, { width: rightMargin - margin }) + (compact ? 3 : 8);
    }

    if (!hasObs && !hasNotes) {
        const defaultObs = 'Sin observaciones.';
        doc.text(defaultObs, margin, y, { width: rightMargin - margin });
        y += doc.heightOfString(defaultObs, { width: rightMargin - margin }) + (compact ? 3 : 8);
    }

    return y;
}

function drawFooter(doc, cotizacion, pageLayout = {}) {
    const compact = pageLayout.compact;
    const margin = pageLayout.margin ?? layout.page.margin;

    doc.font('Helvetica-Oblique').fontSize(compact ? 7 : (layout.footer?.noteSize || 9)).fillColor('#9ca3af');
    // Colocar el footer dentro del área imprimible para evitar creación automática
    // de una página adicional por parte de PDFKit cuando la Y está fuera del límite.
    const footerOffset = compact ? 18 : (layout.footer?.marginTop || 24);
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