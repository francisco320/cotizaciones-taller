import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { electronAPI } from '../api/client'

export function VerCotizacion() {
  const { id } = useParams()
  const [cotizacion, setCotizacion] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [pdfFolder, setPdfFolder] = useState(null)
  const [folderLoading, setFolderLoading] = useState(true)

  useEffect(() => {
    electronAPI
      .obtener(id)
      .then(setCotizacion)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    setFolderLoading(true)
    electronAPI
      .getPdfFolder()
      .then((folder) => setPdfFolder(folder))
      .finally(() => setFolderLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <p className="text-slate-600">Cargando...</p>
      </div>
    )
  }
  if (error || !cotizacion) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
        {error || 'Cotización no encontrada'}
        <div className="mt-2">
          <Link to="/" className="text-teal-600 hover:underline font-medium">
            Volver al listado
          </Link>
        </div>
      </div>
    )
  }

  const numeroFormateado = cotizacion.numeroFormateado ?? String(cotizacion.numero ?? 0).padStart(7, '0')
  const resumen = cotizacion.resumen || {}

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Cotización #{numeroFormateado}
          </h1>
          <p className="text-slate-600 mt-1">{cotizacion.cliente?.nombre}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => electronAPI.generarYGuardarPdf(id)}
            className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            Generar y Guardar PDF
          </button>
          <button
            onClick={async () => {
              const folder = await electronAPI.selectPdfFolder()
              if (folder) setPdfFolder(folder)
            }}
            className="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg font-medium transition-colors"
          >
            Cambiar carpeta de PDFs
          </button>
        </div>
        <div className="text-sm text-slate-500">
          {folderLoading ? 'Cargando carpeta de PDFs...' : pdfFolder ? `PDFs se guardarán en: ${pdfFolder}` : 'Aún no se ha seleccionado carpeta para guardar los PDFs.'}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Cliente</h2>
          <dl className="space-y-2 text-sm text-slate-600">
            <div><span className="font-medium text-slate-700">Nombre:</span> {cotizacion.cliente?.nombre}</div>
            {cotizacion.cliente?.direccion && <div><span className="font-medium text-slate-700">Dirección:</span> {cotizacion.cliente.direccion}</div>}
            {cotizacion.cliente?.telefono && <div><span className="font-medium text-slate-700">Teléfono:</span> {cotizacion.cliente.telefono}</div>}
            {cotizacion.cliente?.rif && <div><span className="font-medium text-slate-700">RIF:</span> {cotizacion.cliente.rif}</div>}
          </dl>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Totales</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span className="tabular-nums">{formatMoney(resumen.subtotalGeneral)}</span>
            </div>
            {resumen.aplicaIVA && (
              <div className="flex justify-between text-slate-600">
                <span>IVA</span>
                <span className="tabular-nums">{formatMoney(resumen.montoIVA)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-slate-900 pt-2 border-t border-slate-200">
              <span>Total</span>
              <span className="tabular-nums">{formatMoney(resumen.total)}</span>
            </div>
          </dl>
        </div>
      </div>

      {cotizacion.observaciones && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Observaciones</h2>
          <p className="text-sm text-slate-600 whitespace-pre-line">{cotizacion.observaciones}</p>
        </div>
      )}

      <div>
        <Link to="/" className="text-teal-600 hover:text-teal-700 font-medium">
          ← Volver al listado
        </Link>
      </div>
    </div>
  )
}

function formatMoney(n) {
  return new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n))
}
