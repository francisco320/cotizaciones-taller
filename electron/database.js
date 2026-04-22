/**
 * Singleton de conexión SQLite (better-sqlite3) adaptado para Electron
 */
const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');

/**
 * Conecta o crea la base de datos SQLite
 */
const connectDB = () => {
    try {
        // Si la app está empaquetada, guardarlo en userData, si no, en la raíz
        const dbPath = app.isPackaged
            ? path.join(app.getPath('userData'), 'database.sqlite')
            : path.join(__dirname, '..', 'database.sqlite');

        const db = new Database(dbPath, { verbose: console.log });

        db.pragma('journal_mode = WAL');
        db.pragma('foreign_keys = ON');

        initDB(db);

        console.log('SQLITE Conectado y listo 📦');
        return db;
    } catch (err) {
        console.error('Error al conectar a SQLITE ❌:', err);
        process.exit(1);
    }
};

/**
 * Crea las tablas necesarias si no existen.
 */
function initDB(db) {
    // Tabla de cotizaciones
    db.exec(`
    CREATE TABLE IF NOT EXISTS cotizaciones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero INTEGER UNIQUE,
      fechaEmision TEXT,
      fechaVencimiento TEXT,
      empresa TEXT,
      cliente TEXT,
      vehiculo TEXT,
      aplicaIVA INTEGER DEFAULT 0,
      porcentajeIVA REAL DEFAULT 16,
      elaboradoPor TEXT,
      observaciones TEXT,
      createdAt TEXT,
      updatedAt TEXT
    )
  `);

    // Schema evolution para nuevas columnas
    try {
        const tableInfo = db.pragma('table_info(cotizaciones)');
        const hasTipoServicio = tableInfo.some(column => column.name === 'tipoServicio');
        if (!hasTipoServicio) {
            db.exec(`
                ALTER TABLE cotizaciones ADD COLUMN tipoServicio TEXT NOT NULL DEFAULT 'vehiculo';
                ALTER TABLE cotizaciones ADD COLUMN modelo TEXT;
                ALTER TABLE cotizaciones ADD COLUMN placa TEXT;
                ALTER TABLE cotizaciones ADD COLUMN color TEXT;
                ALTER TABLE cotizaciones ADD COLUMN marcaBomba TEXT;
                ALTER TABLE cotizaciones ADD COLUMN modeloBomba TEXT;
                ALTER TABLE cotizaciones ADD COLUMN serialBomba TEXT;
                ALTER TABLE cotizaciones ADD COLUMN otroBomba TEXT;
            `);
        }
    } catch (err) {
        console.warn('Error verifying new columns:', err);
    }

    // Tabla de items
    db.exec(`
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cotizacionId INTEGER,
      descripcion TEXT NOT NULL,
      precioBase REAL NOT NULL,
      cantidad REAL NOT NULL,
      FOREIGN KEY (cotizacionId) REFERENCES cotizaciones (id) ON DELETE CASCADE
    )
  `);
}

const db = connectDB();

// ------- CRUD Operations ------- //

function getNextNumero() {
    const row = db.prepare('SELECT MAX(numero) as maxNum FROM cotizaciones').get();

    // El número debe comenzar en 300, de modo que se muestre como "0000300"
    const MIN_NUMERO = 300;
    const next = (row.maxNum || MIN_NUMERO - 1) + 1;
    return Math.max(next, MIN_NUMERO);
}

function createCotizacion(data) {
    const numero = getNextNumero();
    const now = new Date().toISOString();

    const insertCotizacion = db.prepare(`
    INSERT INTO cotizaciones (
      numero, fechaEmision, fechaVencimiento, empresa, cliente, vehiculo,
      aplicaIVA, porcentajeIVA, elaboradoPor, observaciones, createdAt, updatedAt,
      tipoServicio, modelo, placa, color, marcaBomba, modeloBomba, serialBomba
    ) VALUES (
      @numero, @fechaEmision, @fechaVencimiento, @empresa, @cliente, @vehiculo,
      @aplicaIVA, @porcentajeIVA, @elaboradoPor, @observaciones, @createdAt, @updatedAt,
      @tipoServicio, @modelo, @placa, @color, @marcaBomba, @modeloBomba, @serialBomba
    )
  `);


    const insertItem = db.prepare(`
    INSERT INTO items (cotizacionId, descripcion, precioBase, cantidad)
    VALUES (@cotizacionId, @descripcion, @precioBase, @cantidad)
  `);

    const tx = db.transaction((dataTx) => {
        const info = insertCotizacion.run({
            numero,
            fechaEmision: dataTx.fechaEmision || now,
            fechaVencimiento: dataTx.fechaVencimiento || null,
            empresa: JSON.stringify(dataTx.empresa || {}),
            cliente: JSON.stringify(dataTx.cliente || {}),
            vehiculo: dataTx.vehiculo || null,
            aplicaIVA: dataTx.aplicaIVA ? 1 : 0,
            porcentajeIVA: dataTx.porcentajeIVA || 16,
            elaboradoPor: dataTx.elaboradoPor || '',
            observaciones: dataTx.observaciones || '',
            createdAt: now,
            updatedAt: now,
            tipoServicio: dataTx.tipoServicio || 'vehiculo',
            modelo: dataTx.modelo || null,
            placa: dataTx.placa || null,
            color: dataTx.color || null,
            marcaBomba: dataTx.marcaBomba || null,
            modeloBomba: dataTx.modeloBomba || null,
            serialBomba: dataTx.serialBomba || null,
        });

        const cotizacionId = info.lastInsertRowid;

        if (dataTx.items && Array.isArray(dataTx.items)) {
            for (const item of dataTx.items) {
                insertItem.run({
                    cotizacionId,
                    descripcion: item.descripcion,
                    precioBase: item.precioBase,
                    cantidad: item.cantidad,
                });
            }
        }

        return cotizacionId;
    });

    const insertedId = tx(data);
    return getCotizacionById(insertedId);
}

function parseCotizacionRow(row) {
    if (!row) return null;

    let vehiculoText = row.vehiculo;
    let oldVehiculo = {};
    if (vehiculoText && vehiculoText.startsWith('{')) {
        try {
            oldVehiculo = JSON.parse(vehiculoText);
            vehiculoText = oldVehiculo.vehiculo;
        } catch (e) { }
    }

    return {
        ...row,
        aplicaIVA: row.aplicaIVA === 1,
        empresa: JSON.parse(row.empresa || '{}'),
        cliente: JSON.parse(row.cliente || '{}'),
        // Mock the old vehiculo object format to not break PDF logic
        vehiculo: {
            vehiculo: vehiculoText || oldVehiculo.vehiculo,
            modelo: row.modelo || row.modeloBomba || oldVehiculo.modelo,
            placa: row.placa || oldVehiculo.placa,
            color: row.color || oldVehiculo.color,
            marca: row.marcaBomba,
            serial: row.serialBomba
        },
        vehiculoTexto: vehiculoText || oldVehiculo.vehiculo, // Flat string for react
        numeroFormateado: String(row.numero).padStart(7, '0'),
        _id: row.id
    };
}

function getCotizaciones(limit = 50, skip = 0) {
    const itemsRows = db.prepare('SELECT * FROM cotizaciones ORDER BY id DESC LIMIT ? OFFSET ?').all(limit, skip);
    const totalRow = db.prepare('SELECT COUNT(*) as count FROM cotizaciones').get();

    const getItemsByCotizacionId = db.prepare('SELECT * FROM items WHERE cotizacionId = ?');
    const { resumenCotizacion } = require('./calculations');

    const parsedItems = itemsRows.map(row => {
        const doc = parseCotizacionRow(row);
        // Anexar los items para esta cotización específica
        doc.items = getItemsByCotizacionId.all(doc._id) || [];
        // Calcular el resumen al vuelo para la grilla
        doc.resumen = resumenCotizacion(doc.items, doc.aplicaIVA, doc.porcentajeIVA);
        return doc;
    });

    return { items: parsedItems, total: totalRow.count };
}

function getCotizacionById(id) {
    const row = db.prepare('SELECT * FROM cotizaciones WHERE id = ?').get(id);
    if (!row) return null;
    const items = db.prepare('SELECT * FROM items WHERE cotizacionId = ?').all(row.id);

    const doc = parseCotizacionRow(row);
    doc.items = items || [];

    const { resumenCotizacion } = require('./calculations');
    doc.resumen = resumenCotizacion(doc.items, doc.aplicaIVA, doc.porcentajeIVA);

    return doc;
}

function getCotizacionByNumero(numero) {
    const row = db.prepare('SELECT * FROM cotizaciones WHERE numero = ?').get(numero);
    if (!row) return null;

    const items = db.prepare('SELECT * FROM items WHERE cotizacionId = ?').all(row.id);

    const doc = parseCotizacionRow(row);
    doc.items = items || [];

    const { resumenCotizacion } = require('./calculations');
    doc.resumen = resumenCotizacion(doc.items, doc.aplicaIVA, doc.porcentajeIVA);

    return doc;
}


function updateCotizacion(id, dataTx) {
    const existing = db.prepare('SELECT * FROM cotizaciones WHERE id = ?').get(id);
    if (!existing) return null;

    const now = new Date().toISOString();

    const updateQuery = db.prepare(`
    UPDATE cotizaciones SET
      fechaEmision = @fechaEmision,
      fechaVencimiento = @fechaVencimiento,
      empresa = @empresa,
      cliente = @cliente,
      vehiculo = @vehiculo,
      aplicaIVA = @aplicaIVA,
      porcentajeIVA = @porcentajeIVA,
      elaboradoPor = @elaboradoPor,
      observaciones = @observaciones,
      updatedAt = @updatedAt,
      tipoServicio = @tipoServicio,
      modelo = @modelo,
      placa = @placa,
      color = @color,
      marcaBomba = @marcaBomba,
      modeloBomba = @modeloBomba,
      serialBomba = @serialBomba
    WHERE id = @id
  `);

    const deleteItems = db.prepare('DELETE FROM items WHERE cotizacionId = ?');
    const insertItem = db.prepare(`
    INSERT INTO items (cotizacionId, descripcion, precioBase, cantidad)
    VALUES (@cotizacionId, @descripcion, @precioBase, @cantidad)
  `);

    const tx = db.transaction((cotizacionId) => {
        updateQuery.run({
            id: cotizacionId,
            fechaEmision: dataTx.fechaEmision !== undefined ? dataTx.fechaEmision : existing.fechaEmision,
            fechaVencimiento: dataTx.fechaVencimiento !== undefined ? dataTx.fechaVencimiento : existing.fechaVencimiento,
            empresa: dataTx.empresa ? JSON.stringify(dataTx.empresa) : existing.empresa,
            cliente: dataTx.cliente ? JSON.stringify(dataTx.cliente) : existing.cliente,
            vehiculo: dataTx.vehiculo !== undefined ? dataTx.vehiculo : existing.vehiculo,
            aplicaIVA: dataTx.aplicaIVA !== undefined ? (dataTx.aplicaIVA ? 1 : 0) : existing.aplicaIVA,
            porcentajeIVA: dataTx.porcentajeIVA !== undefined ? dataTx.porcentajeIVA : existing.porcentajeIVA,
            elaboradoPor: dataTx.elaboradoPor !== undefined ? dataTx.elaboradoPor : existing.elaboradoPor,
            observaciones: dataTx.observaciones !== undefined ? dataTx.observaciones : existing.observaciones,
            updatedAt: now,
            tipoServicio: dataTx.tipoServicio !== undefined ? dataTx.tipoServicio : existing.tipoServicio,
            modelo: dataTx.modelo !== undefined ? dataTx.modelo : existing.modelo,
            placa: dataTx.placa !== undefined ? dataTx.placa : existing.placa,
            color: dataTx.color !== undefined ? dataTx.color : existing.color,
            marcaBomba: dataTx.marcaBomba !== undefined ? dataTx.marcaBomba : existing.marcaBomba,
            modeloBomba: dataTx.modeloBomba !== undefined ? dataTx.modeloBomba : existing.modeloBomba,
            serialBomba: dataTx.serialBomba !== undefined ? dataTx.serialBomba : existing.serialBomba,
        });

        if (dataTx.items && Array.isArray(dataTx.items)) {
            deleteItems.run(cotizacionId);
            for (const item of dataTx.items) {
                insertItem.run({
                    cotizacionId,
                    descripcion: item.descripcion,
                    precioBase: item.precioBase,
                    cantidad: item.cantidad,
                });
            }
        }
    });

    tx(id);
    return getCotizacionById(id);
}

function deleteCotizacion(id) {
    const info = db.prepare('DELETE FROM cotizaciones WHERE id = ?').run(id);
    return info.changes > 0;
}

module.exports = {
    createCotizacion,
    getCotizaciones,
    getCotizacionById,
    getCotizacionByNumero,
    updateCotizacion,
    deleteCotizacion,
};
