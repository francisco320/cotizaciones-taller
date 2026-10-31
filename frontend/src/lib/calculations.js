/**
 * Misma lógica de cálculos que el backend (funciones puras).
 */

function subtotalItem(precioBase, cantidad) {
  const base = Number(precioBase) || 0
  const cant = Number(cantidad) || 0
  return Math.round(base * cant * 100) / 100
}

function calcularSubtotales(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return { items: [], subtotalGeneral: 0 }
  }
  const itemsConSubtotal = items.map((item) => ({
    ...item,
    subtotal: subtotalItem(item.precioBase, item.cantidad),
  }))
  const subtotalGeneral = itemsConSubtotal.reduce((sum, item) => sum + item.subtotal, 0)
  return {
    items: itemsConSubtotal,
    subtotalGeneral: Math.round(subtotalGeneral * 100) / 100,
  }
}

const IVA_PORCENTAJE_DEFAULT = 16

function calcularIVA(baseImponible, porcentaje = IVA_PORCENTAJE_DEFAULT) {
  const base = Number(baseImponible) || 0
  const pct = Number(porcentaje) || 0
  return Math.round((base * pct) / 100 * 100) / 100
}

function calcularTotal(subtotalGeneral, aplicaIVA, porcentajeIVA = IVA_PORCENTAJE_DEFAULT) {
  const subtotal = Number(subtotalGeneral) || 0
  const montoIVA = aplicaIVA ? calcularIVA(subtotal, porcentajeIVA) : 0
  const total = Math.round((subtotal + montoIVA) * 100) / 100
  return { subtotal, montoIVA, total, aplicaIVA: Boolean(aplicaIVA) }
}

export function resumenCotizacion(items, aplicaIVA, porcentajeIVA = IVA_PORCENTAJE_DEFAULT) {
  const { items: itemsConSubtotal, subtotalGeneral } = calcularSubtotales(items)
  const totales = calcularTotal(subtotalGeneral, aplicaIVA, porcentajeIVA)
  return {
    items: itemsConSubtotal,
    subtotalGeneral: totales.subtotal,
    montoIVA: totales.montoIVA,
    total: totales.total,
    aplicaIVA: totales.aplicaIVA,
  }
}
