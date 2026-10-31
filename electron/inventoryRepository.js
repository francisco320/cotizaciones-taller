/**
 * inventoryRepository.js
 * Capa de acceso a datos (SQLite) para productos.
 */

const { db } = require('./database');

function getAll(searchTerm = '') {
    const query = `
        SELECT * FROM productos 
        WHERE activo = 1 
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
            precioCompra, precioVenta, proveedor, ubicacion, activo, createdAt, updatedAt
        ) VALUES (
            @codigo, @nombre, @categoria, @descripcion, @stock, @stockMinimo,
            @precioCompra, @precioVenta, @proveedor, @ubicacion, @activo, @createdAt, @updatedAt
        )
    `);

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
        updatedAt: now
    });

    return getById(info.lastInsertRowid);
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
            updatedAt = @updatedAt
        WHERE id = @id
    `);

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
        updatedAt: now
    });

    return getById(id);
}

function updateStock(id, newStock) {
    if (newStock < 0) throw new Error("El stock no puede ser negativo");
    
    const now = new Date().toISOString();
    const updateQuery = db.prepare(`
        UPDATE productos SET stock = @stock, updatedAt = @updatedAt WHERE id = @id
    `);
    
    updateQuery.run({ id, stock: newStock, updatedAt: now });
    return getById(id);
}

function softDelete(id) {
    const now = new Date().toISOString();
    const info = db.prepare('UPDATE productos SET activo = 0, updatedAt = ? WHERE id = ?').run(now, id);
    return info.changes > 0;
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
