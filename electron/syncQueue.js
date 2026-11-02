const { randomUUID } = require('crypto')

const SYNC_TABLES = new Set(['clientes', 'cotizaciones', 'items', 'productos'])
const SYNC_OPERATIONS = new Set(['INSERT', 'UPDATE', 'DELETE'])

function enqueueChange(db, tableName, localRecordId, operationType) {
    if (!SYNC_TABLES.has(tableName)) {
        throw new Error(`Entidad no soportada para sincronización: ${tableName}`)
    }

    if (!SYNC_OPERATIONS.has(operationType)) {
        throw new Error(`Operación de sincronización no soportada: ${operationType}`)
    }

    const record = db.prepare(`SELECT * FROM ${tableName} WHERE id = ?`).get(localRecordId)
    if (!record) {
        throw new Error(`No se encontró ${tableName} con ID local ${localRecordId}`)
    }

    if (!record.cloudId) {
        throw new Error(`El registro ${tableName}:${localRecordId} no tiene cloudId`)
    }

    db.prepare(`
        INSERT INTO sync_queue (
            operationId, tableName, localRecordId, cloudId, operationType,
            createdAt, payload
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
        randomUUID(),
        tableName,
        localRecordId,
        record.cloudId,
        operationType,
        new Date().toISOString(),
        JSON.stringify(record),
    )
}

module.exports = { enqueueChange }
