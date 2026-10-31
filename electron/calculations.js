/**
 * Lógica de negocio para cálculos de cotizaciones.
 * Funciones puras: subtotales, IVA y total.
 */

/**
 * Calcula el subtotal de un ítem (precioBase * cantidad)
 * @param {number} precioBase
 * @param {number} cantidad
 * @returns {number}
 */
function subtotalItem(precioBase, cantidad) {
  console.log(`Procesando ítem -> Precio: ${precioBase} (tipo: ${typeof precioBase}), Cantidad: ${cantidad} (tipo: ${typeof cantidad})`);
  const base = Number(precioBase) || 0;
  const cant = Number(cantidad) || 0;
  return Math.round(base * cant * 100) / 100;
}

/**
 * Calcula subtotales para cada ítem y la sumatoria
 * @param {Array<{ descripcion: string, precioBase: number, cantidad: number }>} items
 * @returns {{ items: Array<{...}>, subtotalGeneral: number }}
 */
function calcularSubtotales(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return { items: [], subtotalGeneral: 0 };
  }
  const itemsConSubtotal = items.map((item) => ({
    ...item,
    subtotal: subtotalItem(item.precioBase, item.cantidad),
  }));
  const subtotalGeneral = itemsConSubtotal.reduce(
    (sum, item) => sum + item.subtotal,
    0
  );
  return {
    items: itemsConSubtotal,
    subtotalGeneral: Math.round(subtotalGeneral * 100) / 100,
  };
}

/** Porcentaje de IVA por defecto (ej. Venezuela 16%) */
const IVA_PORCENTAJE_DEFAULT = 16;

/**
 * Calcula el monto de IVA sobre un base
 * @param {number} baseImponible
 * @param {number} [porcentaje=IVA_PORCENTAJE_DEFAULT]
 * @returns {number}
 */
function calcularIVA(baseImponible, porcentaje = IVA_PORCENTAJE_DEFAULT) {
  const base = Number(baseImponible) || 0;
  const pct = Number(porcentaje) || 0;
  return Math.round((base * pct) / 100 * 100) / 100;
}

/**
 * Calcula total general: subtotal + IVA (si aplica IVA)
 * @param {number} subtotalGeneral
 * @param {boolean} aplicaIVA
 * @param {number} [porcentajeIVA=IVA_PORCENTAJE_DEFAULT]
 * @returns {{ subtotal: number, montoIVA: number, total: number, aplicaIVA: boolean }}
 */
function calcularTotal(subtotalGeneral, aplicaIVA, porcentajeIVA = IVA_PORCENTAJE_DEFAULT) {
  const subtotal = Number(subtotalGeneral) || 0;
  const montoIVA = aplicaIVA ? calcularIVA(subtotal, porcentajeIVA) : 0;
  const total = Math.round((subtotal + montoIVA) * 100) / 100;
  return {
    subtotal,
    montoIVA,
    total,
    aplicaIVA: Boolean(aplicaIVA),
  };
}

/**
 * Resumen completo de cálculos para una cotización
 * @param {Array<{ descripcion: string, precioBase: number, cantidad: number }>} items
 * @param {boolean} aplicaIVA
 * @param {number} [porcentajeIVA=IVA_PORCENTAJE_DEFAULT]
 */
function resumenCotizacion(items, aplicaIVA, porcentajeIVA = IVA_PORCENTAJE_DEFAULT) {
  const { items: itemsConSubtotal, subtotalGeneral } = calcularSubtotales(items);
  const totales = calcularTotal(subtotalGeneral, aplicaIVA, porcentajeIVA);
  return {
    items: itemsConSubtotal,
    subtotalGeneral: totales.subtotal,
    montoIVA: totales.montoIVA,
    total: totales.total,
    aplicaIVA: totales.aplicaIVA,
  };
}

module.exports = {
  subtotalItem,
  calcularSubtotales,
  calcularIVA,
  calcularTotal,
  resumenCotizacion,
  IVA_PORCENTAJE_DEFAULT,
};
