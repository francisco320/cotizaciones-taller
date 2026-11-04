const { randomUUID } = require('crypto')
const { net } = require('electron')
const { db } = require('./database')
const authService = require('./authService')

const TABLE_ORDER = ['clientes', 'productos', 'cotizaciones', 'items']
const SYNC_INTERVAL_MS = 30_000
const PAGE_SIZE = 500
const TABLE_COLUMNS = {
    clientes: [
        'nombre', 'telefono', 'email', 'rif', 'direccion', 'ciudad', 'notas',
        'createdAt', 'updatedAt', 'version', 'deletedAt',
    ],
    productos: [
        'codigo', 'nombre', 'categoria', 'descripcion', 'stock', 'stockMinimo',
        'precioCompra', 'precioVenta', 'proveedor', 'ubicacion', 'activo',
        'createdAt', 'updatedAt', 'version', 'deletedAt',
    ],
    cotizaciones: [
        'numero', 'fechaEmision', 'fechaVencimiento', 'empresa', 'cliente',
        'vehiculo', 'aplicaIVA', 'porcentajeIVA', 'elaboradoPor', 'observaciones',
        'createdAt', 'updatedAt', 'tipoServicio', 'modelo', 'placa', 'color',
        'marcaBomba', 'modeloBomba', 'serialBomba', 'otroBomba', 'version',
        'deletedAt',
    ],
    items: [
        'descripcion', 'precioBase', 'cantidad', 'createdAt', 'updatedAt',
        'version', 'deletedAt',
    ],
}

function parseJson(value) {
    if (typeof value !== 'string') return value
    try {
        return JSON.parse(value)
    } catch (error) {
        throw new Error(`No se pudo interpretar un valor JSON local: ${error.message}`)
    }
}

function asLocalJson(value) {
    return value == null ? null : JSON.stringify(value)
}

function asRemoteRecord(tableName, row, store = db) {
    const record = Object.fromEntries(
        TABLE_COLUMNS[tableName]
            .filter(column => row[column] !== undefined)
            .map(column => [column, row[column]]),
    )
    record.id = row.cloudId

    if (tableName === 'productos') {
        record.activo = Boolean(row.activo)
    }

    if (tableName === 'cotizaciones') {
        record.empresa = parseJson(row.empresa || {})
        record.cliente = parseJson(row.cliente || {})
        record.aplicaIVA = Boolean(row.aplicaIVA)
        record.cliente_id = row.clienteId
            ? store.prepare('SELECT cloudId FROM clientes WHERE id = ?').get(row.clienteId)?.cloudId || null
            : null
    }

    if (tableName === 'items') {
        record.cotizacionId = store.prepare(
            'SELECT cloudId FROM cotizaciones WHERE id = ?',
        ).get(row.cotizacionId)?.cloudId
        if (!record.cotizacionId) {
            throw new Error(`El ítem ${row.id} no tiene una cotización sincronizable.`)
        }
        record.producto_id = row.productoId
            ? store.prepare('SELECT cloudId FROM productos WHERE id = ?').get(row.productoId)?.cloudId || null
            : null
    }

    if (tableName === 'cotizaciones' && row.folioProvisional) delete record.numero
    delete record.clienteId
    delete record.productoId
    delete record.folioProvisional
    delete record.remoteVersion
    delete record.syncedVersion

    return record
}

function localRowFromRemote(tableName, remoteRow, store = db) {
    const localRow = { cloudId: remoteRow.id }

    for (const column of TABLE_COLUMNS[tableName]) {
        if (remoteRow[column] !== undefined) localRow[column] = remoteRow[column]
    }

    if (tableName === 'cotizaciones') {
        localRow.clienteId = remoteRow.cliente_id
            ? store.prepare('SELECT id FROM clientes WHERE cloudId = ?').get(remoteRow.cliente_id)?.id || null
            : null
        localRow.empresa = asLocalJson(remoteRow.empresa || {})
        localRow.cliente = asLocalJson(remoteRow.cliente || {})
        localRow.aplicaIVA = remoteRow.aplicaIVA ? 1 : 0
        localRow.folioProvisional = 0
    }

    if (tableName === 'items') {
        localRow.cotizacionId = remoteRow.cotizacionId
            ? store.prepare('SELECT id FROM cotizaciones WHERE cloudId = ?').get(remoteRow.cotizacionId)?.id || null
            : null
        localRow.productoId = remoteRow.producto_id
            ? store.prepare('SELECT id FROM productos WHERE cloudId = ?').get(remoteRow.producto_id)?.id || null
            : null
        if (!localRow.cotizacionId) {
            throw new Error(`El ítem remoto ${remoteRow.id} no tiene una cotización local disponible.`)
        }
    }

    if (tableName === 'productos' && localRow.activo === undefined) {
        localRow.activo = 1
    } else if (tableName === 'productos') {
        localRow.activo = localRow.activo ? 1 : 0
    }

    localRow.version = remoteRow.version
    localRow.remoteVersion = remoteRow.version
    localRow.syncedVersion = remoteRow.version
    return localRow
}

function getMetadata(key, fallback = null, store = db) {
    return store.prepare('SELECT value FROM sync_metadata WHERE key = ?').get(key)?.value ?? fallback
}

function setMetadata(key, value, store = db) {
    store.prepare(`
        INSERT INTO sync_metadata (key, value, updatedAt)
        VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt
    `).run(key, value == null ? null : String(value), new Date().toISOString())
}

function getLocalRecord(tableName, localRecordId, store = db) {
    return store.prepare(`SELECT * FROM ${tableName} WHERE id = ?`).get(localRecordId)
}

function getPendingCount(store = db) {
    return store.prepare(`
        SELECT COUNT(*) AS count
        FROM sync_queue
        WHERE status IN ('pending', 'processing', 'failed')
    `).get().count
}

function getConflictCount(store = db) {
    return store.prepare(
        "SELECT COUNT(*) AS count FROM sync_conflicts WHERE status = 'pending'",
    ).get().count
}

function markQueueRows(queueRows, status, lastError = null, store = db) {
    const update = store.prepare(`
        UPDATE sync_queue
        SET status = ?, lastError = ?, lastAttemptAt = ?
        WHERE operationId = ?
    `)
    const now = new Date().toISOString()
    const tx = store.transaction(() => {
        for (const row of queueRows) {
            update.run(status, lastError, now, row.operationId)
        }
    })
    tx()
}

function claimQueueRows(queueRows, store = db) {
    const update = store.prepare(`
        UPDATE sync_queue
        SET status = 'processing', attempts = attempts + 1, lastAttemptAt = ?, lastError = NULL
        WHERE operationId = ? AND status IN ('pending', 'failed', 'processing')
    `)
    const now = new Date().toISOString()
    const tx = store.transaction(() => {
        for (const row of queueRows) update.run(now, row.operationId)
    })
    tx()
}

function queueRowsForRecord(tableName, cloudId, store = db) {
    return store.prepare(`
        SELECT * FROM sync_queue
        WHERE tableName = ? AND cloudId = ?
          AND status IN ('pending', 'failed', 'processing')
        ORDER BY queueOrder
    `).all(tableName, cloudId)
}

function queueRowsForQuote(quoteId, store = db) {
    return store.prepare(`
        SELECT q.*
        FROM sync_queue q
        WHERE q.status IN ('pending', 'failed', 'processing')
          AND (
            (q.tableName = 'cotizaciones' AND q.localRecordId = ?)
            OR (
              q.tableName = 'items'
              AND q.localRecordId IN (
                SELECT id FROM items WHERE cotizacionId = ?
              )
            )
          )
        ORDER BY q.queueOrder
    `).all(quoteId, quoteId)
}

function storeConflict(tableName, localRecordId, cloudId, localVersion, remoteRow, store = db) {
    const localRow = getLocalRecord(tableName, localRecordId, store)
    if (!localRow) return

    const pendingConflict = store.prepare(`
        SELECT id FROM sync_conflicts
        WHERE tableName = ? AND cloudId = ? AND status = 'pending'
    `).get(tableName, cloudId)
    const conflictId = pendingConflict?.id || randomUUID()

    const tx = store.transaction(() => {
        store.prepare(`
            INSERT INTO sync_conflicts (
                id, tableName, localRecordId, cloudId, detectedAt,
                localVersion, remoteVersion, localPayload, remotePayload, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
            ON CONFLICT(id) DO UPDATE SET
                detectedAt = excluded.detectedAt,
                localVersion = excluded.localVersion,
                remoteVersion = excluded.remoteVersion,
                localPayload = excluded.localPayload,
                remotePayload = excluded.remotePayload
        `).run(
            conflictId,
            tableName,
            localRecordId,
            cloudId,
            new Date().toISOString(),
            localVersion,
            remoteRow.version,
            JSON.stringify(localRow),
            JSON.stringify(remoteRow),
        )
        store.prepare(`
            UPDATE sync_queue SET status = 'conflict', lastError = ?
            WHERE tableName = ? AND cloudId = ?
              AND status IN ('pending', 'processing', 'failed')
        `).run('El registro cambió localmente y en Supabase.', tableName, cloudId)
    })
    tx()
}

function writeLocalRemoteRow(tableName, remoteRow, store = db) {
    const localRow = localRowFromRemote(tableName, remoteRow, store)
    const existing = store.prepare(
        `SELECT * FROM ${tableName} WHERE cloudId = ?`,
    ).get(remoteRow.id)

    if (existing) {
        const values = { ...localRow, id: existing.id }
        const columns = Object.keys(localRow).filter(column => column !== 'id')
        const assignments = columns.map(column => `${column} = @${column}`).join(', ')
        store.prepare(`UPDATE ${tableName} SET ${assignments} WHERE id = @id`).run(values)
        return existing.id
    }

    const columns = Object.keys(localRow)
    const insert = store.prepare(`
        INSERT INTO ${tableName} (${columns.join(', ')})
        VALUES (${columns.map(column => `@${column}`).join(', ')})
    `)
    return insert.run(localRow).lastInsertRowid
}

function normalizeError(error) {
    return error?.message || String(error)
}

function equivalentRemoteRecord(expected, actual) {
    const ignoredFields = new Set(['version', 'updatedAt', 'numero'])
    const booleanFields = new Set(['aplicaIVA', 'activo'])
    const normalize = (value, key) => {
        if (booleanFields.has(key) && value != null) return Boolean(value)
        if (Array.isArray(value)) return value.map(item => normalize(item))
        if (value && typeof value === 'object') {
            return Object.fromEntries(
                Object.keys(value).sort().map(childKey => [childKey, normalize(value[childKey], childKey)]),
            )
        }
        return value
    }
    const expectedFields = Object.keys(expected).filter(key => !ignoredFields.has(key))
    return expectedFields.every(key =>
        JSON.stringify(normalize(expected[key], key)) === JSON.stringify(normalize(actual[key], key)),
    )
}

function isConflictError(error) {
    return /SYNC_CONFLICT|conflict|duplicate key/i.test(normalizeError(error))
}

function retryEligible(row, now) {
    if (row.status !== 'failed') return true
    const backoffMs = Math.min(5_000 * (2 ** Math.min(Math.max(row.attempts - 1, 0), 8)), 900_000)
    return !row.lastAttemptAt || Date.parse(row.lastAttemptAt) + backoffMs <= now
}

function remoteQueryError(error, tableName) {
    if (error) throw new Error(`Supabase (${tableName}): ${normalizeError(error)}`)
}

function createSyncEngine({ store = db, auth = authService, online = () => net.isOnline() } = {}) {
    let activeRun = null
    let interval = null
    let lastError = null

    async function requireClient() {
        const authStatus = await auth.getStatus()
        if (!authStatus.configured) return { client: null, reason: authStatus.error }
        if (!authStatus.authenticated) return { client: null, reason: 'Inicia sesión para sincronizar.' }
        const client = auth.getClient()
        if (!client) return { client: null, reason: 'El cliente de Supabase no está disponible.' }
        if (!online()) return { client: null, reason: 'Sin conexión a internet.' }
        return { client, reason: null }
    }

    async function callRpc(client, name, args) {
        const { data, error } = await client.rpc(name, args)
        if (error) throw new Error(`Supabase RPC ${name}: ${normalizeError(error)}`)
        if (data == null) throw new Error(`Supabase RPC ${name} no devolvió datos.`)
        return data
    }

    async function verifyRemoteSchema(client) {
        for (const tableName of TABLE_ORDER) {
            const fields = ['id', ...TABLE_COLUMNS[tableName]]
            if (tableName === 'cotizaciones') fields.push('cliente_id')
            if (tableName === 'items') fields.push('cotizacionId', 'producto_id')
            const { error } = await client.from(tableName).select(fields.join(',')).limit(0)
            remoteQueryError(error, tableName)
        }
    }

    async function pullTable(client, tableName) {
        const cursorKey = `pull_cursor:${tableName}`
        const cursor = getMetadata(cursorKey, '1970-01-01T00:00:00.000Z', store)
        const cursorWithOverlap = new Date(
            Math.max(0, Date.parse(cursor) - 60_000),
        ).toISOString()
        let start = 0
        let maxUpdatedAt = cursor

        while (true) {
            const { data, error } = await client
                .from(tableName)
                .select('*')
                .gte('updatedAt', cursorWithOverlap)
                .order('updatedAt', { ascending: true })
                .order('id', { ascending: true })
                .range(start, start + PAGE_SIZE - 1)
            remoteQueryError(error, tableName)
            if (!Array.isArray(data)) {
                throw new Error(`Supabase no devolvió una lista válida para ${tableName}.`)
            }

            for (const remoteRow of data) {
                if (!remoteRow.id || !Number.isInteger(Number(remoteRow.version))) {
                    throw new Error(`Registro remoto inválido en ${tableName}; falta id o version.`)
                }
                if (remoteRow.updatedAt && remoteRow.updatedAt > maxUpdatedAt) {
                    maxUpdatedAt = remoteRow.updatedAt
                }

                const localRow = store.prepare(
                    `SELECT * FROM ${tableName} WHERE cloudId = ?`,
                ).get(remoteRow.id)
                if (!localRow) {
                    const apply = store.transaction(() => writeLocalRemoteRow(tableName, remoteRow, store))
                    apply()
                    continue
                }

                const remoteVersion = Number(remoteRow.version)
                if (remoteVersion <= Number(localRow.remoteVersion || 0)) continue

                const dirty = Number(localRow.version) !== Number(localRow.syncedVersion)
                if (dirty) {
                    storeConflict(
                        tableName,
                        localRow.id,
                        remoteRow.id,
                        localRow.version,
                        remoteRow,
                        store,
                    )
                    continue
                }

                const apply = store.transaction(() => writeLocalRemoteRow(tableName, remoteRow, store))
                apply()
            }

            if (data.length < PAGE_SIZE) break
            start += PAGE_SIZE
        }

        setMetadata(cursorKey, maxUpdatedAt, store)
    }

    async function fetchRemoteRecord(client, tableName, cloudId) {
        const { data, error } = await client
            .from(tableName)
            .select('*')
            .eq('id', cloudId)
            .maybeSingle()
        remoteQueryError(error, tableName)
        return data
    }

    async function pushEntity(client, queueRow) {
        const rows = queueRowsForRecord(
            queueRow.tableName,
            queueRow.cloudId,
            store,
        )
        if (!rows.length) return
        claimQueueRows(rows, store)

        const localRow = store.prepare(
            `SELECT * FROM ${queueRow.tableName} WHERE cloudId = ?`,
        ).get(queueRow.cloudId)
        try {
            if (!localRow) {
                throw new Error(`No se encontró el registro local ${queueRow.tableName}:${queueRow.localRecordId}.`)
            }
            const sentVersion = localRow.version
            const remoteRecord = asRemoteRecord(queueRow.tableName, localRow, store)
            const result = await callRpc(client, 'sync_upsert_record', {
                p_table: queueRow.tableName,
                p_record: remoteRecord,
                p_expected_version: localRow.remoteVersion || 0,
            })
            if (!result.id || !Number.isInteger(Number(result.version))) {
                throw new Error('La respuesta de sync_upsert_record no tiene id o version válidos.')
            }

            const tx = store.transaction(() => {
                store.prepare(`
                    UPDATE ${queueRow.tableName}
                    SET remoteVersion = ?,
                        syncedVersion = CASE WHEN version = ? THEN version ELSE syncedVersion END
                    WHERE id = ?
                `).run(result.version, sentVersion, localRow.id)
                markQueueRows(rows, 'synced', null, store)
            })
            tx()
        } catch (error) {
            if (isConflictError(error)) {
                try {
                    if (localRow) {
                        const latestRemote = await fetchRemoteRecord(client, queueRow.tableName, localRow.cloudId)
                        if (latestRemote && equivalentRemoteRecord(
                            asRemoteRecord(queueRow.tableName, localRow, store),
                            latestRemote,
                        )) {
                            const tx = store.transaction(() => {
                                store.prepare(`
                                    UPDATE ${queueRow.tableName}
                                    SET remoteVersion = ?,
                                        syncedVersion = CASE WHEN version = ? THEN version ELSE syncedVersion END
                                    WHERE id = ?
                                `).run(latestRemote.version, localRow.version, localRow.id)
                                markQueueRows(rows, 'synced', null, store)
                            })
                            tx()
                            return
                        }
                        if (latestRemote) {
                            storeConflict(
                                queueRow.tableName,
                                localRow.id,
                                localRow.cloudId,
                                localRow.version,
                                latestRemote,
                                store,
                            )
                            return
                        }
                    }
                } catch (lookupError) {
                    markQueueRows(rows, 'failed', normalizeError(lookupError), store)
                    throw lookupError
                }
            }
            markQueueRows(rows, 'failed', normalizeError(error), store)
            throw error
        }
    }

    async function pushQuote(client, quoteId) {
        const queueRows = queueRowsForQuote(quoteId, store)
        if (!queueRows.length) return
        claimQueueRows(queueRows, store)

        const quote = getLocalRecord('cotizaciones', quoteId, store)
        let remoteQuote = null
        let itemSnapshots = []
        let sentQuoteVersion = null
        try {
            if (!quote) throw new Error(`No se encontró la cotización local ${quoteId}.`)
            const allItems = store.prepare(
                'SELECT * FROM items WHERE cotizacionId = ? ORDER BY id',
            ).all(quoteId)
            const queuedItemIds = new Set(
                queueRows
                    .filter(row => row.tableName === 'items')
                    .map(row => row.localRecordId),
            )
            const items = allItems.filter(item =>
                queuedItemIds.has(item.id)
                || Number(item.version) !== Number(item.syncedVersion)
                || Number(item.remoteVersion) === 0,
            )
            sentQuoteVersion = quote.version
            const sentItemVersions = new Map(items.map(item => [item.id, item.version]))
            remoteQuote = asRemoteRecord('cotizaciones', quote, store)
            itemSnapshots = items.map(item => ({
                id: item.id,
                cloudId: item.cloudId,
                version: item.version,
                remoteVersion: item.remoteVersion,
                remoteRecord: asRemoteRecord('items', item, store),
            }))
            const remoteItems = itemSnapshots.map(item => ({
                ...item.remoteRecord,
                syncExpectedVersion: item.remoteVersion || 0,
            }))
            const result = await callRpc(client, 'sync_save_cotizacion', {
                p_record: remoteQuote,
                p_items: remoteItems,
                p_expected_version: quote.remoteVersion || 0,
                p_assign_folio: Boolean(quote.folioProvisional),
            })
            if (!result.cotizacion?.id || !Number.isInteger(Number(result.cotizacion.version))) {
                throw new Error('La respuesta de sync_save_cotizacion no contiene una cotización válida.')
            }

            const remoteItemsById = new Map(
                (result.items || []).map(item => [item.id, item]),
            )
            const tx = store.transaction(() => {
                const conflictingQuote = store.prepare(`
                    SELECT id, folioProvisional
                    FROM cotizaciones
                    WHERE numero = ? AND id <> ?
                `).get(result.cotizacion.numero, quoteId)
                if (conflictingQuote) {
                    if (!conflictingQuote.folioProvisional) {
                        throw new Error(
                            `El folio remoto ${result.cotizacion.numero} ya pertenece a otra cotización local.`,
                        )
                    }
                    const minimumNumero = store.prepare(
                        'SELECT MIN(numero) AS minimum FROM cotizaciones',
                    ).get().minimum
                    const temporaryNumero = Math.min(0, Number(minimumNumero) || 0) - 1
                    store.prepare(`
                        UPDATE cotizaciones
                        SET numero = ?, version = version + 1, updatedAt = ?
                        WHERE id = ?
                    `).run(temporaryNumero, new Date().toISOString(), conflictingQuote.id)
                }
                store.prepare(`
                    UPDATE cotizaciones
                    SET numero = ?, folioProvisional = 0, remoteVersion = ?,
                        syncedVersion = CASE WHEN version = ? THEN version ELSE syncedVersion END
                    WHERE id = ?
                `).run(
                    result.cotizacion.numero,
                    result.cotizacion.version,
                    sentQuoteVersion,
                    quoteId,
                )
                for (const item of items) {
                    const synced = remoteItemsById.get(item.cloudId)
                    if (!synced) {
                        throw new Error(`Supabase no devolvió el ítem ${item.cloudId}.`)
                    }
                    store.prepare(`
                        UPDATE items
                        SET remoteVersion = ?,
                            syncedVersion = CASE WHEN version = ? THEN version ELSE syncedVersion END
                        WHERE id = ?
                    `).run(synced.version, sentItemVersions.get(item.id), item.id)
                }
                markQueueRows(queueRows, 'synced', null, store)
            })
            tx()
        } catch (error) {
            if (isConflictError(error)) {
                try {
                    if (quote) {
                        const latestRemote = await fetchRemoteRecord(client, 'cotizaciones', quote.cloudId)
                        if (latestRemote) {
                            const currentQuote = getLocalRecord('cotizaciones', quoteId, store)
                            let equivalent = Boolean(
                                currentQuote
                                && currentQuote.version === sentQuoteVersion
                                && remoteQuote
                                && equivalentRemoteRecord(remoteQuote, latestRemote),
                            )
                            const latestItems = []
                            if (equivalent) {
                                for (const item of itemSnapshots) {
                                    const currentItem = getLocalRecord('items', item.id, store)
                                    if (!currentItem || currentItem.version !== item.version) {
                                        equivalent = false
                                        break
                                    }
                                    const latestItem = await fetchRemoteRecord(client, 'items', item.cloudId)
                                    if (!latestItem || !equivalentRemoteRecord(item.remoteRecord, latestItem)) {
                                        equivalent = false
                                        break
                                    }
                                    latestItems.push(latestItem)
                                }
                            }
                            if (equivalent) {
                                const latestItemsById = new Map(latestItems.map(item => [item.id, item]))
                                const confirm = store.transaction(() => {
                                    store.prepare(`
                                        UPDATE cotizaciones
                                        SET numero = ?, folioProvisional = 0, remoteVersion = ?,
                                            syncedVersion = CASE WHEN version = ? THEN version ELSE syncedVersion END
                                        WHERE id = ?
                                    `).run(
                                        latestRemote.numero,
                                        latestRemote.version,
                                        sentQuoteVersion,
                                        quoteId,
                                    )
                                    for (const item of itemSnapshots) {
                                        const latestItem = latestItemsById.get(item.cloudId)
                                        store.prepare(`
                                            UPDATE items
                                            SET remoteVersion = ?,
                                                syncedVersion = CASE WHEN version = ? THEN version ELSE syncedVersion END
                                            WHERE id = ?
                                        `).run(latestItem.version, item.version, item.id)
                                    }
                                    markQueueRows(queueRows, 'synced', null, store)
                                })
                                confirm()
                                return
                            }
                            storeConflict(
                                'cotizaciones',
                                quoteId,
                                quote.cloudId,
                                currentQuote?.version ?? quote.version,
                                latestRemote,
                                store,
                            )
                            for (const row of queueRows.filter(item => item.tableName === 'items')) {
                                store.prepare(`
                                    UPDATE sync_queue SET status = 'conflict', lastError = ?
                                    WHERE operationId = ?
                                `).run('La cotización asociada tiene un conflicto pendiente.', row.operationId)
                            }
                            return
                        }
                    }
                } catch (lookupError) {
                    markQueueRows(queueRows, 'failed', normalizeError(lookupError), store)
                    throw lookupError
                }
            }
            markQueueRows(queueRows, 'failed', normalizeError(error), store)
            throw error
        }
    }

    async function pushPending(client) {
        const rows = store.prepare(`
            SELECT * FROM sync_queue
            WHERE status IN ('pending', 'failed')
            ORDER BY CASE tableName
                WHEN 'clientes' THEN 0
                WHEN 'productos' THEN 1
                WHEN 'cotizaciones' THEN 2
                ELSE 3
            END, queueOrder
            LIMIT 200
        `).all()

        const now = Date.now()
        const processedQuotes = new Set()
        const processedRecords = new Set()
        for (const row of rows) {
            if (!retryEligible(row, now)) continue
            const recordKey = `${row.tableName}:${row.cloudId}`
            if (processedRecords.has(recordKey)) continue

            if (row.tableName === 'cotizaciones') {
                processedQuotes.add(row.localRecordId)
                await pushQuote(client, row.localRecordId)
            } else if (row.tableName === 'items') {
                const item = getLocalRecord('items', row.localRecordId, store)
                if (!item) continue
                if (!processedQuotes.has(item.cotizacionId)) {
                    await pushQuote(client, item.cotizacionId)
                    processedQuotes.add(item.cotizacionId)
                }
            } else {
                await pushEntity(client, row)
            }
            processedRecords.add(recordKey)
        }
    }

    async function pullRemote(client) {
        for (const tableName of TABLE_ORDER) {
            await pullTable(client, tableName)
        }
    }

    async function performRun() {
        const { client, reason } = await requireClient()
        if (!client) return { started: false, reason }

        await verifyRemoteSchema(client)
        await pushPending(client)
        await pullRemote(client)
        setMetadata('last_successful_sync', new Date().toISOString(), store)
        setMetadata('last_sync_error', null, store)
        lastError = null
        return { started: true, reason: null }
    }

    function run() {
        if (activeRun) return activeRun
        activeRun = performRun()
            .catch(error => {
                lastError = normalizeError(error)
                store.prepare(`
                    UPDATE sync_queue
                    SET status = 'failed', lastError = ?
                    WHERE status = 'processing'
                `).run(lastError)
                setMetadata('last_sync_error', lastError, store)
                throw error
            })
            .finally(() => {
                activeRun = null
            })
        return activeRun
    }

    async function getStatus() {
        const authStatus = await auth.getStatus()
        return {
            ...authStatus,
            online: online(),
            syncing: Boolean(activeRun),
            pending: getPendingCount(store),
            conflicts: getConflictCount(store),
            lastSuccessfulSync: getMetadata('last_successful_sync', null, store),
            lastError: lastError || getMetadata('last_sync_error', null, store),
        }
    }

    function start() {
        store.prepare(`
            UPDATE sync_queue SET status = 'pending'
            WHERE status = 'processing'
        `).run()
        if (interval) clearInterval(interval)
        interval = setInterval(() => {
            run().catch(error => console.error('Error en sincronización automática:', error))
        }, SYNC_INTERVAL_MS)
        run().catch(error => console.error('Error en sincronización inicial:', error))
    }

    function stop() {
        if (interval) clearInterval(interval)
        interval = null
    }

    return { run, getStatus, start, stop }
}

const syncEngine = createSyncEngine()

module.exports = { createSyncEngine, syncEngine }
