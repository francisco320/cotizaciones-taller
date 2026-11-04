import { useCallback, useEffect, useState } from 'react'

const electronAPI = window.electronAPI

export function SyncStatus() {
  const [status, setStatus] = useState(null)
  const [showLogin, setShowLogin] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const refreshStatus = useCallback(async () => {
    const nextStatus = await electronAPI.getSyncStatus()
    setStatus(nextStatus)
  }, [])

  useEffect(() => {
    let active = true
    const handleOnline = () => {
      electronAPI.syncNow().catch(syncError => {
        if (active) setError(syncError.message)
      })
    }
    const refresh = async () => {
      try {
        const nextStatus = await electronAPI.getSyncStatus()
        if (active) setStatus(nextStatus)
      } catch (statusError) {
        if (active) setError(statusError.message)
      }
    }

    refresh()
    const timer = setInterval(refresh, 5000)
    window.addEventListener('online', handleOnline)
    return () => {
      active = false
      clearInterval(timer)
      window.removeEventListener('online', handleOnline)
    }
  }, [])

  const handleSync = async () => {
    setBusy(true)
    setError('')
    try {
      await electronAPI.syncNow()
      await refreshStatus()
    } catch (syncError) {
      setError(syncError.message)
    } finally {
      setBusy(false)
    }
  }

  const handleSignIn = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await electronAPI.signIn(email, password)
      setPassword('')
      setShowLogin(false)
      await refreshStatus()
    } catch (signInError) {
      setError(signInError.message)
    } finally {
      setBusy(false)
    }
  }

  const handleSignOut = async () => {
    setBusy(true)
    setError('')
    try {
      await electronAPI.signOut()
      await refreshStatus()
    } catch (signOutError) {
      setError(signOutError.message)
    } finally {
      setBusy(false)
    }
  }

  let label = 'Consultando estado'
  let tone = 'text-slate-500'
  if (status) {
    if (!status.configured) {
      label = 'Supabase sin configurar'
      tone = 'text-amber-700'
    } else if (!status.online) {
      label = 'Sin conexión'
      tone = 'text-amber-700'
    } else if (!status.authenticated) {
      label = 'Solo en este equipo'
      tone = 'text-slate-600'
    } else if (status.syncing || busy) {
      label = 'Sincronizando'
      tone = 'text-teal-700'
    } else if (status.conflicts > 0) {
      label = `${status.conflicts} conflicto(s)`
      tone = 'text-red-700'
    } else if (status.lastError) {
      label = 'Error de sincronización'
      tone = 'text-red-700'
    } else if (status.pending > 0) {
      label = `${status.pending} pendiente(s)`
      tone = 'text-amber-700'
    } else {
      label = 'Sincronizado'
      tone = 'text-emerald-700'
    }
  }

  return (
    <div className="relative flex items-center gap-2 text-sm">
      <span
        className={`inline-flex items-center gap-2 ${tone}`}
        aria-live="polite"
        title={status?.warning || status?.lastError || undefined}
      >
        <span className={`h-2 w-2 rounded-full ${tone.replace('text-', 'bg-')}`} />
        {label}
      </span>

      {status?.authenticated ? (
        <>
          <button
            type="button"
            className="rounded border border-slate-300 px-2 py-1 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            onClick={handleSync}
            disabled={busy || status.syncing || !status.online}
            title={status.email || 'Cuenta conectada'}
          >
            Sincronizar ahora
          </button>
          <button
            type="button"
            className="text-slate-500 hover:text-slate-800"
            onClick={handleSignOut}
            disabled={busy}
          >
            Salir
          </button>
        </>
      ) : status?.configured ? (
        <button
          type="button"
          className="rounded border border-slate-300 px-2 py-1 text-slate-700 hover:bg-slate-50"
          onClick={() => {
            setError('')
            setShowLogin(value => !value)
          }}
        >
          Iniciar sesión
        </button>
      ) : null}

      {showLogin && status?.configured && (
        <form
          onSubmit={handleSignIn}
          className="absolute right-0 top-full z-30 mt-2 w-80 space-y-3 rounded-lg border border-slate-200 bg-white p-4 text-left shadow-xl"
        >
          <p className="font-semibold text-slate-800">Cuenta invitada de Supabase</p>
          <label className="block text-xs font-medium text-slate-600">
            Correo
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={event => setEmail(event.target.value)}
              required
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs font-medium text-slate-600">
            Contraseña
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={event => setPassword(event.target.value)}
              required
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          {(error || status.warning) && (
            <p className="text-xs text-red-700" role="alert">{error || status.warning}</p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded bg-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
          >
            {busy ? 'Conectando…' : 'Iniciar sesión'}
          </button>
        </form>
      )}

      {!showLogin && (error || status?.warning || status?.lastError) && (
        <span className="sr-only" role="status">{error || status?.warning || status?.lastError}</span>
      )}
    </div>
  )
}
