const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const localEnvPath = path.join(root, 'frontend', '.env.local')

function readLocalEnv() {
  if (!fs.existsSync(localEnvPath)) return {}

  return Object.fromEntries(
    fs.readFileSync(localEnvPath, 'utf8')
      .split(/\r?\n/)
      .map(line => line.match(/^\s*(VITE_SUPABASE_URL|VITE_SUPABASE_ANON_KEY)\s*=\s*(.*?)\s*$/))
      .filter(Boolean)
      .map(([, key, rawValue]) => {
        const value = rawValue.replace(/^(['"])(.*)\1$/, '$2')
        return [key, value]
      }),
  )
}

function isServiceRoleKey(key) {
  if (key.startsWith('sb_secret_')) return true

  const [header, payload] = key.split('.')
  if (!header || !payload) return false

  try {
    const decodedPayload = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    return decodedPayload.role === 'service_role'
  } catch {
    return false
  }
}

const localEnv = readLocalEnv()
const url = process.env.SUPABASE_URL
  || process.env.VITE_SUPABASE_URL
  || localEnv.VITE_SUPABASE_URL
const anonKey = process.env.SUPABASE_ANON_KEY
  || process.env.VITE_SUPABASE_ANON_KEY
  || localEnv.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error(
    'Falta configurar SUPABASE_URL y SUPABASE_ANON_KEY, o VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en frontend/.env.local.',
  )
}

let parsedUrl
try {
  parsedUrl = new URL(url)
} catch {
  throw new Error('SUPABASE_URL no es una URL válida.')
}

if (parsedUrl.protocol !== 'https:') {
  throw new Error('SUPABASE_URL debe usar HTTPS.')
}

if (isServiceRoleKey(anonKey)) {
  throw new Error('No se puede incluir una clave service_role en el instalador.')
}

const configPath = path.join(root, 'electron', 'supabase-config.json')
fs.writeFileSync(configPath, JSON.stringify({ url, anonKey }, null, 2), {
  encoding: 'utf8',
  mode: 0o600,
})
console.log('Configuración publicable de Supabase preparada para el instalador.')
