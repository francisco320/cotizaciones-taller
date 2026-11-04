const { createClient } = require('@supabase/supabase-js')
const WebSocket = require('ws')
const fs = require('node:fs')
const path = require('node:path')

const configPath = path.join(__dirname, 'supabase-config.json')
const packagedConfig = fs.existsSync(configPath)
    ? JSON.parse(fs.readFileSync(configPath, 'utf8'))
    : {}
const supabaseUrl = process.env.SUPABASE_URL || packagedConfig.url
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || packagedConfig.anonKey

let configurationError = null
let supabase = null

if (!supabaseUrl || !supabaseAnonKey) {
    configurationError = 'Configura SUPABASE_URL y SUPABASE_ANON_KEY en el entorno de la aplicación.'
} else {
    try {
        const parsedUrl = new URL(supabaseUrl)
        if (parsedUrl.protocol !== 'https:') {
            configurationError = 'SUPABASE_URL debe usar HTTPS.'
        } else {
            supabase = createClient(supabaseUrl, supabaseAnonKey, {
                auth: {
                    autoRefreshToken: true,
                    detectSessionInUrl: false,
                    persistSession: false,
                },
                realtime: {
                    transport: WebSocket,
                },
            })
        }
    } catch (error) {
        configurationError = `La configuración de SUPABASE_URL no es válida: ${error.message}`
    }
}

module.exports = { supabase, configurationError }
