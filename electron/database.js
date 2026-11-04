/**
 * Singleton de conexión SQLite (better-sqlite3) adaptado para Electron
 */
const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');
const fs = require('fs');
const { randomUUID } = require('crypto');
const { migrateSyncSchema } = require('./syncMigrations');
const { enqueueChange } = require('./syncQueue');

/**
 * Returns the path to the SQLite database file
 */
function getDbPath() {
    return app.isPackaged
        ? path.join(app.getPath('userData'), 'database.sqlite')
        : path.join(__dirname, '..', 'database.sqlite');
}

function backupBeforeSyncMigration(db, dbPath) {
    const hasExistingTables = db.prepare(`
        SELECT 1
        FROM sqlite_master
        WHERE type = 'table'
          AND name IN ('clientes', 'cotizaciones', 'items', 'productos')
        LIMIT 1
    `).get();
    if (!hasExistingTables) return;

    const migrationTable = db.prepare(`
        SELECT 1
        FROM sqlite_master
        WHERE type = 'table' AND name = 'sync_schema_migrations'
    `).get();
    if (migrationTable && db.prepare(
        'SELECT 1 FROM sync_schema_migrations WHERE version = 1',
    ).get()) {
        return;
    }

    const checkpoint = db.pragma('wal_checkpoint(FULL)')[0];
    if (checkpoint && checkpoint.busy !== 0) {
        throw new Error('No se pudo asegurar la base SQLite antes de la migración.')
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupPath = `${dbPath}.pre-sync-${timestamp}.bak`
    fs.copyFileSync(dbPath, backupPath)
    console.info(`Respaldo previo a sincronización creado: ${backupPath}`)
}

/**
 * Conecta o crea la base de datos SQLite
 */
const connectDB = () => {
    try {
        // Si la app está empaquetada, guardarlo en userData, si no, en la raíz
        const dbPath = getDbPath();

        const db = new Database(dbPath, { verbose: console.log });

        db.pragma('journal_mode = WAL');
        db.pragma('foreign_keys = ON');

        backupBeforeSyncMigration(db, dbPath);
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

    const quoteColumns = new Set(
        db.pragma('table_info(cotizaciones)').map(column => column.name),
    )
    const legacyColumns = [
        ['tipoServicio', "TEXT NOT NULL DEFAULT 'vehiculo'"],
        ['modelo', 'TEXT'],
        ['placa', 'TEXT'],
        ['color', 'TEXT'],
        ['marcaBomba', 'TEXT'],
        ['modeloBomba', 'TEXT'],
        ['serialBomba', 'TEXT'],
        ['otroBomba', 'TEXT'],
    ]
    for (const [columnName, definition] of legacyColumns) {
        if (!quoteColumns.has(columnName)) {
            db.exec(`ALTER TABLE cotizaciones ADD COLUMN ${columnName} ${definition}`)
        }
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

    // Tabla de clientes
    db.exec(`
    CREATE TABLE IF NOT EXISTS clientes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      telefono TEXT,
      email TEXT,
      rif TEXT,
      direccion TEXT,
      ciudad TEXT,
      notas TEXT,
      createdAt TEXT,
      updatedAt TEXT
    )
  `);

    // Índices de clientes
    db.exec(`
    CREATE INDEX IF NOT EXISTS idx_clientes_nombre ON clientes (nombre);
    CREATE INDEX IF NOT EXISTS idx_clientes_rif ON clientes (rif);
  `);

    // Tabla de productos
    db.exec(`
    CREATE TABLE IF NOT EXISTS productos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo TEXT UNIQUE NOT NULL,
      nombre TEXT NOT NULL,
      categoria TEXT,
      descripcion TEXT,
      stock REAL NOT NULL DEFAULT 0 CHECK (stock >= 0),
      stockMinimo REAL NOT NULL DEFAULT 0,
      precioCompra REAL NOT NULL DEFAULT 0,
      precioVenta REAL NOT NULL DEFAULT 0,
      proveedor TEXT,
      ubicacion TEXT,
      activo INTEGER DEFAULT 1,
      createdAt TEXT,
      updatedAt TEXT
    )
  `);

    // Índices de productos
    db.exec(`
    CREATE INDEX IF NOT EXISTS idx_productos_codigo ON productos (codigo);
    CREATE INDEX IF NOT EXISTS idx_productos_nombre ON productos (nombre);
    CREATE INDEX IF NOT EXISTS idx_productos_categoria ON productos (categoria);
  `);

    migrateSyncSchema(db);
}

const db = connectDB();

// ------- CRUD Operations ------- //

function getNextNumero() {
    const row = db.prepare('SELECT MAX(numero) as maxNum FROM cotizaciones').get();

    const MIN_NUMERO = 352;
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
      tipoServicio, modelo, placa, color, marcaBomba, modeloBomba, serialBomba, otroBomba,
      cloudId, clienteId, folioProvisional
    ) VALUES (
      @numero, @fechaEmision, @fechaVencimiento, @empresa, @cliente, @vehiculo,
      @aplicaIVA, @porcentajeIVA, @elaboradoPor, @observaciones, @createdAt, @updatedAt,
      @tipoServicio, @modelo, @placa, @color, @marcaBomba, @modeloBomba, @serialBomba, @otroBomba,
      @cloudId, @clienteId, 1
    )
  `);


    const insertItem = db.prepare(`
    INSERT INTO items (
      cotizacionId, descripcion, precioBase, cantidad, cloudId, productoId, createdAt, updatedAt
    ) VALUES (
      @cotizacionId, @descripcion, @precioBase, @cantidad, @cloudId, @productoId, @createdAt, @updatedAt
    )
  `);

    const tx = db.transaction((dataTx) => {
        const info = insertCotizacion.run({
            numero,
            cloudId: randomUUID(),
            clienteId: dataTx.clienteId || null,
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
            otroBomba: dataTx.otroBomba || null,
        });

        const cotizacionId = info.lastInsertRowid;
        enqueueChange(db, 'cotizaciones', cotizacionId, 'INSERT')

        if (dataTx.items && Array.isArray(dataTx.items)) {
            for (const item of dataTx.items) {
                const itemInfo = insertItem.run({
                    cotizacionId,
                    descripcion: item.descripcion,
                    precioBase: item.precioBase,
                    cantidad: item.cantidad,
                    cloudId: randomUUID(),
                    productoId: item.productoId || null,
                    createdAt: now,
                    updatedAt: now,
                });
                enqueueChange(db, 'items', itemInfo.lastInsertRowid, 'INSERT')
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
        numeroFormateado: row.folioProvisional
            ? `P${String(Math.abs(row.numero)).padStart(6, '0')}`
            : String(row.numero).padStart(7, '0'),
        _id: row.id
    };
}

function getCotizaciones(limit = 50, skip = 0) {
    const itemsRows = db.prepare(
        'SELECT * FROM cotizaciones WHERE deletedAt IS NULL ORDER BY id DESC LIMIT ? OFFSET ?',
    ).all(limit, skip);
    const totalRow = db.prepare(
        'SELECT COUNT(*) as count FROM cotizaciones WHERE deletedAt IS NULL',
    ).get();

    const getItemsByCotizacionId = db.prepare(
        'SELECT * FROM items WHERE cotizacionId = ? AND deletedAt IS NULL',
    );
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
    const row = db.prepare(
        'SELECT * FROM cotizaciones WHERE id = ? AND deletedAt IS NULL',
    ).get(id);
    if (!row) return null;
    const items = db.prepare(
        'SELECT * FROM items WHERE cotizacionId = ? AND deletedAt IS NULL',
    ).all(row.id);

    const doc = parseCotizacionRow(row);
    doc.items = items || [];

    const { resumenCotizacion } = require('./calculations');
    doc.resumen = resumenCotizacion(doc.items, doc.aplicaIVA, doc.porcentajeIVA);

    return doc;
}

function getCotizacionByNumero(numero) {
    const row = db.prepare(
        'SELECT * FROM cotizaciones WHERE numero = ? AND deletedAt IS NULL',
    ).get(numero);
    if (!row) return null;

    const items = db.prepare(
        'SELECT * FROM items WHERE cotizacionId = ? AND deletedAt IS NULL',
    ).all(row.id);

    const doc = parseCotizacionRow(row);
    doc.items = items || [];

    const { resumenCotizacion } = require('./calculations');
    doc.resumen = resumenCotizacion(doc.items, doc.aplicaIVA, doc.porcentajeIVA);

    return doc;
}


function updateCotizacion(id, dataTx) {
    const existing = db.prepare(
        'SELECT * FROM cotizaciones WHERE id = ? AND deletedAt IS NULL',
    ).get(id);
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
      clienteId = @clienteId,
      version = version + 1,
      tipoServicio = @tipoServicio,
      modelo = @modelo,
      placa = @placa,
      color = @color,
      marcaBomba = @marcaBomba,
      modeloBomba = @modeloBomba,
      serialBomba = @serialBomba,
      otroBomba = @otroBomba
    WHERE id = @id
  `);

    const softDeleteItems = db.prepare(`
      UPDATE items SET deletedAt = @deletedAt, updatedAt = @updatedAt, version = version + 1
      WHERE cotizacionId = @cotizacionId AND deletedAt IS NULL
    `);
    const insertItem = db.prepare(`
    INSERT INTO items (
      cotizacionId, descripcion, precioBase, cantidad, cloudId, productoId, createdAt, updatedAt
    ) VALUES (
      @cotizacionId, @descripcion, @precioBase, @cantidad, @cloudId, @productoId, @createdAt, @updatedAt
    )
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
            clienteId: dataTx.clienteId !== undefined ? dataTx.clienteId : existing.clienteId,
            tipoServicio: dataTx.tipoServicio !== undefined ? dataTx.tipoServicio : existing.tipoServicio,
            modelo: dataTx.modelo !== undefined ? dataTx.modelo : existing.modelo,
            placa: dataTx.placa !== undefined ? dataTx.placa : existing.placa,
            color: dataTx.color !== undefined ? dataTx.color : existing.color,
            marcaBomba: dataTx.marcaBomba !== undefined ? dataTx.marcaBomba : existing.marcaBomba,
            modeloBomba: dataTx.modeloBomba !== undefined ? dataTx.modeloBomba : existing.modeloBomba,
            serialBomba: dataTx.serialBomba !== undefined ? dataTx.serialBomba : existing.serialBomba,
            otroBomba: dataTx.otroBomba !== undefined ? dataTx.otroBomba : existing.otroBomba,
        });
        enqueueChange(db, 'cotizaciones', cotizacionId, 'UPDATE')

        if (dataTx.items && Array.isArray(dataTx.items)) {
            const existingItems = db.prepare(
                'SELECT id FROM items WHERE cotizacionId = ? AND deletedAt IS NULL',
            ).all(cotizacionId)
            softDeleteItems.run({ cotizacionId, deletedAt: now, updatedAt: now })
            for (const item of existingItems) {
                enqueueChange(db, 'items', item.id, 'DELETE')
            }
            for (const item of dataTx.items) {
                const itemInfo = insertItem.run({
                    cotizacionId,
                    descripcion: item.descripcion,
                    precioBase: item.precioBase,
                    cantidad: item.cantidad,
                    cloudId: randomUUID(),
                    productoId: item.productoId || null,
                    createdAt: now,
                    updatedAt: now,
                });
                enqueueChange(db, 'items', itemInfo.lastInsertRowid, 'INSERT')
            }
        }
    });

    tx(id);
    return getCotizacionById(id);
}

function deleteCotizacion(id) {
    const now = new Date().toISOString()
    const deleteQuote = db.transaction(() => {
        const existing = db.prepare(
            'SELECT id FROM cotizaciones WHERE id = ? AND deletedAt IS NULL',
        ).get(id)
        if (!existing) return false

        const items = db.prepare(
            'SELECT id FROM items WHERE cotizacionId = ? AND deletedAt IS NULL',
        ).all(id)
        db.prepare(`
            UPDATE items SET deletedAt = ?, updatedAt = ?, version = version + 1
            WHERE cotizacionId = ? AND deletedAt IS NULL
        `).run(now, now, id)
        for (const item of items) enqueueChange(db, 'items', item.id, 'DELETE')

        db.prepare(`
            UPDATE cotizaciones SET deletedAt = ?, updatedAt = ?, version = version + 1
            WHERE id = ?
        `).run(now, now, id)
        enqueueChange(db, 'cotizaciones', id, 'DELETE')
        return true
    })
    return deleteQuote()
}

// ------- Clientes CRUD Operations ------- //

function createCliente(data) {
    const now = new Date().toISOString();
    const insert = db.prepare(`
        INSERT INTO clientes (nombre, telefono, email, rif, direccion, ciudad, notas, createdAt, updatedAt, cloudId)
        VALUES (@nombre, @telefono, @email, @rif, @direccion, @ciudad, @notas, @createdAt, @updatedAt, @cloudId)
    `);
    const create = db.transaction(() => {
        const info = insert.run({
        nombre: data.nombre || '',
        telefono: data.telefono || null,
        email: data.email || null,
        rif: data.rif || null,
        direccion: data.direccion || null,
        ciudad: data.ciudad || null,
        notas: data.notas || null,
        createdAt: now,
        updatedAt: now,
        cloudId: randomUUID(),
        })
        enqueueChange(db, 'clientes', info.lastInsertRowid, 'INSERT')
        return info.lastInsertRowid
    });
    return getClienteById(create());
}

function getClientes(searchTerm = '') {
    // Dynamic join to get the count and last date based on the JSON client name
    const query = `
        SELECT 
            c.*, 
            (
                SELECT COUNT(*) FROM cotizaciones q
                WHERE q.deletedAt IS NULL
                  AND (q.clienteId = c.id OR (
                    q.clienteId IS NULL
                    AND json_extract(q.cliente, '$.nombre') = c.nombre
                    AND (
                        SELECT COUNT(*) FROM clientes c2
                        WHERE c2.deletedAt IS NULL AND c2.nombre = c.nombre
                    ) = 1
                  ))
            ) as totalCotizaciones,
            (
                SELECT MAX(createdAt) FROM cotizaciones q
                WHERE q.deletedAt IS NULL
                  AND (q.clienteId = c.id OR (
                    q.clienteId IS NULL
                    AND json_extract(q.cliente, '$.nombre') = c.nombre
                    AND (
                        SELECT COUNT(*) FROM clientes c2
                        WHERE c2.deletedAt IS NULL AND c2.nombre = c.nombre
                    ) = 1
                  ))
            ) as ultimaCotizacion
        FROM clientes c
        WHERE c.deletedAt IS NULL AND (c.nombre LIKE @search OR c.rif LIKE @search)
        ORDER BY c.nombre ASC
    `;
    return db.prepare(query).all({ search: `%${searchTerm}%` });
}

function getClienteById(id) {
    return db.prepare(
        'SELECT * FROM clientes WHERE id = ? AND deletedAt IS NULL',
    ).get(id);
}

function updateCliente(id, data) {
    const existing = db.prepare(
        'SELECT * FROM clientes WHERE id = ? AND deletedAt IS NULL',
    ).get(id);
    if (!existing) return null;
    const now = new Date().toISOString();
    const updateQuery = db.prepare(`
        UPDATE clientes SET
            nombre = @nombre,
            telefono = @telefono,
            email = @email,
            rif = @rif,
            direccion = @direccion,
            ciudad = @ciudad,
            notas = @notas,
            updatedAt = @updatedAt,
            version = version + 1
        WHERE id = @id
    `);
    const update = db.transaction(() => {
        updateQuery.run({
        id,
        nombre: data.nombre !== undefined ? data.nombre : existing.nombre,
        telefono: data.telefono !== undefined ? data.telefono : existing.telefono,
        email: data.email !== undefined ? data.email : existing.email,
        rif: data.rif !== undefined ? data.rif : existing.rif,
        direccion: data.direccion !== undefined ? data.direccion : existing.direccion,
        ciudad: data.ciudad !== undefined ? data.ciudad : existing.ciudad,
        notas: data.notas !== undefined ? data.notas : existing.notas,
        updatedAt: now
        })
        enqueueChange(db, 'clientes', id, 'UPDATE')
    });
    update()
    return getClienteById(id);
}

function deleteCliente(id) {
    const now = new Date().toISOString()
    const deleteClient = db.transaction(() => {
        const info = db.prepare(`
            UPDATE clientes
            SET deletedAt = ?, updatedAt = ?, version = version + 1
            WHERE id = ? AND deletedAt IS NULL
        `).run(now, now, id)
        if (info.changes === 0) return false
        enqueueChange(db, 'clientes', id, 'DELETE')
        return true
    })
    return deleteClient()
}

// ------- Backup & Restore Operations ------- //

function exportData() {
    const cotizaciones = db.prepare('SELECT * FROM cotizaciones').all();
    const items = db.prepare('SELECT * FROM items').all();
    const clientes = db.prepare('SELECT * FROM clientes').all();
    const productos = db.prepare('SELECT * FROM productos').all();

    return {
        cotizaciones,
        items,
        clientes,
        productos
    };
}

function backupDatabaseFile() {
    const currentDbPath = getDbPath();
    const backupDbPath = currentDbPath + '.bak';
    
    try {
        // Force checkpoint to ensure all WAL data is in the main file before copying
        db.pragma('wal_checkpoint(RESTART)');
        fs.copyFileSync(currentDbPath, backupDbPath);
        return backupDbPath;
    } catch (err) {
        console.error('Error backing up database:', err);
        throw new Error('No se pudo crear la copia de seguridad de la base de datos local.');
    }
}

function importData(data) {
    if (!data.cotizaciones || !data.items || !data.clientes) {
        throw new Error('Estructura de respaldo inválida.');
    }

    const tx = db.transaction(() => {
        const now = new Date().toISOString()
        const entityTables = ['items', 'cotizaciones', 'clientes', 'productos']
        const backupIds = {}

        for (const tableName of entityTables) {
            const activeRecords = db.prepare(
                `SELECT id FROM ${tableName} WHERE deletedAt IS NULL`,
            ).all()
            db.prepare(`
                UPDATE ${tableName}
                SET deletedAt = ?, updatedAt = ?, version = version + 1
                WHERE deletedAt IS NULL
            `).run(now, now)
            for (const { id } of activeRecords) {
                enqueueChange(db, tableName, id, 'DELETE')
            }
        }

        const importRecords = (tableName, records) => {
            const allowedColumns = new Set(
                db.pragma(`table_info(${tableName})`).map(column => column.name),
            )
            const idMap = new Map()
            backupIds[tableName] = idMap

            for (const record of records || []) {
                if (!record || typeof record !== 'object' || Array.isArray(record)) {
                    throw new Error(`Registro inválido en la tabla ${tableName}.`)
                }

                const backupId = Number.isSafeInteger(Number(record.id))
                    && record.id != null
                    && Number(record.id) > 0
                    ? Number(record.id)
                    : null
                const byCloudId = record.cloudId
                    ? db.prepare(`SELECT * FROM ${tableName} WHERE cloudId = ?`).get(record.cloudId)
                    : null
                const byLocalId = backupId !== null
                    ? db.prepare(`SELECT * FROM ${tableName} WHERE id = ?`).get(backupId)
                    : null
                const existing = byCloudId
                    || (!record.cloudId || !byLocalId || byLocalId.cloudId === record.cloudId
                        ? byLocalId
                        : null)
                const cloudId = record.cloudId || existing?.cloudId || randomUUID()
                const values = Object.fromEntries(
                    Object.entries(record).filter(([column]) => allowedColumns.has(column)),
                )
                delete values.id
                values.cloudId = cloudId
                values.deletedAt = record.deletedAt ?? null
                if (tableName === 'cotizaciones' && values.clienteId != null) {
                    const mappedClienteId = backupIds.clientes.get(Number(values.clienteId))
                    if (!mappedClienteId) {
                        throw new Error(`No se pudo resolver el cliente ${values.clienteId} de una cotización importada.`)
                    }
                    values.clienteId = mappedClienteId
                }
                if (tableName === 'items') {
                    if (values.cotizacionId != null) {
                        values.cotizacionId = backupIds.cotizaciones.get(Number(values.cotizacionId)) ?? null
                    }
                    if (values.productoId != null) {
                        const mappedProductoId = backupIds.productos.get(Number(values.productoId))
                        if (!mappedProductoId) {
                            throw new Error(`No se pudo resolver el producto ${values.productoId} de un ítem importado.`)
                        }
                        values.productoId = mappedProductoId
                    }
                    if (!values.cotizacionId) {
                        throw new Error('No se pudo resolver la cotización asociada a un ítem importado.')
                    }
                }

                if (existing) {
                    values.version = Math.max(
                        Number(existing.version) || 1,
                        Number(record.version) || 1,
                    ) + 1
                    values.remoteVersion = existing.remoteVersion || 0
                    values.syncedVersion = existing.syncedVersion || 0
                    values.createdAt = record.createdAt || existing.createdAt || now
                    values.updatedAt = now
                    const columns = Object.keys(values).filter(column => column !== 'cloudId')
                    const update = db.prepare(`
                        UPDATE ${tableName}
                        SET ${columns.map(column => `${column} = @${column}`).join(', ')},
                            cloudId = @cloudId
                        WHERE id = @id
                    `)
                    update.run({ ...values, id: existing.id })
                    if (backupId !== null) idMap.set(backupId, existing.id)
                    enqueueChange(
                        db,
                        tableName,
                        existing.id,
                        values.deletedAt ? 'DELETE' : (values.remoteVersion > 0 ? 'UPDATE' : 'INSERT'),
                    )
                    continue
                }

                values.version = Number(record.version) || 1
                values.remoteVersion = Number(record.remoteVersion) || 0
                values.syncedVersion = Number(record.syncedVersion) || 0
                values.updatedAt = record.updatedAt || now
                if (tableName === 'items') values.createdAt = record.createdAt || now
                if (tableName === 'cotizaciones') {
                    values.clienteId ??= null
                    values.folioProvisional ??= 0
                    if (values.folioProvisional) {
                        const numberTaken = db.prepare(
                            'SELECT 1 FROM cotizaciones WHERE numero = ?',
                        ).get(values.numero)
                        if (numberTaken) {
                            const minNum = db.prepare(
                                'SELECT MIN(numero) AS minimum FROM cotizaciones',
                            ).get().minimum
                            values.numero = Math.min(0, Number(minNum) || 0) - 1
                        }
                    }
                }
                if (tableName === 'items') values.productoId ??= null

                const columns = Object.keys(values)
                if (columns.length === 0) {
                    throw new Error(`No hay columnas válidas para importar en ${tableName}.`)
                }
                if (backupId !== null
                    && !db.prepare(`SELECT 1 FROM ${tableName} WHERE id = ?`).get(backupId)) {
                    values.id = backupId
                    columns.unshift('id')
                }
                const insert = db.prepare(`
                    INSERT INTO ${tableName} (${columns.join(', ')})
                    VALUES (${columns.map(column => `@${column}`).join(', ')})
                `)
                const info = insert.run(values)
                const localId = values.id ?? info.lastInsertRowid
                if (backupId !== null) idMap.set(backupId, localId)
                enqueueChange(
                    db,
                    tableName,
                    localId,
                    values.deletedAt ? 'DELETE' : (values.remoteVersion > 0 ? 'UPDATE' : 'INSERT'),
                )
            }
        }

        importRecords('clientes', data.clientes)
        importRecords('productos', data.productos)
        importRecords('cotizaciones', data.cotizaciones)
        importRecords('items', data.items)
    });

    tx();
}

module.exports = {
    createCotizacion,
    getCotizaciones,
    getCotizacionById,
    getCotizacionByNumero,
    updateCotizacion,
    deleteCotizacion,
    createCliente,
    getClientes,
    getClienteById,
    updateCliente,
    deleteCliente,
    exportData,
    backupDatabaseFile,
    importData,
    db // exportamos la instancia de la base de datos para usarla en los repositorios separados
};
