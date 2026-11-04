const fs = require('fs')
const path = require('path')
const { app, safeStorage } = require('electron')
const { supabase, configurationError } = require('./supabaseClient')

let authSubscription = null
let currentSession = null
let persistenceWarning = null

function getSessionPath() {
    return path.join(app.getPath('userData'), 'supabase-session.bin')
}

function saveSession(session) {
    if (!session) {
        const sessionPath = getSessionPath()
        if (fs.existsSync(sessionPath)) fs.unlinkSync(sessionPath)
        currentSession = null
        return
    }

    currentSession = session
    if (!safeStorage.isEncryptionAvailable()) {
        persistenceWarning = 'La sesión solo estará disponible hasta cerrar la aplicación.'
        return
    }

    const sessionPath = getSessionPath()
    const temporaryPath = `${sessionPath}.tmp`
    const encryptedSession = safeStorage.encryptString(JSON.stringify({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
    }))
    fs.mkdirSync(path.dirname(sessionPath), { recursive: true })
    fs.writeFileSync(temporaryPath, encryptedSession)
    fs.renameSync(temporaryPath, sessionPath)
    persistenceWarning = null
}

async function initialize() {
    if (!supabase) return

    authSubscription = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'INITIAL_SESSION') return
        try {
            saveSession(session)
        } catch (error) {
            persistenceWarning = 'No se pudo guardar la sesión de forma segura.'
            console.error('Error al persistir la sesión de Supabase:', error)
        }
    }).data.subscription

    const sessionPath = getSessionPath()
    if (!fs.existsSync(sessionPath)) return

    if (!safeStorage.isEncryptionAvailable()) {
        persistenceWarning = 'No se pudo restaurar la sesión porque el almacenamiento seguro no está disponible.'
        return
    }

    const encryptedSession = fs.readFileSync(sessionPath)
    let savedSession
    try {
        savedSession = JSON.parse(safeStorage.decryptString(encryptedSession))
    } catch (error) {
        console.error('No se pudo descifrar la sesión guardada de Supabase:', error)
        persistenceWarning = 'La sesión guardada no se pudo restaurar; inicia sesión nuevamente.'
        return
    }

    if (!savedSession.access_token || !savedSession.refresh_token) {
        throw new Error('El archivo de sesión guardado no contiene los tokens requeridos.')
    }

    const { data, error } = await supabase.auth.setSession(savedSession)
    if (error) throw error
    currentSession = data.session
}

async function signIn(email, password) {
    if (!supabase) throw new Error(configurationError)
    const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
    })
    if (error) throw error
    if (!data.session) throw new Error('Supabase no devolvió una sesión autenticada.')
    currentSession = data.session
    return getStatus()
}

async function signOut() {
    if (!supabase) throw new Error(configurationError)
    const { error } = await supabase.auth.signOut({ scope: 'local' })
    if (error) throw error
    saveSession(null)
    return getStatus()
}

async function getStatus() {
    if (!supabase) {
        return {
            configured: false,
            authenticated: false,
            email: null,
            warning: null,
            error: configurationError,
        }
    }

    const { data, error } = await supabase.auth.getSession()
    if (error) throw error
    currentSession = data.session

    return {
        configured: true,
        authenticated: Boolean(currentSession),
        email: currentSession?.user?.email || null,
        warning: persistenceWarning,
        error: null,
    }
}

function getClient() {
    return supabase
}

function dispose() {
    authSubscription?.unsubscribe()
    authSubscription = null
}

module.exports = {
    initialize,
    signIn,
    signOut,
    getStatus,
    getClient,
    dispose,
}
