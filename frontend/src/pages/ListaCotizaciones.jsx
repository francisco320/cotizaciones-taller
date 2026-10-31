import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { electronAPI } from '../api/client'
import { resumenCotizacion } from '../lib/calculations'

export function ListaCotizaciones() {
  const [data, setData] = useState({ items: [], total: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [previewPdfId, setPreviewPdfId] = useState(null)
  const [pdfPath, setPdfPath] = useState(null)

  useEffect(() => {
    electronAPI
      .listar()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <p className="text-slate-600">Cargando cotizaciones...</p>
      </div>
    )
  }
  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
        Error: {error}
      </div>
    )
  }

  const filteredItems = data.items.filter((c) => {
    if (!search.trim()) return true
    return (c.cliente?.nombre || '').toLowerCase().includes(search.trim().toLowerCase())
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Cotizaciones</h1>
          <span className="text-slate-600 text-sm">{data.total} en total</span>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-600" htmlFor="search-client">
            Buscar cliente:
          </label>
          <input
            id="search-client"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nombre del cliente..."
            className="input w-64"
          />
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        {filteredItems.length === 0 ? (
          <div className="p-12 text-center text-slate-600">
            {data.items.length === 0 ? (
              <>No hay cotizaciones.{' '}
                <Link to="/nueva" className="text-teal-600 hover:underline font-medium">
                  Crear la primera
                </Link>
              </>
            ) : (
              <>No se encontraron cotizaciones que coincidan con «{search}».</>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-slate-200">
            {filteredItems.map((c) => (
              <li key={c._id} className="flex items-center justify-between px-4 py-4 hover:bg-slate-50 transition-colors group">
                <Link to={`/cotizacion/${c._id}`} className="flex-1 min-w-0 pr-4">
                  <div>
                    <span className="font-medium text-slate-900">
                      #{String(c.numero).padStart(7, '0')}
                    </span>
                    <span className="mx-2 text-slate-400">·</span>
                    <span className="text-slate-600 truncate">{c.cliente?.nombre || 'Sin cliente'}</span>
                  </div>
                </Link>

                <div className="flex items-center gap-4">
                  <span className="text-slate-500 text-sm tabular-nums font-medium">
                    {getTotal(c)}
                  </span>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={async () => {
                        const path = await window.electronAPI.getPdfPath(String(c.numero).padStart(7, '0'));
                        setPdfPath(path);
                        setPreviewPdfId(c._id);
                      }}
                      className="text-xs font-medium text-teal-600 hover:text-teal-800 bg-teal-50 hover:bg-teal-100 px-2.5 py-1.5 rounded"
                    >
                      Ver PDF
                    </button>
                    <Link
                      to={`/cotizacion/${c._id}/editar`}
                      className="text-xs font-medium text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded"
                    >
                      Editar
                    </Link>
                    <button
                      onClick={() => {
                        if (window.confirm('¿Eliminar esta cotización?')) {
                          electronAPI.eliminar(c._id).then(() => {
                            setData(d => ({ ...d, items: d.items.filter(i => i._id !== c._id), total: d.total - 1 }))
                          })
                        }
                      }}
                      className="text-xs font-medium text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 px-2.5 py-1.5 rounded"
                    >
                      Borrar
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {previewPdfId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h3 className="font-semibold text-slate-800">Previsualizar Cotización</h3>
              <button
                onClick={() => {
                  setPreviewPdfId(null);
                  setPdfPath(null);
                }}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-500"
              >
                Cerrar
              </button>
            </div>
            <div className="flex-1 bg-slate-100">
             {pdfPath && (
  <iframe
    src={pdfPath}
    className="w-full h-full border-none"
    title="Vista previa PDF"
  />
)}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function getTotal(c) {
  if (c.resumen?.total != null) return formatMoney(c.resumen.total)
  if (c.items?.length) {
    const r = resumenCotizacion(c.items, c.aplicaIVA, c.porcentajeIVA)
    return formatMoney(r.total)
  }
  return '—'
}

function formatMoney(n) {
  return new Intl.NumberFormat('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(n))
}
