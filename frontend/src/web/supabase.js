import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabaseConfigError = (() => {
  if (!supabaseUrl || !supabaseAnonKey) {
    return 'Configura VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY para habilitar la web móvil.'
  }

  try {
    if (new URL(supabaseUrl).protocol !== 'https:') {
      return 'VITE_SUPABASE_URL debe usar HTTPS.'
    }
  } catch {
    return 'VITE_SUPABASE_URL no es una URL válida.'
  }

  return null
})()

export const supabase = supabaseConfigError
  ? null
  : createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: false,
        persistSession: true,
      },
    })

export async function searchClients(searchTerm) {
  if (!supabase) throw new Error(supabaseConfigError)

  let query = supabase
    .from('clientes')
    .select('id, nombre, telefono, rif, direccion')
    .is('deletedAt', null)
    .order('nombre')
    .limit(10)

  if (searchTerm.trim()) {
    query = query.ilike('nombre', `%${searchTerm.trim()}%`)
  }

  const { data, error } = await query
  if (error) throw error
  if (!Array.isArray(data)) throw new Error('Supabase devolvió una lista de clientes inválida.')
  return data
}

export async function listWebQuotations(from = 0, pageSize = 25) {
  if (!supabase) throw new Error(supabaseConfigError)

  const { data, error } = await supabase
    .from('cotizaciones')
    .select(`
      id, numero, fechaEmision, fechaVencimiento, empresa, cliente, vehiculo,
      aplicaIVA, porcentajeIVA, elaboradoPor, observaciones, createdAt,
      tipoServicio, modelo, placa, color, marcaBomba, modeloBomba,
      serialBomba, otroBomba,
      items (
        id, cotizacionId, descripcion, precioBase, cantidad, producto_id,
        createdAt, updatedAt, version, deletedAt
      )
    `)
    .is('deletedAt', null)
    .order('numero', { ascending: false })
    .range(from, from + pageSize - 1)

  if (error) throw error
  if (!Array.isArray(data)) throw new Error('Supabase devolvió una lista de cotizaciones inválida.')
  return data.map(quote => ({
    ...quote,
    items: Array.isArray(quote.items)
      ? quote.items.filter(item => item.deletedAt == null)
      : [],
  }))
}

export async function getWebQuotation(id) {
  if (!supabase) throw new Error(supabaseConfigError)

  const { data, error } = await supabase
    .from('cotizaciones')
    .select(`
      id, numero, fechaEmision, fechaVencimiento, empresa, cliente, vehiculo,
      aplicaIVA, porcentajeIVA, elaboradoPor, observaciones, createdAt,
      tipoServicio, modelo, placa, color, marcaBomba, modeloBomba,
      serialBomba, otroBomba,
      items (
        id, cotizacionId, descripcion, precioBase, cantidad, producto_id,
        createdAt, updatedAt, version, deletedAt
      )
    `)
    .eq('id', id)
    .is('deletedAt', null)
    .maybeSingle()

  if (error) throw error
  if (!data) return null
  return {
    ...data,
    items: Array.isArray(data.items)
      ? data.items.filter(item => item.deletedAt == null)
      : [],
  }
}

export async function saveWebQuotation({ quote, items }) {
  if (!supabase) throw new Error(supabaseConfigError)

  const { data: existingQuote, error: lookupError } = await supabase
    .from('cotizaciones')
    .select('id, numero')
    .eq('id', quote.id)
    .maybeSingle()
  if (lookupError) throw lookupError
  if (existingQuote) return existingQuote

  const { data, error } = await supabase.rpc('sync_save_cotizacion', {
    p_record: quote,
    p_items: items.map(item => ({ ...item, syncExpectedVersion: 0 })),
    p_expected_version: 0,
    p_assign_folio: true,
  })

  if (error) throw error
  if (!data?.cotizacion?.id || !Number.isInteger(Number(data.cotizacion.numero))) {
    throw new Error('Supabase no confirmó la cotización ni devolvió un folio válido.')
  }
  if (!Array.isArray(data.items) || data.items.length !== items.length) {
    throw new Error('Supabase no confirmó todos los ítems de la cotización.')
  }

  return data.cotizacion
}
