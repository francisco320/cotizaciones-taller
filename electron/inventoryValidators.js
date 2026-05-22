/**
 * inventoryValidators.js
 * Validaciones para los datos de entrada del inventario.
 */

function validateProductData(data) {
    const errors = [];

    if (!data.codigo || typeof data.codigo !== 'string' || data.codigo.trim() === '') {
        errors.push('El código del producto es obligatorio.');
    }

    if (!data.nombre || typeof data.nombre !== 'string' || data.nombre.trim() === '') {
        errors.push('El nombre del producto es obligatorio.');
    }

    if (data.stock !== undefined && (isNaN(data.stock) || data.stock < 0)) {
        errors.push('El stock no puede ser negativo.');
    }

    if (data.stockMinimo !== undefined && (isNaN(data.stockMinimo) || data.stockMinimo < 0)) {
        errors.push('El stock mínimo no puede ser negativo.');
    }

    if (data.precioCompra !== undefined && (isNaN(data.precioCompra) || data.precioCompra < 0)) {
        errors.push('El precio de compra no puede ser negativo.');
    }

    if (data.precioVenta !== undefined && (isNaN(data.precioVenta) || data.precioVenta < 0)) {
        errors.push('El precio de venta no puede ser negativo.');
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}

module.exports = {
    validateProductData
};
