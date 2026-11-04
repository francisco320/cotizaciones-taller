import { resumenCotizacion } from '../lib/calculations'
import COMPANY from '../config/company'

const money = new Intl.NumberFormat('es-VE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function formatDate(value) {
  if (!value) return '—'
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T12:00:00`)
    : new Date(value)
  return Number.isNaN(date.getTime())
    ? String(value)
    : new Intl.DateTimeFormat('es-VE', { dateStyle: 'medium' }).format(date)
}

function formatMoney(value) {
  return money.format(Number(value) || 0)
}

function text(value, fallback = '—') {
  return value == null || value === '' ? fallback : String(value)
}

export async function createQuotationPdf(quote) {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ unit: 'mm', format: 'letter' })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 16
  const contentWidth = pageWidth - margin * 2
  const right = pageWidth - margin
  const items = Array.isArray(quote.items) ? quote.items : []
  const resumen = resumenCotizacion(items, quote.aplicaIVA, quote.porcentajeIVA)
  let y = margin

  const drawDivider = (position) => {
    pdf.setDrawColor(203, 213, 225)
    pdf.line(margin, position, right, position)
  }

  const ensureSpace = (height) => {
    if (y + height > pageHeight - margin) {
      pdf.addPage()
      y = margin
      return true
    }
    return false
  }

  const drawSectionTitle = (title) => {
    ensureSpace(12)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(11)
    pdf.setTextColor(15, 118, 110)
    pdf.text(title.toUpperCase(), margin, y)
    y += 6
  }

  const drawField = (label, value, width = contentWidth) => {
    const lines = pdf.splitTextToSize(`${label}: ${text(value)}`, width)
    ensureSpace(lines.length * 5 + 2)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9.5)
    pdf.setTextColor(51, 65, 85)
    pdf.text(lines, margin, y)
    y += lines.length * 5 + 1
  }

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(17)
  pdf.setTextColor(30, 41, 59)
  pdf.text(COMPANY.nombre, margin, y)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.setTextColor(71, 85, 105)
  y += 6
  pdf.text(`RIF ${COMPANY.rif}  ·  ${COMPANY.telefono}  ·  ${COMPANY.email}`, margin, y)
  y += 5
  const companyAddress = pdf.splitTextToSize(COMPANY.direccion, contentWidth)
  pdf.text(companyAddress, margin, y)
  y += companyAddress.length * 4 + 5

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(17)
  pdf.setTextColor(15, 118, 110)
  pdf.text('COTIZACIÓN', right, margin + 2, { align: 'right' })
  pdf.setFontSize(12)
  pdf.setTextColor(30, 41, 59)
  pdf.text(`# ${String(quote.numero).padStart(7, '0')}`, right, margin + 9, { align: 'right' })
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8.5)
  pdf.setTextColor(71, 85, 105)
  pdf.text(`Emisión: ${formatDate(quote.fechaEmision)}`, right, margin + 15, { align: 'right' })
  if (quote.fechaVencimiento) {
    pdf.text(`Vence: ${formatDate(quote.fechaVencimiento)}`, right, margin + 20, { align: 'right' })
  }

  y = Math.max(y, margin + 24) + 2
  drawDivider(y)
  y += 7

  drawSectionTitle('Datos del cliente')
  drawField('Nombre', quote.cliente?.nombre)
  if (quote.cliente?.rif) drawField('RIF / CI', quote.cliente.rif)
  if (quote.cliente?.telefono) drawField('Teléfono', quote.cliente.telefono)
  if (quote.cliente?.direccion) drawField('Dirección', quote.cliente.direccion)
  y += 2

  drawSectionTitle(quote.tipoServicio === 'bomba_inyeccion' ? 'Bomba de inyección' : 'Vehículo')
  if (quote.tipoServicio === 'bomba_inyeccion') {
    drawField('Marca', quote.marcaBomba)
    drawField('Modelo', quote.modeloBomba)
    drawField('Serial', quote.serialBomba)
    if (quote.otroBomba) drawField('Otro', quote.otroBomba)
  } else {
    drawField('Vehículo', quote.vehiculo)
    drawField('Modelo', quote.modelo)
    drawField('Placa', quote.placa)
    drawField('Color', quote.color)
  }
  y += 2

  drawSectionTitle('Trabajos y repuestos')
  const refWidth = 12
  const quantityWidth = 22
  const unitWidth = 34
  const totalWidth = 36
  const descriptionWidth = contentWidth - refWidth - quantityWidth - unitWidth - totalWidth
  const columns = [
    { title: 'REF', x: margin, width: refWidth, align: 'left' },
    { title: 'DESCRIPCIÓN', x: margin + refWidth, width: descriptionWidth, align: 'left' },
    { title: 'CANT.', x: margin + refWidth + descriptionWidth, width: quantityWidth, align: 'right' },
    { title: 'P. UNIT.', x: margin + refWidth + descriptionWidth + quantityWidth, width: unitWidth, align: 'right' },
    { title: 'TOTAL', x: right - totalWidth, width: totalWidth, align: 'right' },
  ]

  const drawItemsHeader = () => {
    pdf.setFillColor(241, 245, 249)
    pdf.roundedRect(margin, y - 4, contentWidth, 8, 1.5, 1.5, 'F')
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(8)
    pdf.setTextColor(30, 41, 59)
    for (const column of columns) {
      pdf.text(column.title, column.x + 1, y + 1, {
        maxWidth: column.width - 2,
        align: column.align,
      })
    }
    y += 8
  }

  drawItemsHeader()
  for (const [index, item] of items.entries()) {
    const descriptionLines = pdf.splitTextToSize(
      text(item.descripcion),
      descriptionWidth - 3,
    )
    const rowHeight = Math.max(7, descriptionLines.length * 4.5 + 2)
    if (y + rowHeight > pageHeight - margin - 48) {
      pdf.addPage()
      y = margin
      drawItemsHeader()
    }
    if (index % 2 === 0) {
      pdf.setFillColor(248, 250, 252)
      pdf.rect(margin, y - 3, contentWidth, rowHeight, 'F')
    }

    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8.5)
    pdf.setTextColor(51, 65, 85)
    pdf.text(String(index + 1), columns[0].x + 1, y)
    pdf.text(descriptionLines, columns[1].x + 1, y)
    pdf.text(text(item.cantidad), columns[2].x + columns[2].width - 1, y, { align: 'right' })
    pdf.text(formatMoney(item.precioBase), columns[3].x + columns[3].width - 1, y, { align: 'right' })
    pdf.text(formatMoney(resumen.items[index]?.subtotal), columns[4].x + columns[4].width - 1, y, { align: 'right' })
    y += rowHeight
  }

  y += 7
  ensureSpace(44)
  const totalsX = right - 76
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9.5)
  pdf.setTextColor(71, 85, 105)
  pdf.text('Subtotal', totalsX, y)
  pdf.text(formatMoney(resumen.subtotalGeneral), right, y, { align: 'right' })
  y += 6
  if (resumen.aplicaIVA) {
    pdf.text(`IVA (${Number(quote.porcentajeIVA) || 0}%)`, totalsX, y)
    pdf.text(formatMoney(resumen.montoIVA), right, y, { align: 'right' })
    y += 6
  }

  pdf.setFillColor(15, 118, 110)
  pdf.roundedRect(totalsX - 2, y - 3, right - totalsX + 2, 12, 2, 2, 'F')
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(11)
  pdf.setTextColor(255, 255, 255)
  pdf.text('TOTAL', totalsX + 2, y + 4)
  pdf.text(formatMoney(resumen.total), right - 2, y + 4, { align: 'right' })
  y += 16

  if (quote.elaboradoPor) drawField('Elaborado por', quote.elaboradoPor)
  if (quote.observaciones) {
    y += 2
    drawSectionTitle('Observaciones')
    drawField('', quote.observaciones)
  }

  const pageCount = pdf.getNumberOfPages()
  for (let page = 1; page <= pageCount; page += 1) {
    pdf.setPage(page)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)
    pdf.setTextColor(148, 163, 184)
    pdf.text(
      `Cotización #${String(quote.numero).padStart(7, '0')}  ·  Página ${page} de ${pageCount}`,
      pageWidth / 2,
      pageHeight - 8,
      { align: 'center' },
    )
  }

  return pdf
}

export async function downloadQuotationPdf(quote) {
  const pdf = await createQuotationPdf(quote)
  pdf.save(`cotizacion-${String(quote.numero).padStart(7, '0')}.pdf`)
}
