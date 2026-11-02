/**
 * inventoryRepository.js
 * Capa de acceso a datos (SQLite) para productos.
 */

const { randomUUID } = require('crypto')
const { db } = require('./database');
const { enqueueChange } = require('./syncQueue')

function getAll(searchTerm = '') {
    const query = `
        SELECT * FROM productos 
        WHERE activo = 1 AND deletedAt IS NULL
        AND (nombre LIKE @search OR codigo LIKE @search OR categoria LIKE @search)
        ORDER BY nombre ASC
    `;
    return db.prepare(query).all({ search: `%${searchTerm}%` });
}

function getById(id) {
    return db.prepare('SELECT * FROM productos WHERE id = ?').get(id);
}

function getByCodigo(codigo) {
    return db.prepare('SELECT * FROM productos WHERE codigo = ?').get(codigo);
}

function create(data) {
    const now = new Date().toISOString();
    const insert = db.prepare(`
        INSERT INTO productos (
            codigo, nombre, categoria, descripcion, stock, stockMinimo, 
            precioCompra, precioVenta, proveedor, ubicacion, activo, createdAt, updatedAt, cloudId
        ) VALUES (
            @codigo, @nombre, @categoria, @descripcion, @stock, @stockMinimo,
            @precioCompra, @precioVenta, @proveedor, @ubicacion, @activo, @createdAt, @updatedAt, @cloudId
        )
    `);

    const createProduct = db.transaction(() => {
        const info = insert.run({
            codigo: data.codigo.trim(),
            nombre: data.nombre.trim(),
            categoria: data.categoria || null,
            descripcion: data.descripcion || null,
            stock: parseFloat(data.stock || 0),
            stockMinimo: parseFloat(data.stockMinimo || 0),
            precioCompra: parseFloat(data.precioCompra || 0),
            precioVenta: parseFloat(data.precioVenta || 0),
            proveedor: data.proveedor || null,
            ubicacion: data.ubicacion || null,
            activo: 1,
            createdAt: now,
            updatedAt: now,
            cloudId: randomUUID(),
        })
        enqueueChange(db, 'productos', info.lastInsertRowid, 'INSERT')
        return info.lastInsertRowid
    });

    return getById(createProduct());
}

function update(id, data) {
    const existing = getById(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const updateQuery = db.prepare(`
        UPDATE productos SET
            codigo = @codigo,
            nombre = @nombre,
            categoria = @categoria,
            descripcion = @descripcion,
            stock = @stock,
            stockMinimo = @stockMinimo,
            precioCompra = @precioCompra,
            precioVenta = @precioVenta,
            proveedor = @proveedor,
            ubicacion = @ubicacion,
            activo = @activo,
            deletedAt = @deletedAt,
            version = version + 1,
            updatedAt = @updatedAt
        WHERE id = @id
    `);

    const updateProduct = db.transaction(() => {
        const deletedAt = data.activo !== undefined
            ? (data.activo ? null : (existing.deletedAt || now))
            : existing.deletedAt
        updateQuery.run({
            id,
            codigo: data.codigo !== undefined ? data.codigo.trim() : existing.codigo,
            nombre: data.nombre !== undefined ? data.nombre.trim() : existing.nombre,
            categoria: data.categoria !== undefined ? data.categoria : existing.categoria,
            descripcion: data.descripcion !== undefined ? data.descripcion : existing.descripcion,
            stock: data.stock !== undefined ? parseFloat(data.stock) : existing.stock,
            stockMinimo: data.stockMinimo !== undefined ? parseFloat(data.stockMinimo) : existing.stockMinimo,
            precioCompra: data.precioCompra !== undefined ? parseFloat(data.precioCompra) : existing.precioCompra,
            precioVenta: data.precioVenta !== undefined ? parseFloat(data.precioVenta) : existing.precioVenta,
            proveedor: data.proveedor !== undefined ? data.proveedor : existing.proveedor,
            ubicacion: data.ubicacion !== undefined ? data.ubicacion : existing.ubicacion,
            activo: data.activo !== undefined ? data.activo : existing.activo,
            deletedAt,
            updatedAt: now
        });
        enqueueChange(
            db,
            'productos',
            id,
            deletedAt ? 'DELETE' : 'UPDATE',
        )
    })
    updateProduct()

    return getById(id);
}

function updateStock(id, newStock) {
    if (newStock < 0) throw new Error("El stock no puede ser negativo");
    
    const now = new Date().toISOString();
    const updateQuery = db.prepare(`
        UPDATE productos SET
            stock = @stock, updatedAt = @updatedAt, version = version + 1
        WHERE id = @id AND deletedAt IS NULL
    `);
    
    const updateStock = db.transaction(() => {
        const info = updateQuery.run({ id, stock: newStock, updatedAt: now })
        if (info.changes > 0) enqueueChange(db, 'productos', id, 'UPDATE')
        return info.changes > 0
    })
    if (!updateStock()) return null
    return getById(id);
}

function softDelete(id) {
    const now = new Date().toISOString();
    const softDeleteProduct = db.transaction(() => {
        const info = db.prepare(`
            UPDATE productos
            SET activo = 0, deletedAt = ?, updatedAt = ?, version = version + 1
            WHERE id = ? AND deletedAt IS NULL
        `).run(now, now, id)
        if (info.changes > 0) enqueueChange(db, 'productos', id, 'DELETE')
        return info.changes > 0
    })
    return softDeleteProduct()
}

module.exports = {
    getAll,
    getById,
    getByCodigo,
    create,
    update,
    updateStock,
    softDelete
};
