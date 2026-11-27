import { resumenCotizacion } from '../lib/calculations'
import COMPANY from '../config/company'
import logoUrl from '../../../assets/logo.png'

const money = new Intl.NumberFormat('es-VE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const pt = value => value * 25.4 / 72

function formatDate(value) {
  if (!value) return '—'
  const [year, month, day] = String(value).split('T')[0].split('-')
  if (year && month && day) return `${day}/${month}/${year}`
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleDateString('es-VE', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

function formatMoney(value) {
  return money.format(Number(value) || 0)
}

function text(value, fallback = '—') {
  return value == null || value === '' ? fallback : String(value)
}

function loadLogo() {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('No se pudo cargar el logo del taller.'))
    image.src = logoUrl
  })
}

export async function createQuotationPdf(quote) {
  const [{ jsPDF }, logo] = await Promise.all([
    import('jspdf'),
    loadLogo(),
  ])
  const items = Array.isArray(quote.items) ? quote.items : []
  const compact = items.length >= 25
  const pdf = new jsPDF({
    unit: 'mm',
    format: items.length > 50 ? [216, 330] : 'letter',
  })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = pt(compact ? 24 : 40)
  const topMargin = pt(compact ? 24 : 50)
  const contentWidth = pageWidth - margin * 2
  const right = pageWidth - margin
  const footerTop = pageHeight - margin - pt(compact ? 18 : 24)
  const company = quote.empresa || COMPANY
  const resumen = resumenCotizacion(items, quote.aplicaIVA, quote.porcentajeIVA)
  let y = topMargin

  const setText = (font, size, color) => {
    pdf.setFont('helvetica', font)
    pdf.setFontSize(size)
    pdf.setTextColor(...color)
  }

  const drawWrapped = (value, x, top, width, font, size, color) => {
    setText(font, size, color)
    const lines = pdf.splitTextToSize(value, width)
    pdf.text(lines, x, top + pt(size), { maxWidth: width })
    return Math.max(1, lines.length) * pt(size * 1.15)
  }

  const addPage = () => {
    pdf.addPage()
    y = topMargin
  }

  const ensureSpace = height => {
    if (y + height > footerTop - pt(10)) addPage()
  }

  const drawClientInfo = startY => {
    if (compact) {
      const clientLine = [
        `Cliente: ${text(quote.cliente?.nombre)}`,
        quote.cliente?.telefono && `Tel: ${quote.cliente.telefono}`,
        quote.cliente?.rif && `CI/RIF: ${quote.cliente.rif}`,
      ].filter(Boolean).join('   |   ')
      const addressLine = `Dirección: ${text(quote.cliente?.direccion)}`

      setText('bold', 7.5, [30, 41, 59])
      pdf.text('CLIENTE', margin, startY)
      const clientTextHeight = drawWrapped(clientLine, margin, startY + pt(9), contentWidth, 'normal', 7, [71, 85, 105])
      const addressTextHeight = drawWrapped(addressLine, margin, startY + pt(10) + clientTextHeight, contentWidth, 'normal', 7, [71, 85, 105])
      return startY + pt(10) + clientTextHeight + addressTextHeight + pt(4)
    }

    const padding = pt(10)
    const blockHeight = pt(75)
    pdf.setDrawColor(203, 213, 225)
    pdf.setFillColor(241, 245, 249)
    pdf.setLineWidth(pt(0.8))
    pdf.roundedRect(margin, startY, contentWidth, blockHeight, pt(4), pt(4), 'FD')

    let fieldY = startY + padding
    setText('bold', 13, [30, 41, 59])
    pdf.text('DATOS DEL CLIENTE', margin + padding, fieldY + pt(13))
    fieldY += pt(16)

    const columnOne = margin + padding
    const columnTwo = pageWidth / 2 + padding
    const drawField = (label, value, x, top) => {
      setText('bold', 11, [71, 85, 105])
      pdf.text(label, x, top + pt(11))
      const labelWidth = pdf.getTextWidth(label) + pt(2)
      setText('normal', 11, [71, 85, 105])
      pdf.text(text(value), x + labelWidth, top + pt(11), { maxWidth: pt(190) })
    }

    drawField('Cliente:', quote.cliente?.nombre, columnOne, fieldY)
    drawField('Teléfono:', quote.cliente?.telefono, columnTwo, fieldY)
    fieldY += pt(14)
    drawField('CI/RIF:', quote.cliente?.rif, columnOne, fieldY)
    fieldY += pt(16)

    setText('bold', 8, [71, 85, 105])
    pdf.text('Dirección:', columnOne, fieldY + pt(8))
    setText('normal', 8, [71, 85, 105])
    pdf.text(` ${text(quote.cliente?.direccion)}`, columnOne + pt(39), fieldY + pt(8), {
      maxWidth: contentWidth - padding * 2 - pt(39),
    })

    return startY + blockHeight + pt(8)
  }

  const drawServiceInfo = startY => {
    const vehicle = quote.vehiculo && typeof quote.vehiculo === 'object'
      ? quote.vehiculo
      : {}
    const hasServiceData = quote.tipoServicio
      || vehicle.vehiculo
      || vehicle.modelo
      || vehicle.placa
      || vehicle.marca
      || vehicle.serial
      || quote.vehiculo
      || quote.modelo
      || quote.placa
      || quote.color
    if (!hasServiceData) return startY

    const fields = quote.tipoServicio === 'bomba_inyeccion'
      ? [
          { label: 'Marca:', value: quote.marcaBomba || vehicle.marca || vehicle.vehiculo },
          { label: 'Modelo:', value: quote.modeloBomba || vehicle.modelo },
          { label: 'Serial:', value: quote.serialBomba || vehicle.serial || vehicle.placa },
          { label: 'Otro:', value: quote.otroBomba || quote.otro || vehicle.otroBomba || vehicle.otro },
        ]
      : [
          { label: 'Vehículo:', value: vehicle.vehiculo || quote.vehiculo },
          { label: 'Modelo:', value: vehicle.modelo || quote.modelo },
          { label: 'Color:', value: vehicle.color || quote.color },
          { label: 'Placa:', value: vehicle.placa || quote.placa },
        ]

    if (compact) {
      const fieldText = fields.map(field => `${field.label.replace(/:$/, '')}: ${text(field.value)}`).join('   |   ')
      setText('bold', 7.5, [30, 41, 59])
      pdf.text(
        quote.tipoServicio === 'bomba_inyeccion' ? 'BOMBA DE INYECCIÓN' : 'VEHÍCULO',
        margin,
        startY,
      )
      const fieldsHeight = drawWrapped(fieldText, margin, startY + pt(9), contentWidth, 'normal', 7, [71, 85, 105])
      return startY + pt(9) + fieldsHeight + pt(4)
    }

    const padding = pt(10)
    const lineSpacing = pt(6)
    const headerHeight = pt(16)
    const maxTextWidth = contentWidth - padding * 2
    const fieldHeights = fields.map(field => {
      setText('bold', 9, [71, 85, 105])
      return Math.max(
        pt(9 * 1.15),
        pdf.splitTextToSize(`${field.label} ${text(field.value)}`, maxTextWidth).length * pt(9 * 1.15),
      )
    })
    const blockHeight = padding * 2 + headerHeight
      + fieldHeights.reduce((height, fieldHeight) => height + fieldHeight + lineSpacing, 0)
      - lineSpacing

    pdf.setDrawColor(203, 213, 225)
    pdf.setFillColor(241, 245, 249)
    pdf.setLineWidth(pt(0.8))
    pdf.roundedRect(margin, startY, contentWidth, blockHeight, pt(4), pt(4), 'FD')

    let fieldY = startY + padding
    setText('bold', 13, [30, 41, 59])
    pdf.text(
      quote.tipoServicio === 'bomba_inyeccion' ? 'DATOS DE LA BOMBA DE INYECCIÓN' : 'DATOS DEL VEHÍCULO',
      margin + padding,
      fieldY + pt(13),
    )
    fieldY += headerHeight

    fields.forEach((field, index) => {
      const lineCount = pdf.splitTextToSize(`${field.label} ${text(field.value)}`, maxTextWidth).length
      setText('bold', 9, [71, 85, 105])
      pdf.text(field.label, margin + padding, fieldY + pt(9))
      const labelWidth = pdf.getTextWidth(field.label)
      setText('normal', 9, [71, 85, 105])
      pdf.text(` ${text(field.value)}`, margin + padding + labelWidth, fieldY + pt(9), {
        maxWidth: maxTextWidth - labelWidth,
      })
      fieldY += Math.max(fieldHeights[index], lineCount * pt(9 * 1.15)) + lineSpacing
    })

    return startY + blockHeight + pt(8)
  }

  const itemTable = (startY) => {
    let tableY = startY
    const refWidth = pt(compact ? 25 : 30)
    const quantityWidth = pt(compact ? 42 : 50)
    const unitWidth = pt(compact ? 64 : 70)
    const totalWidth = pt(compact ? 64 : 70)
    const descriptionWidth = contentWidth - refWidth - quantityWidth - unitWidth - totalWidth
    const padding = pt(compact ? 3 : 6)
    const columns = [
      { title: 'REF', x: margin, width: refWidth, align: 'left' },
      { title: 'DESCRIPCIÓN', x: margin + refWidth, width: descriptionWidth, align: 'left' },
      { title: 'CANT.', x: margin + refWidth + descriptionWidth, width: quantityWidth, align: 'right' },
      { title: 'P. UNIT.', x: margin + refWidth + descriptionWidth + quantityWidth, width: unitWidth, align: 'right' },
      { title: 'TOTAL', x: right - totalWidth, width: totalWidth, align: 'right' },
    ]

    const drawHeader = () => {
      pdf.setFillColor(241, 245, 249)
      pdf.roundedRect(margin, tableY, contentWidth, pt(compact ? 15 : 22), pt(4), pt(4), 'F')
      setText('bold', compact ? 7 : 8.5, [30, 41, 59])
      for (const column of columns) {
        pdf.text(column.title, column.x + padding, tableY + pt(compact ? 10 : 15), {
          maxWidth: column.width - padding * 2,
          align: column.align,
        })
      }
      tableY += pt(compact ? 18 : 26)
    }

    drawHeader()
    items.forEach((item, index) => {
      const description = text(item.descripcion, '')
      setText('normal', compact ? 7 : 9, [71, 85, 105])
      const descriptionLines = pdf.splitTextToSize(description, descriptionWidth - padding * 2)
      const rowHeight = compact
        ? Math.max(pt(9), descriptionLines.length * pt(7 * 1.15) + pt(1))
        : Math.max(pt(16), descriptionLines.length * pt(10) + pt(6))
      if (tableY + rowHeight > footerTop - pt(compact ? 16 : 20)) {
        pdf.addPage()
        tableY = topMargin
        drawHeader()
      }

      if (index % 2 === 0) {
        pdf.setFillColor(248, 250, 252)
        pdf.rect(margin, tableY, contentWidth, rowHeight, 'F')
      }
      setText('normal', compact ? 7 : 9, [71, 85, 105])
      const textY = tableY + pt(compact ? 1 + 7 : 4 + 9)
      pdf.text(String(index + 1), columns[0].x + padding, textY, { maxWidth: columns[0].width - padding * 2 })
      pdf.text(descriptionLines, columns[1].x + padding, textY, { maxWidth: descriptionWidth - padding * 2 })
      pdf.text(text(item.cantidad, ''), columns[2].x + padding, textY, {
        maxWidth: columns[2].width - padding * 2,
        align: 'right',
      })
      pdf.text(formatMoney(item.precioBase), columns[3].x + padding, textY, {
        maxWidth: columns[3].width - padding * 2,
        align: 'right',
      })
      pdf.text(formatMoney(resumen.items[index]?.subtotal), columns[4].x + padding, textY, {
        maxWidth: columns[4].width - padding * 2,
        align: 'right',
      })
      tableY += rowHeight
    })

    return tableY + pt(compact ? 8 : 12)
  }

  const drawTotals = startY => {
    const totalHeight = pt(compact ? 22 : 42)
    const summaryHeight = pt(compact
      ? (resumen.aplicaIVA ? 30 : 19)
      : (resumen.aplicaIVA ? 54 : 38))
    ensureSpace(summaryHeight + totalHeight + pt(compact ? 12 : 20))
    const totalsY = y || startY
    const totalBlockWidth = pt(220)
    const totalBlockX = pageWidth - margin - totalBlockWidth
    let totalsLineY = totalsY

    const fontSize = compact ? 8 : 10
    const lineHeight = compact ? 11 : 16
    setText('normal', fontSize, [71, 85, 105])
    pdf.text('Subtotal:', totalBlockX, totalsLineY + pt(compact ? 8 : 10), { maxWidth: pt(100) })
    pdf.text(formatMoney(resumen.subtotalGeneral), totalBlockX + pt(100), totalsLineY + pt(compact ? 8 : 10), {
      maxWidth: totalBlockWidth - pt(100),
      align: 'right',
    })
    totalsLineY += pt(lineHeight)

    if (resumen.aplicaIVA) {
      pdf.text(`IVA (${quote.porcentajeIVA || 16}%):`, totalBlockX, totalsLineY + pt(compact ? 8 : 10), { maxWidth: pt(100) })
      pdf.text(formatMoney(resumen.montoIVA), totalBlockX + pt(100), totalsLineY + pt(compact ? 8 : 10), {
        maxWidth: totalBlockWidth - pt(100),
        align: 'right',
      })
      totalsLineY += pt(lineHeight)
    }
    totalsLineY += pt(compact ? 2 : 6)

    pdf.setFillColor(5, 150, 105)
    pdf.roundedRect(totalBlockX - pt(4), totalsLineY - pt(4), totalBlockWidth + pt(8), totalHeight, pt(5), pt(5), 'F')
    setText('bold', compact ? 10 : 14, [255, 255, 255])
    pdf.text('TOTAL', totalBlockX + pt(8), totalsLineY + pt(compact ? 14 : 22))
    pdf.text(formatMoney(resumen.total), totalBlockX + totalBlockWidth - pt(8), totalsLineY + pt(compact ? 14 : 22), {
      align: 'right',
    })

    const signer = quote.elaboradoPor || 'Lariannys Villazana'
    const signatureY = totalsY
    setText('normal', compact ? 7 : 9, [148, 163, 184])
    pdf.text('Aceptada, firma y/o sello:', margin, signatureY + pt(compact ? 7 : 9))
    setText('bold', compact ? 8 : 11, [71, 85, 105])
    pdf.text(signer, margin, signatureY + pt(compact ? 17 : 23), { maxWidth: pt(180) })
    const acceptedDate = formatDate(quote.fechaAceptacion || quote.fechaEmision)
    if (acceptedDate !== '—') {
      setText('normal', compact ? 7 : 9, [148, 163, 184])
      pdf.text(`Fecha: ${acceptedDate}`, margin, signatureY + pt(compact ? 27 : 35))
    }

    y = totalsLineY + totalHeight + pt(6)
  }

  const drawObservations = () => {
    if (compact) {
      const observation = quote.observaciones?.trim() || quote.notas?.trim() || 'Sin observaciones.'
      setText('normal', 7, [75, 85, 99])
      const lines = pdf.splitTextToSize(observation, contentWidth)
      const observationHeight = pt(8 + lines.length * 7 * 1.15 + 3)
      ensureSpace(observationHeight)
    } else if (y > footerTop - pt(80)) {
      addPage()
    }

    setText('bold', compact ? 7.5 : 10, [55, 65, 81])
    pdf.text('OBSERVACIONES:', margin, y + pt(compact ? 8 : 10))
    y += pt(compact ? 8 : 10)
    const observation = quote.observaciones?.trim() || quote.notas?.trim() || 'Sin observaciones.'
    const lines = pdf.splitTextToSize(observation, contentWidth)
    setText('normal', compact ? 7 : 9, [75, 85, 99])
    pdf.text(lines, margin, y + pt(compact ? 7 : 9), { maxWidth: contentWidth })
  }

  const drawFooter = () => {
    const pageCount = pdf.getNumberOfPages()
    for (let page = 1; page <= pageCount; page += 1) {
      pdf.setPage(page)
      setText('italic', compact ? 7 : 9, [156, 163, 175])
      pdf.text('Gracias por su preferencia', pageWidth / 2, footerTop, { align: 'center' })
    }
  }

  const logoMaxWidth = Math.min(pt(compact ? 44 : 120), contentWidth * 0.22)
  const logoMaxHeight = pt(compact ? 34 : 120)
  const logoScale = Math.min(1, logoMaxWidth / logo.naturalWidth, logoMaxHeight / logo.naturalHeight)
  const logoWidth = logo.naturalWidth * logoScale
  const logoHeight = logo.naturalHeight * logoScale
  const headerTextX = margin + logoWidth + pt(compact ? 7 : 12)
  const metadataX = right - pt(compact ? 180 : 160)
  const companyTextWidth = Math.max(pt(compact ? 130 : 120), metadataX - headerTextX - pt(compact ? 8 : 12))

  pdf.addImage(logo, 'PNG', margin, y, logoWidth, logoHeight)
  const companyName = company.nombre || 'Empresa'
  const titleHeight = drawWrapped(companyName, headerTextX, y, companyTextWidth, 'bold', compact ? 12 : 22, [30, 41, 59])
  let companyY = y + titleHeight + pt(compact ? 2 : 4)
  if (compact) {
    const contacts = [
      company.telefono && `Tel: ${company.telefono}`,
      company.email,
    ].filter(Boolean).join(' | ')
    if (contacts) {
      setText('normal', 7, [148, 163, 184])
      const contactLines = pdf.splitTextToSize(contacts, companyTextWidth)
      pdf.text(contactLines, headerTextX, companyY + pt(7), { maxWidth: companyTextWidth })
      companyY += contactLines.length * pt(7 * 1.15) + pt(1)
    }
  } else {
    for (const [label, value] of [
      ['Teléfono:', company.telefono],
      ['Email:', company.email],
    ]) {
      if (!value) continue
      setText('normal', 9, [148, 163, 184])
      pdf.text(`${label} ${value}`, headerTextX, companyY + pt(9))
      companyY += pt(12)
    }
  }
  if (company.direccion) {
    const addressHeight = drawWrapped(
      company.direccion,
      headerTextX,
      companyY,
      companyTextWidth,
      'normal',
      compact ? 7 : 9,
      [148, 163, 184],
    )
    companyY += addressHeight + pt(compact ? 1 : 4)
  }

  const number = String(quote.numero ?? 0).padStart(7, '0')
  setText('bold', compact ? 14 : 22, [5, 150, 105])
  pdf.text('COTIZACIÓN', right, y + pt(compact ? 14 : 22), { align: 'right' })
  setText('bold', compact ? 10 : 13, [71, 85, 105])
  pdf.text(`# ${number}`, right, y + pt(compact ? 26 : 35), { align: 'right' })
  setText('bold', compact ? 7 : 9, [71, 85, 105])
  pdf.text(compact ? 'Emisión:' : 'Fecha de Emisión:', metadataX, y + pt(compact ? 39 : 59))
  setText('normal', compact ? 7 : 9, [71, 85, 105])
  pdf.text(formatDate(quote.fechaEmision), right, y + pt(compact ? 39 : 59), { align: 'right' })
  let dateY = y + pt(compact ? 49 : 74)
  if (quote.fechaVencimiento) {
    setText('bold', compact ? 7 : 9, [71, 85, 105])
    pdf.text('Vencimiento:', metadataX, dateY)
    setText('normal', compact ? 7 : 9, [71, 85, 105])
    pdf.text(formatDate(quote.fechaVencimiento), right, dateY, { align: 'right' })
    dateY += pt(compact ? 11 : 20)
  }

  y = Math.max(companyY, y + logoHeight, dateY) + pt(compact ? 4 : 15)
  pdf.setDrawColor(203, 213, 225)
  pdf.setLineWidth(pt(compact ? 0.7 : 1))
  pdf.line(margin, y, right, y)
  y += pt(compact ? 5 : 15)

  y = drawClientInfo(y)
  y = drawServiceInfo(y)
  y = itemTable(y)
  drawTotals(y)
  drawObservations()
  drawFooter()

  return pdf
}

export async function downloadQuotationPdf(quote) {
  const pdf = await createQuotationPdf(quote)
  pdf.save(`cotizacion-${String(quote.numero).padStart(7, '0')}.pdf`)
}
