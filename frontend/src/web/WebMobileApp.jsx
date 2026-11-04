import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import COMPANY from '../config/company'
import { resumenCotizacion } from '../lib/calculations'
import {
  getWebQuotation,
  listWebQuotations,
  saveWebQuotation,
  searchClients,
  supabase,
  supabaseConfigError,
} from './supabase'

const emptyItem = () => ({ descripcion: '', precioBase: '', cantidad: '1' })
const emptyClient = () => ({ nombre: '', rif: '', telefono: '', direccion: '' })
const currency = new Intl.NumberFormat('es-VE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const QUOTE_PAGE_SIZE = 25

export function WebMobileApp() {
  const [session, setSession] = useState(null)
  const [checkingSession, setCheckingSession] = useState(!supabaseConfigError)
  const [activeScreen, setActiveScreen] = useState('cotizaciones')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [error, setError] = useState('')
  const clearError = useCallback(() => setError(''), [])

  useEffect(() => {
    if (!supabase) {
      setCheckingSession(false)
      return undefined
    }

    let active = true
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (active) {
        setSession(nextSession)
        setError('')
      }
    })

    supabase.auth.getSession()
      .then(({ data, error: sessionError }) => {
        if (!active) return
        if (sessionError) throw sessionError
        setSession(data.session)
      })
      .catch(sessionError => {
        if (active) setError(sessionError.message)
      })
      .finally(() => {
        if (active) setCheckingSession(false)
      })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  const handleSignIn = async (event) => {
    event.preventDefault()
    if (!supabase) return

    setAuthBusy(true)
    setError('')
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (signInError) throw signInError
      setPassword('')
    } catch (signInError) {
      setError(signInError.message || 'No se pudo iniciar sesión.')
    } finally {
      setAuthBusy(false)
    }
  }

  const handleSignOut = async () => {
    if (!supabase) return
    setError('')
    const { error: signOutError } = await supabase.auth.signOut()
    if (signOutError) setError(signOutError.message)
  }

  if (checkingSession) {
    return <main className="mobile-page"><p className="mobile-muted">Verificando sesión…</p></main>
  }

  if (!session) {
    return (
      <main className="mobile-page mobile-auth-page">
        <section className="mobile-card mobile-auth-card">
          <div className="mobile-brand">
            <div className="mobile-logo-mark" aria-hidden="true">CT</div>
            <div>
              <p className="mobile-eyebrow">Multiservicios autostodoE&amp;C</p>
              <h1>Cotizaciones del taller</h1>
            </div>
          </div>
          <p className="mobile-muted">Inicia sesión con una cuenta autorizada del taller.</p>
          {error && <ErrorMessage>{error}</ErrorMessage>}
          {supabaseConfigError && <ErrorMessage>{supabaseConfigError}</ErrorMessage>}
          <form onSubmit={handleSignIn} className="mobile-form">
            <TextField
              label="Correo"
              type="email"
              autoComplete="username"
              value={email}
              onChange={setEmail}
              required
            />
            <TextField
              label="Contraseña"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={setPassword}
              required
            />
            <button className="mobile-button mobile-button-primary" disabled={authBusy || !supabase}>
              {authBusy ? 'Ingresando…' : 'Iniciar sesión'}
            </button>
          </form>
        </section>
      </main>
    )
  }

  return (
    <main className="mobile-page">
      <header className="mobile-topbar">
        <div className="mobile-brand">
          <div className="mobile-logo-mark" aria-hidden="true">CT</div>
          <div>
            <p className="mobile-eyebrow">Cotizaciones Taller</p>
            <span className="mobile-user">{session.user?.email}</span>
          </div>
        </div>
        <button type="button" className="mobile-link-button" onClick={handleSignOut}>Salir</button>
      </header>
      <nav className="mobile-nav" aria-label="Secciones">
        <button
          type="button"
          className={activeScreen === 'cotizaciones' ? 'mobile-nav-active' : ''}
          onClick={() => {
            setError('')
            setActiveScreen('cotizaciones')
          }}
        >
          Cotizaciones
        </button>
        <button
          type="button"
          className={activeScreen === 'nueva' ? 'mobile-nav-active' : ''}
          onClick={() => {
            setError('')
            setActiveScreen('nueva')
          }}
        >
          + Nueva
        </button>
      </nav>
      <div className="mobile-content">
        {activeScreen === 'nueva' ? (
          <MobileQuotationForm
            error={error}
            onClearError={clearError}
            onError={setError}
            onViewQuotes={() => setActiveScreen('cotizaciones')}
          />
        ) : (
          <MobileQuoteBrowser error={error} onError={setError} onClearError={clearError} />
        )}
      </div>
    </main>
  )
}

function MobileQuotationForm({ error, onClearError, onError, onViewQuotes }) {
  const [clientSearch, setClientSearch] = useState('')
  const [clients, setClients] = useState([])
  const [selectedClient, setSelectedClient] = useState(null)
  const [client, setClient] = useState(emptyClient)
  const [searchingClients, setSearchingClients] = useState(false)
  const [showClientResults, setShowClientResults] = useState(false)
  const [tipoServicio, setTipoServicio] = useState('vehiculo')
  const [vehiculo, setVehiculo] = useState('')
  const [modelo, setModelo] = useState('')
  const [placa, setPlaca] = useState('')
  const [color, setColor] = useState('')
  const [marcaBomba, setMarcaBomba] = useState('')
  const [modeloBomba, setModeloBomba] = useState('')
  const [serialBomba, setSerialBomba] = useState('')
  const [otroBomba, setOtroBomba] = useState('')
  const [fechaVencimiento, setFechaVencimiento] = useState('')
  const [items, setItems] = useState([emptyItem()])
  const [aplicaIVA, setAplicaIVA] = useState(false)
  const [porcentajeIVA, setPorcentajeIVA] = useState('16')
  const [elaboradoPor, setElaboradoPor] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedNumber, setSavedNumber] = useState(null)
  const pendingOperation = useRef(null)
  const savingGuard = useRef(false)

  useEffect(() => {
    let active = true
    const timer = setTimeout(async () => {
      setSearchingClients(true)
      try {
        const results = await searchClients(clientSearch)
        if (active) setClients(results)
      } catch (searchError) {
        if (active) onError(searchError.message || 'No se pudieron buscar los clientes.')
      } finally {
        if (active) setSearchingClients(false)
      }
    }, clientSearch.trim() ? 250 : 0)

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [clientSearch, onError])

  const resumen = useMemo(
    () => resumenCotizacion(items, aplicaIVA, Number(porcentajeIVA) || 0),
    [items, aplicaIVA, porcentajeIVA],
  )

  const updateItem = (index, key, value) => {
    setItems(current => current.map((item, itemIndex) =>
      itemIndex === index ? { ...item, [key]: value } : item,
    ))
  }

  const chooseClient = (nextClient) => {
    setSelectedClient(nextClient)
    setClient({
      nombre: nextClient.nombre || '',
      rif: nextClient.rif || '',
      telefono: nextClient.telefono || '',
      direccion: nextClient.direccion || '',
    })
    setClientSearch(nextClient.nombre || '')
    setShowClientResults(false)
    onClearError()
  }

  const updateClientField = (field, value) => {
    setClient(current => ({ ...current, [field]: value }))
    if (field === 'nombre') {
      setClientSearch(value)
      setSelectedClient(null)
      setShowClientResults(true)
    }
  }

  const resetForm = () => {
    pendingOperation.current = null
    setSavedNumber(null)
    setClientSearch('')
    setClients([])
    setSelectedClient(null)
    setClient(emptyClient())
    setTipoServicio('vehiculo')
    setVehiculo('')
    setModelo('')
    setPlaca('')
    setColor('')
    setMarcaBomba('')
    setModeloBomba('')
    setSerialBomba('')
    setOtroBomba('')
    setFechaVencimiento('')
    setItems([emptyItem()])
    setAplicaIVA(false)
    setPorcentajeIVA('16')
    setElaboradoPor('')
    setObservaciones('')
    onClearError()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (savingGuard.current) return
    onClearError()
    setSavedNumber(null)

    const quoteItems = items
      .filter(item => item.descripcion.trim())
      .map(item => ({
        descripcion: item.descripcion.trim(),
        precioBase: Number(item.precioBase),
        cantidad: Number(item.cantidad),
      }))

    if (!client.nombre.trim()) {
      onError('El nombre del cliente es obligatorio.')
      return
    }
    if (!quoteItems.length) {
      onError('Agrega al menos un ítem con descripción.')
      return
    }
    if (quoteItems.some(item =>
      !Number.isFinite(item.precioBase) || item.precioBase < 0
      || !Number.isFinite(item.cantidad) || item.cantidad <= 0,
    )) {
      onError('Verifica que los precios no sean negativos y las cantidades sean mayores que cero.')
      return
    }
    if (!globalThis.crypto?.randomUUID) {
      onError('Este navegador no permite generar identificadores seguros. Abre la web mediante HTTPS.')
      return
    }

    const quoteDetails = {
      numero: 0,
      fechaVencimiento: fechaVencimiento || null,
      empresa: COMPANY,
      cliente: {
        nombre: client.nombre.trim(),
        rif: client.rif.trim(),
        telefono: client.telefono.trim(),
        direccion: client.direccion.trim(),
      },
      cliente_id: selectedClient?.id || null,
      vehiculo: tipoServicio === 'vehiculo' ? vehiculo.trim() || null : null,
      aplicaIVA,
      porcentajeIVA: Number(porcentajeIVA) || 0,
      elaboradoPor: elaboradoPor.trim() || null,
      observaciones: observaciones.trim() || null,
      tipoServicio,
      modelo: tipoServicio === 'vehiculo' ? modelo.trim() || null : null,
      placa: tipoServicio === 'vehiculo' ? placa.trim() || null : null,
      color: tipoServicio === 'vehiculo' ? color.trim() || null : null,
      marcaBomba: tipoServicio === 'bomba_inyeccion' ? marcaBomba.trim() || null : null,
      modeloBomba: tipoServicio === 'bomba_inyeccion' ? modeloBomba.trim() || null : null,
      serialBomba: tipoServicio === 'bomba_inyeccion' ? serialBomba.trim() || null : null,
      otroBomba: tipoServicio === 'bomba_inyeccion' ? otroBomba.trim() || null : null,
      deletedAt: null,
    }
    const fingerprint = JSON.stringify({ quoteDetails, quoteItems })
    let operation = pendingOperation.current
    if (!operation || operation.fingerprint !== fingerprint) {
      const quoteId = globalThis.crypto.randomUUID()
      const now = new Date().toISOString()
      operation = {
        fingerprint,
        quote: {
          id: quoteId,
          ...quoteDetails,
          fechaEmision: now,
          createdAt: now,
          updatedAt: now,
        },
        items: quoteItems.map(item => ({
          id: globalThis.crypto.randomUUID(),
          cotizacionId: quoteId,
          ...item,
          producto_id: null,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        })),
      }
      pendingOperation.current = operation
    }

    savingGuard.current = true
    setSaving(true)
    try {
      const result = await saveWebQuotation({
        quote: operation.quote,
        items: operation.items,
      })
      pendingOperation.current = null
      setSavedNumber(result.numero)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (saveError) {
      onError(saveError.message || 'No se pudo guardar la cotización en Supabase.')
    } finally {
      savingGuard.current = false
      setSaving(false)
    }
  }

  return savedNumber != null ? (
        <section className="mobile-card mobile-success" role="status">
          <div className="mobile-success-mark" aria-hidden="true">✓</div>
          <p className="mobile-eyebrow">Guardada en Supabase</p>
          <h1>Cotización #{String(savedNumber).padStart(7, '0')}</h1>
          <p className="mobile-muted">Ya está disponible para los usuarios autorizados del taller.</p>
          <button type="button" className="mobile-button mobile-button-primary" onClick={resetForm}>
            Crear otra cotización
          </button>
          <button type="button" className="mobile-button mobile-button-secondary" onClick={onViewQuotes}>
            Ver cotizaciones
          </button>
        </section>
      ) : (
          <>
            <div className="mobile-page-heading">
              <p className="mobile-eyebrow">Nueva orden</p>
              <h1>Crear cotización</h1>
              <p className="mobile-muted">Los cambios se guardan en línea en la base del taller.</p>
            </div>

            {error && <ErrorMessage>{error}</ErrorMessage>}

            <form className="mobile-form" onSubmit={handleSubmit}>
              <section className="mobile-card">
                <SectionTitle number="1" title="Cliente" />
                <div className="mobile-form-grid">
                  <div className="mobile-field mobile-field-wide">
                    <label htmlFor="client-name">Buscar o escribir nombre *</label>
                    <input
                      id="client-name"
                      value={client.nombre}
                      onFocus={() => setShowClientResults(true)}
                      onChange={event => updateClientField('nombre', event.target.value)}
                      autoComplete="off"
                      required
                    />
                    {showClientResults && (
                      <div className="mobile-client-results">
                        {searchingClients ? (
                          <p className="mobile-muted">Buscando clientes…</p>
                        ) : clients.length ? (
                          clients.map(result => (
                            <button
                              type="button"
                              key={result.id}
                              onClick={() => chooseClient(result)}
                              className="mobile-client-result"
                            >
                              <strong>{result.nombre}</strong>
                              <span>{[result.rif, result.telefono].filter(Boolean).join(' · ')}</span>
                            </button>
                          ))
                        ) : (
                          <p className="mobile-muted">
                            {clientSearch.trim() ? 'No aparece un cliente guardado; se usará la información escrita.' : 'Escribe para buscar un cliente.'}
                          </p>
                        )}
                        <button
                          type="button"
                          className="mobile-link-button"
                          onClick={() => setShowClientResults(false)}
                        >
                          Cerrar
                        </button>
                      </div>
                    )}
                    {selectedClient && (
                      <p className="mobile-field-hint">Cliente vinculado; la cotización conservará esta copia histórica.</p>
                    )}
                  </div>
                  <TextField label="RIF / CI" value={client.rif} onChange={value => updateClientField('rif', value)} />
                  <TextField label="Teléfono" type="tel" value={client.telefono} onChange={value => updateClientField('telefono', value)} />
                  <TextField label="Dirección" value={client.direccion} onChange={value => updateClientField('direccion', value)} className="mobile-field-wide" />
                </div>
              </section>

              <section className="mobile-card">
                <SectionTitle number="2" title="Servicio y vehículo" />
                <div className="mobile-form-grid">
                  <div className="mobile-field mobile-field-wide">
                    <label htmlFor="service-type">Tipo de servicio</label>
                    <select id="service-type" value={tipoServicio} onChange={event => setTipoServicio(event.target.value)}>
                      <option value="vehiculo">Vehículo</option>
                      <option value="bomba_inyeccion">Bomba de inyección</option>
                    </select>
                  </div>
                  {tipoServicio === 'vehiculo' ? (
                    <>
                      <TextField label="Vehículo" value={vehiculo} onChange={setVehiculo} />
                      <TextField label="Modelo" value={modelo} onChange={setModelo} />
                      <TextField label="Placa" value={placa} onChange={setPlaca} />
                      <TextField label="Color" value={color} onChange={setColor} />
                    </>
                  ) : (
                    <>
                      <TextField label="Marca de bomba" value={marcaBomba} onChange={setMarcaBomba} />
                      <TextField label="Modelo de bomba" value={modeloBomba} onChange={setModeloBomba} />
                      <TextField label="Serial" value={serialBomba} onChange={setSerialBomba} />
                      <TextField label="Otro" value={otroBomba} onChange={setOtroBomba} />
                    </>
                  )}
                  <TextField label="Fecha de vencimiento" type="date" value={fechaVencimiento} onChange={setFechaVencimiento} className="mobile-field-wide" />
                </div>
              </section>

              <section className="mobile-card">
                <div className="mobile-section-heading">
                  <SectionTitle number="3" title="Trabajo y repuestos" />
                  <button
                    type="button"
                    className="mobile-add-button"
                    onClick={() => setItems(current => [...current, emptyItem()])}
                  >
                    + Añadir
                  </button>
                </div>
                <div className="mobile-items">
                  {items.map((item, index) => (
                    <div className="mobile-item-card" key={index}>
                      <div className="mobile-item-heading">
                        <strong>Ítem {index + 1}</strong>
                        {items.length > 1 && (
                          <button
                            type="button"
                            className="mobile-remove-button"
                            onClick={() => setItems(current => current.filter((_, itemIndex) => itemIndex !== index))}
                            aria-label={`Quitar ítem ${index + 1}`}
                          >
                            Quitar
                          </button>
                        )}
                      </div>
                      <div className="mobile-form-grid">
                        <TextField
                          label="Descripción *"
                          value={item.descripcion}
                          onChange={value => updateItem(index, 'descripcion', value)}
                          className="mobile-field-wide"
                          required
                        />
                        <TextField
                          label="Precio base"
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.precioBase}
                          onChange={value => updateItem(index, 'precioBase', value)}
                          required={Boolean(item.descripcion.trim())}
                        />
                        <TextField
                          label="Cantidad"
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={item.cantidad}
                          onChange={value => updateItem(index, 'cantidad', value)}
                          required={Boolean(item.descripcion.trim())}
                        />
                      </div>
                      <p className="mobile-item-subtotal">
                        Subtotal: {formatMoney(resumen.items[index]?.subtotal ?? 0)}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="mobile-card">
                <SectionTitle number="4" title="Totales" />
                <label className="mobile-checkbox">
                  <input type="checkbox" checked={aplicaIVA} onChange={event => setAplicaIVA(event.target.checked)} />
                  <span>Aplicar IVA</span>
                </label>
                {aplicaIVA && (
                  <TextField
                    label="Porcentaje de IVA"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={porcentajeIVA}
                    onChange={setPorcentajeIVA}
                  />
                )}
                <div className="mobile-totals">
                  <p><span>Subtotal</span><strong>{formatMoney(resumen.subtotalGeneral)}</strong></p>
                  {aplicaIVA && <p><span>IVA</span><strong>{formatMoney(resumen.montoIVA)}</strong></p>}
                  <p className="mobile-total"><span>Total</span><strong>{formatMoney(resumen.total)}</strong></p>
                </div>
                <TextField label="Elaborado por" value={elaboradoPor} onChange={setElaboradoPor} />
                <div className="mobile-field mobile-field-wide mobile-notes">
                  <label htmlFor="quote-notes">Observaciones</label>
                  <textarea id="quote-notes" rows="3" value={observaciones} onChange={event => setObservaciones(event.target.value)} />
                </div>
              </section>

              <button
                type="submit"
                className="mobile-button mobile-button-primary mobile-submit"
                disabled={saving}
              >
                {saving ? 'Guardando…' : 'Guardar cotización'}
              </button>
              <p className="mobile-footnote">
                Empresa: {COMPANY.nombre} · RIF {COMPANY.rif}
              </p>
            </form>
          </>
      )
}

function MobileQuoteBrowser({ error, onError, onClearError }) {
  const [quotes, setQuotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [selectedQuote, setSelectedQuote] = useState(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [pdfBusy, setPdfBusy] = useState(false)
  const loadedCount = useRef(0)

  const loadQuotes = useCallback(async ({ reset = false } = {}) => {
    const offset = reset ? 0 : loadedCount.current
    if (reset) {
      setRefreshing(true)
      onClearError()
    } else {
      setLoadingMore(true)
    }

    try {
      const nextQuotes = await listWebQuotations(offset, QUOTE_PAGE_SIZE)
      loadedCount.current = reset ? nextQuotes.length : offset + nextQuotes.length
      setQuotes(current => reset ? nextQuotes : [...current, ...nextQuotes])
      setHasMore(nextQuotes.length === QUOTE_PAGE_SIZE)
    } catch (loadError) {
      onError(loadError.message || 'No se pudieron cargar las cotizaciones.')
    } finally {
      setLoading(false)
      setRefreshing(false)
      setLoadingMore(false)
    }
  }, [onClearError, onError])

  useEffect(() => {
    loadQuotes({ reset: true })
  }, [loadQuotes])

  useEffect(() => {
    if (!selectedId) {
      setSelectedQuote(null)
      return
    }

    let active = true
    setLoadingDetail(true)
    onClearError()
    getWebQuotation(selectedId)
      .then(quote => {
        if (!active) return
        if (!quote) throw new Error('La cotización no existe o fue eliminada.')
        setSelectedQuote(quote)
      })
      .catch(detailError => {
        if (active) onError(detailError.message || 'No se pudo cargar la cotización.')
      })
      .finally(() => {
        if (active) setLoadingDetail(false)
      })

    return () => {
      active = false
    }
  }, [selectedId, onClearError, onError])

  const normalizedSearch = search.trim().toLocaleLowerCase('es')
  const visibleQuotes = quotes.filter(quote =>
    !normalizedSearch
    || String(quote.numero).includes(normalizedSearch)
    || String(quote.cliente?.nombre || '').toLocaleLowerCase('es').includes(normalizedSearch),
  )

  const handlePdf = async () => {
    if (!selectedQuote) return
    setPdfBusy(true)
    onClearError()
    try {
      const { downloadQuotationPdf } = await import('./pdf.js')
      await downloadQuotationPdf(selectedQuote)
    } catch (pdfError) {
      onError(pdfError.message || 'No se pudo generar el PDF.')
    } finally {
      setPdfBusy(false)
    }
  }

  if (selectedId) {
    return (
      <section>
        <button type="button" className="mobile-back-button" onClick={() => setSelectedId(null)}>
          ← Volver a cotizaciones
        </button>
        {error && <ErrorMessage>{error}</ErrorMessage>}
        {loadingDetail ? (
          <p className="mobile-muted">Cargando cotización…</p>
        ) : selectedQuote ? (
          <QuoteDetails
            quote={selectedQuote}
            pdfBusy={pdfBusy}
            onDownloadPdf={handlePdf}
          />
        ) : null}
      </section>
    )
  }

  return (
    <section>
      <div className="mobile-page-heading">
        <p className="mobile-eyebrow">Historial</p>
        <div className="mobile-heading-row">
          <div>
            <h1>Cotizaciones</h1>
            <p className="mobile-muted">Más recientes primero</p>
          </div>
          <button
            type="button"
            className="mobile-refresh-button"
            onClick={() => loadQuotes({ reset: true })}
            disabled={refreshing || loadingMore}
          >
            {refreshing ? 'Actualizando…' : 'Actualizar'}
          </button>
        </div>
      </div>

      {error && <ErrorMessage>{error}</ErrorMessage>}

      <div className="mobile-search">
        <label htmlFor="quote-search">Buscar por folio o cliente</label>
        <input
          id="quote-search"
          type="search"
          value={search}
          onChange={event => setSearch(event.target.value)}
          placeholder="Ej. 0000352 o nombre"
        />
      </div>

      {loading ? (
        <p className="mobile-muted">Cargando cotizaciones…</p>
      ) : visibleQuotes.length ? (
        <div className="mobile-quote-list">
          {visibleQuotes.map(quote => {
            const summary = resumenCotizacion(
              quote.items || [],
              quote.aplicaIVA,
              quote.porcentajeIVA,
            )
            return (
              <button
                type="button"
                key={quote.id}
                className="mobile-quote-row"
                onClick={() => setSelectedId(quote.id)}
              >
                <span className="mobile-quote-row-top">
                  <strong>#{String(quote.numero).padStart(7, '0')}</strong>
                  <span>{formatShortDate(quote.fechaEmision)}</span>
                </span>
                <span className="mobile-quote-client">{quote.cliente?.nombre || 'Sin cliente'}</span>
                <span className="mobile-quote-row-bottom">
                  <span>{quote.items?.length || 0} ítem(s)</span>
                  <strong>{formatMoney(summary.total)}</strong>
                </span>
              </button>
            )
          })}
        </div>
      ) : (
        <div className="mobile-card mobile-empty">
          {quotes.length
            ? 'No hay cotizaciones que coincidan con la búsqueda.'
            : 'No hay cotizaciones guardadas todavía.'}
        </div>
      )}

      {hasMore && quotes.length > 0 && !normalizedSearch && (
        <button
          type="button"
          className="mobile-button mobile-button-secondary mobile-load-more"
          onClick={() => loadQuotes()}
          disabled={loadingMore}
        >
          {loadingMore ? 'Cargando…' : 'Cargar más cotizaciones'}
        </button>
      )}
    </section>
  )
}

function QuoteDetails({ quote, pdfBusy, onDownloadPdf }) {
  const summary = resumenCotizacion(
    quote.items || [],
    quote.aplicaIVA,
    quote.porcentajeIVA,
  )
  const isPump = quote.tipoServicio === 'bomba_inyeccion'

  return (
    <article>
      <div className="mobile-page-heading mobile-detail-heading">
        <p className="mobile-eyebrow">Detalle</p>
        <h1>Cotización #{String(quote.numero).padStart(7, '0')}</h1>
        <p className="mobile-muted">{formatShortDate(quote.fechaEmision)}</p>
        <button
          type="button"
          className="mobile-button mobile-button-primary mobile-pdf-button"
          onClick={onDownloadPdf}
          disabled={pdfBusy}
        >
          {pdfBusy ? 'Generando PDF…' : 'Exportar a PDF'}
        </button>
      </div>

      <section className="mobile-card mobile-detail-card">
        <SectionTitle number="1" title="Cliente" />
        <DetailField label="Nombre" value={quote.cliente?.nombre} />
        <DetailField label="RIF / CI" value={quote.cliente?.rif} />
        <DetailField label="Teléfono" value={quote.cliente?.telefono} />
        <DetailField label="Dirección" value={quote.cliente?.direccion} />
      </section>

      <section className="mobile-card mobile-detail-card">
        <SectionTitle number="2" title={isPump ? 'Bomba de inyección' : 'Vehículo'} />
        {isPump ? (
          <>
            <DetailField label="Marca" value={quote.marcaBomba} />
            <DetailField label="Modelo" value={quote.modeloBomba} />
            <DetailField label="Serial" value={quote.serialBomba} />
            <DetailField label="Otro" value={quote.otroBomba} />
          </>
        ) : (
          <>
            <DetailField label="Vehículo" value={quote.vehiculo} />
            <DetailField label="Modelo" value={quote.modelo} />
            <DetailField label="Placa" value={quote.placa} />
            <DetailField label="Color" value={quote.color} />
          </>
        )}
      </section>

      <section className="mobile-card mobile-detail-card">
        <SectionTitle number="3" title="Trabajos y repuestos" />
        {quote.items?.length ? quote.items.map((item, index) => (
          <div className="mobile-detail-item" key={item.id}>
            <strong>{index + 1}. {item.descripcion}</strong>
            <span>{item.cantidad} × {formatMoney(item.precioBase)}</span>
            <b>{formatMoney(summary.items[index]?.subtotal)}</b>
          </div>
        )) : <p className="mobile-muted">Esta cotización no tiene ítems.</p>}
      </section>

      <section className="mobile-card mobile-detail-card">
        <SectionTitle number="4" title="Totales" />
        <div className="mobile-totals">
          <p><span>Subtotal</span><strong>{formatMoney(summary.subtotalGeneral)}</strong></p>
          {summary.aplicaIVA && (
            <p><span>IVA ({quote.porcentajeIVA}%)</span><strong>{formatMoney(summary.montoIVA)}</strong></p>
          )}
          <p className="mobile-total"><span>Total</span><strong>{formatMoney(summary.total)}</strong></p>
        </div>
        <DetailField label="Vencimiento" value={formatShortDate(quote.fechaVencimiento)} />
        <DetailField label="Elaborado por" value={quote.elaboradoPor} />
        <DetailField label="Observaciones" value={quote.observaciones} />
      </section>
    </article>
  )
}

function DetailField({ label, value }) {
  if (!value) return null
  return (
    <p className="mobile-detail-field">
      <span>{label}</span>
      <strong>{value}</strong>
    </p>
  )
}

function formatShortDate(value) {
  if (!value) return '—'
  const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T12:00:00`)
    : new Date(value)
  if (Number.isNaN(parsedDate.getTime())) return String(value)
  return new Intl.DateTimeFormat('es-VE', { dateStyle: 'medium' }).format(parsedDate)
}

function SectionTitle({ number, title }) {
  return (
    <div className="mobile-section-title">
      <span>{number}</span>
      <h2>{title}</h2>
    </div>
  )
}

function TextField({
  label,
  value,
  onChange,
  type = 'text',
  className = '',
  required = false,
  ...inputProps
}) {
  return (
    <div className={`mobile-field ${className}`}>
      <label>
        {label}
        <input
          type={type}
          value={value ?? ''}
          onChange={event => onChange(event.target.value)}
          required={required}
          {...inputProps}
        />
      </label>
    </div>
  )
}

function ErrorMessage({ children }) {
  return <div className="mobile-error" role="alert">{children}</div>
}

function formatMoney(value) {
  return currency.format(Number(value) || 0)
}
