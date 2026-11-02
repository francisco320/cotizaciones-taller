const { randomUUID } = require('crypto')

const MIGRATION_VERSION = 1
const ENTITY_TABLES = ['clientes', 'cotizaciones', 'items', 'productos']

function tableColumns(db, tableName) {
    return new Set(db.pragma(`table_info(${tableName})`).map(column => column.name))
}

function ensureColumn(db, tableName, columnName, definition) {
    if (!tableColumns(db, tableName).has(columnName)) {
        db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`)
    }
}

function backfillCloudIds(db, tableName) {
    const missingIds = db.prepare(
        `SELECT id FROM ${tableName} WHERE cloudId IS NULL OR cloudId = ''`,
    ).all()
    const update = db.prepare(`UPDATE ${tableName} SET cloudId = ? WHERE id = ?`)

    for (const { id } of missingIds) {
        update.run(randomUUID(), id)
    }
}

function enqueueExistingRecords(db, tableName) {
    const { enqueueChange } = require('./syncQueue')
    const records = db.prepare(
        `SELECT id, deletedAt FROM ${tableName} ORDER BY id`,
    ).all()

    for (const { id, deletedAt } of records) {
        enqueueChange(db, tableName, id, deletedAt ? 'DELETE' : 'INSERT')
    }
}

function migrateSyncSchema(db) {
    const migrationExists = db.prepare(`
        SELECT 1
        FROM sqlite_master
        WHERE type = 'table' AND name = 'sync_schema_migrations'
    `).get()

    if (migrationExists) {
        const applied = db.prepare(
            'SELECT 1 FROM sync_schema_migrations WHERE version = ?',
        ).get(MIGRATION_VERSION)
        if (applied) return false
    }

    const migration = db.transaction(() => {
        for (const tableName of ENTITY_TABLES) {
            ensureColumn(db, tableName, 'cloudId', 'TEXT')
            ensureColumn(db, tableName, 'version', 'INTEGER NOT NULL DEFAULT 1')
            ensureColumn(db, tableName, 'remoteVersion', 'INTEGER NOT NULL DEFAULT 0')
            ensureColumn(db, tableName, 'syncedVersion', 'INTEGER NOT NULL DEFAULT 0')
            ensureColumn(db, tableName, 'deletedAt', 'TEXT')
        }

        ensureColumn(
            db,
            'cotizaciones',
            'clienteId',
            'INTEGER REFERENCES clientes(id) ON DELETE SET NULL',
        )
        ensureColumn(
            db,
            'cotizaciones',
            'folioProvisional',
            'INTEGER NOT NULL DEFAULT 0',
        )
        ensureColumn(
            db,
            'items',
            'productoId',
            'INTEGER REFERENCES productos(id) ON DELETE SET NULL',
        )
        ensureColumn(db, 'items', 'createdAt', 'TEXT')
        ensureColumn(db, 'items', 'updatedAt', 'TEXT')
        const migrationTimestamp = new Date().toISOString()
        db.prepare(`
            UPDATE items
            SET createdAt = COALESCE(createdAt, ?),
                updatedAt = COALESCE(updatedAt, ?)
            WHERE createdAt IS NULL OR updatedAt IS NULL
        `).run(migrationTimestamp, migrationTimestamp)

        db.exec(`
            CREATE TABLE IF NOT EXISTS sync_schema_migrations (
                version INTEGER PRIMARY KEY,
                appliedAt TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS sync_queue (
                queueOrder INTEGER PRIMARY KEY AUTOINCREMENT,
                operationId TEXT NOT NULL UNIQUE,
                tableName TEXT NOT NULL CHECK (tableName IN ('clientes', 'cotizaciones', 'items', 'productos')),
                localRecordId INTEGER NOT NULL,
                cloudId TEXT NOT NULL,
                operationType TEXT NOT NULL CHECK (operationType IN ('INSERT', 'UPDATE', 'DELETE')),
                createdAt TEXT NOT NULL,
                attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
                status TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'processing', 'failed', 'conflict', 'synced')),
                lastAttemptAt TEXT,
                lastError TEXT,
                payload TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_sync_queue_status_order
                ON sync_queue (status, queueOrder);

            CREATE INDEX IF NOT EXISTS idx_sync_queue_record
                ON sync_queue (tableName, cloudId, queueOrder);

            CREATE TABLE IF NOT EXISTS sync_metadata (
                key TEXT PRIMARY KEY,
                value TEXT,
                updatedAt TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS sync_conflicts (
                id TEXT PRIMARY KEY,
                tableName TEXT NOT NULL CHECK (tableName IN ('clientes', 'cotizaciones', 'items', 'productos')),
                localRecordId INTEGER,
                cloudId TEXT NOT NULL,
                detectedAt TEXT NOT NULL,
                localVersion INTEGER,
                remoteVersion INTEGER,
                localPayload TEXT NOT NULL,
                remotePayload TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'resolved', 'ignored')),
                resolution TEXT,
                resolvedAt TEXT
            );

            CREATE INDEX IF NOT EXISTS idx_sync_conflicts_status
                ON sync_conflicts (status, detectedAt);
        `)

        for (const tableName of ENTITY_TABLES) {
            backfillCloudIds(db, tableName)
            db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_${tableName}_cloud_id ON ${tableName} (cloudId)`)
            db.exec(`CREATE INDEX IF NOT EXISTS idx_${tableName}_deleted_at ON ${tableName} (deletedAt)`)
        }

        db.exec(`
            CREATE INDEX IF NOT EXISTS idx_cotizaciones_cliente_id
                ON cotizaciones (clienteId);
            CREATE INDEX IF NOT EXISTS idx_items_producto_id
                ON items (productoId);
        `)

        db.prepare(`
            INSERT OR IGNORE INTO sync_schema_migrations (version, appliedAt)
            VALUES (?, ?)
        `).run(MIGRATION_VERSION, new Date().toISOString())

        for (const tableName of ['clientes', 'productos', 'cotizaciones', 'items']) {
            enqueueExistingRecords(db, tableName)
        }
    })

    migration()
    return true
}

module.exports = { migrateSyncSchema }
