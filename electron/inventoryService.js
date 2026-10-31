/**
 * inventoryService.js
 * Capa de lógica de negocio. Orquesta validaciones y operaciones de base de datos.
 */

const repo = require('./inventoryRepository');
const { validateProductData } = require('./inventoryValidators');

function getProducts(searchTerm = '') {
    try {
        const products = repo.getAll(searchTerm);
        
        // Calcular estadísticas rápidas
        const stats = {
            total: products.length,
            agotados: 0,
            bajoStock: 0,
            valorTotal: 0
        };

        products.forEach(p => {
            if (p.stock <= 0) {
                stats.agotados++;
            } else if (p.stock <= p.stockMinimo) {
                stats.bajoStock++;
            }
            stats.valorTotal += (p.stock * p.precioVenta);
        });

        return { success: true, data: products, stats };
    } catch (error) {
        console.error('Error en getProducts:', error);
        return { success: false, error: 'Error al obtener los productos.' };
    }
}

function getProduct(id) {
    try {
        const product = repo.getById(id);
        if (!product) return { success: false, error: 'Producto no encontrado.' };
        return { success: true, data: product };
    } catch (error) {
        console.error('Error en getProduct:', error);
        return { success: false, error: 'Error al obtener el producto.' };
    }
}

function createProduct(data) {
    try {
        const { isValid, errors } = validateProductData(data);
        if (!isValid) {
            return { success: false, error: errors.join(' ') };
        }

        // Verificar si el código ya existe
        const existingCode = repo.getByCodigo(data.codigo.trim());
        if (existingCode) {
            return { success: false, error: 'El código de producto ya está en uso.' };
        }

        const product = repo.create(data);
        return { success: true, data: product };
    } catch (error) {
        console.error('Error en createProduct:', error);
        return { success: false, error: 'Error interno al crear el producto.' };
    }
}

function updateProduct(id, data) {
    try {
        const { isValid, errors } = validateProductData(data);
        if (!isValid) {
            return { success: false, error: errors.join(' ') };
        }

        // Verificar si el código ya existe en otro producto
        const existingCode = repo.getByCodigo(data.codigo.trim());
        if (existingCode && existingCode.id !== id) {
            return { success: false, error: 'El código de producto ya está en uso por otro artículo.' };
        }

        const product = repo.update(id, data);
        if (!product) {
            return { success: false, error: 'Producto no encontrado.' };
        }

        return { success: true, data: product };
    } catch (error) {
        console.error('Error en updateProduct:', error);
        return { success: false, error: 'Error interno al actualizar el producto.' };
    }
}

function deleteProduct(id) {
    try {
        const success = repo.softDelete(id);
        if (!success) {
            return { success: false, error: 'No se pudo eliminar el producto o no existe.' };
        }
        return { success: true };
    } catch (error) {
        console.error('Error en deleteProduct:', error);
        return { success: false, error: 'Error interno al eliminar el producto.' };
    }
}

function updateStock(id, newStock) {
    try {
        const numericStock = parseFloat(newStock);
        if (isNaN(numericStock) || numericStock < 0) {
            return { success: false, error: 'El stock debe ser un número válido y no negativo.' };
        }

        const product = repo.updateStock(id, numericStock);
        if (!product) {
            return { success: false, error: 'Producto no encontrado.' };
        }
        
        return { success: true, data: product };
    } catch (error) {
        console.error('Error en updateStock:', error);
        return { success: false, error: 'Error interno al actualizar el stock.' };
    }
}

module.exports = {
    getProducts,
    getProduct,
    createProduct,
    updateProduct,
    deleteProduct,
    updateStock
};
