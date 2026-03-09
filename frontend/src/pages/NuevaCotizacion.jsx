import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { electronAPI } from '../api/client'
import { resumenCotizacion } from '../lib/calculations'
import COMPANY from '../config/company'

const emptyItem = () => ({ descripcion: '', precioBase: 0, cantidad: 1 })
const defaultCliente = { nombre: '', direccion: '', telefono: '', rif: '' }
const defaultVehiculo = { vehiculo: '', modelo: '', color: '', placa: '' }

export function NuevaCotizacion() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEditing = Boolean(id)

  const [fechaVencimiento, setFechaVencimiento] = useState('')
  const [cliente, setCliente] = useState(defaultCliente)
  const [tipoServicio, setTipoServicio] = useState('vehiculo')

  // Vehiculo fields
  const [vehiculoTexto, setVehiculoTexto] = useState('')
  const [modelo, setModelo] = useState('')
  const [placa, setPlaca] = useState('')
  const [color, setColor] = useState('')

  // Bomba inyeccion fields
  const [marcaBomba, setMarcaBomba] = useState('')
  const [modeloBomba, setModeloBomba] = useState('')
  const [serialBomba, setSerialBomba] = useState('')

  const [items, setItems] = useState([emptyItem()])
  const [aplicaIVA, setAplicaIVA] = useState(false)
  const [porcentajeIVA, setPorcentajeIVA] = useState(16)
  const [elaboradoPor, setElaboradoPor] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (isEditing) {
      electronAPI.obtener(id)
        .then(data => {
          setFechaVencimiento(data.fechaVencimiento ? data.fechaVencimiento.split('T')[0] : '')
          setCliente(data.cliente || defaultCliente)

          setTipoServicio(data.tipoServicio || 'vehiculo')
          setVehiculoTexto(data.vehiculoTexto || '')
          setModelo(data.modelo || data.vehiculo?.modelo || '')
          setPlaca(data.placa || data.vehiculo?.placa || '')
          setColor(data.color || data.vehiculo?.color || '')

          setMarcaBomba(data.marcaBomba || data.vehiculo?.marca || '')
          setModeloBomba(data.modeloBomba || '')
          setSerialBomba(data.serialBomba || data.vehiculo?.serial || '')

          setItems(data.items && data.items.length > 0 ? data.items : [emptyItem()])
          setAplicaIVA(data.aplicaIVA)
          setPorcentajeIVA(data.porcentajeIVA)
          setElaboradoPor(data.elaboradoPor || '')
          setObservaciones(data.observaciones || '')
        })
        .catch(err => setError(err.message))
    }
  }, [id, isEditing])

  const resumen = resumenCotizacion(items, aplicaIVA, porcentajeIVA)

  const updateCliente = (key, value) => setCliente((c) => ({ ...c, [key]: value }))
  const updateVehiculo = (key, value) => setVehiculo((v) => ({ ...v, [key]: value }))

  const updateItem = (index, key, value) => {
    setItems((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [key]: key === 'descripcion' ? value : (key === 'cantidad' || key === 'precioBase' ? Number(value) || 0 : value) }
      return next
    })
  }
  const addItem = () => setItems((prev) => [...prev, emptyItem()])
  const removeItem = (index) => {
    if (items.length <= 1) return
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    setError(null)
    setSaving(true)
    const payload = {
      empresa: COMPANY,
      fechaVencimiento: fechaVencimiento || undefined,
      cliente,
      tipoServicio,
      vehiculo: tipoServicio === 'vehiculo' ? vehiculoTexto : undefined,
      modelo: tipoServicio === 'vehiculo' ? modelo : undefined,
      placa: tipoServicio === 'vehiculo' ? placa : undefined,
      color: tipoServicio === 'vehiculo' ? color : undefined,
      marcaBomba: tipoServicio === 'bomba_inyeccion' ? marcaBomba : undefined,
      modeloBomba: tipoServicio === 'bomba_inyeccion' ? modeloBomba : undefined,
      serialBomba: tipoServicio === 'bomba_inyeccion' ? serialBomba : undefined,
      items: items.filter((i) => i.descripcion.trim()),
      aplicaIVA,
      porcentajeIVA,
      elaboradoPor: elaboradoPor.trim() || undefined,
      observaciones: observaciones.trim() || undefined,
    }

    const promise = isEditing ? electronAPI.actualizar(id, payload) : electronAPI.crear(payload)

    promise
      .then((res) => navigate(`/cotizacion/${res._id}`))
      .catch((err) => setError(err.body?.error || err.message))
      .finally(() => setSaving(false))
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-slate-900">{isEditing ? 'Editar cotización' : 'Nueva cotización'}</h1>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        <section className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Empresa</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nombre</label>
              <p className="text-slate-900 font-medium">{COMPANY.nombre}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">RIF</label>
              <p className="text-slate-900">{COMPANY.rif}</p>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Dirección</label>
              <p className="text-slate-900">{COMPANY.direccion}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Teléfono</label>
              <p className="text-slate-900">{COMPANY.telefono}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <p className="text-slate-900">{COMPANY.email}</p>
            </div>
          </div>
          <div className="mt-4">
            <Input type="date" label="Fecha vencimiento" value={fechaVencimiento} onChange={setFechaVencimiento} />
          </div>
        </section>

        <section className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Cliente</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Nombre" value={cliente.nombre} onChange={(v) => updateCliente('nombre', v)} required />
            <Input label="RIF" value={cliente.rif} onChange={(v) => updateCliente('rif', v)} />
            <Input label="Dirección" value={cliente.direccion} onChange={(v) => updateCliente('direccion', v)} className="sm:col-span-2" />
            <Input label="Teléfono" value={cliente.telefono} onChange={(v) => updateCliente('telefono', v)} />
          </div>
        </section>

        <section className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Servicio</h2>
            <select
              value={tipoServicio}
              onChange={(e) => setTipoServicio(e.target.value)}
              className="input text-sm py-1.5"
            >
              <option value="vehiculo">Vehículo</option>
              <option value="bomba_inyeccion">Bomba de Inyección</option>
            </select>
          </div>

          {tipoServicio === 'vehiculo' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Vehículo" value={vehiculoTexto} onChange={setVehiculoTexto} />
              <Input label="Modelo" value={modelo} onChange={setModelo} />
              <Input label="Color" value={color} onChange={setColor} />
              <Input label="Placa" value={placa} onChange={setPlaca} />
            </div>
          )}

          {tipoServicio === 'bomba_inyeccion' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Marca" value={marcaBomba} onChange={setMarcaBomba} />
              <Input label="Modelo" value={modeloBomba} onChange={setModeloBomba} />
              <Input label="Serial" value={serialBomba} onChange={setSerialBomba} className="sm:col-span-2" />
            </div>
          )}
        </section>

        <section className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Observaciones</h2>
          <textarea
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            rows={3}
            placeholder="Observaciones generales sobre la cotización..."
            className="input w-full resize-y"
          />
        </section>

        <section className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Ítems</h2>
            <button
              type="button"
              onClick={addItem}
              className="text-sm font-medium text-teal-600 hover:text-teal-700"
            >
              + Añadir fila
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left p-3 font-medium text-slate-700">Descripción</th>
                  <th className="text-right p-3 font-medium text-slate-700 w-28">Precio base</th>
                  <th className="text-right p-3 font-medium text-slate-700 w-24">Cantidad</th>
                  <th className="text-right p-3 font-medium text-slate-700 w-28">Subtotal</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="p-2">
                      <input
                        type="text"
                        value={item.descripcion}
                        onChange={(e) => updateItem(i, 'descripcion', e.target.value)}
                        className="input w-full"
                        placeholder="Descripción"
                      />
                    </td>
                    <td className="p-2 text-right">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.precioBase || ''}
                        onChange={(e) => updateItem(i, 'precioBase', e.target.value)}
                        className="input w-full text-right tabular-nums"
                      />
                    </td>
                    <td className="p-2 text-right">
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={item.cantidad ?? ''}
                        onChange={(e) => updateItem(i, 'cantidad', e.target.value)}
                        className="input w-full text-right tabular-nums"
                      />
                    </td>
                    <td className="p-2 text-right tabular-nums text-slate-600">
                      {formatMoney(resumen.items[i]?.subtotal ?? 0)}
                    </td>
                    <td className="p-2">
                      <button
                        type="button"
                        onClick={() => removeItem(i)}
                        disabled={items.length <= 1}
                        className="text-slate-400 hover:text-red-600 disabled:opacity-50"
                        aria-label="Quitar fila"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Totales</h2>
          <div className="flex flex-wrap items-center gap-6 mb-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={aplicaIVA}
                onChange={(e) => setAplicaIVA(e.target.checked)}
                className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
              />
              <span className="text-slate-700">Incluir IVA</span>
            </label>
            {aplicaIVA && (
              <div className="flex items-center gap-2">
                <label className="text-slate-600 text-sm">%</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={porcentajeIVA}
                  onChange={(e) => setPorcentajeIVA(Number(e.target.value) || 0)}
                  className="input w-20 text-right tabular-nums"
                />
              </div>
            )}
          </div>
          <div className="space-y-2 text-slate-600">
            <p className="flex justify-between max-w-xs">
              <span>Subtotal</span>
              <span className="tabular-nums font-medium">{formatMoney(resumen.subtotalGeneral)}</span>
            </p>
            {aplicaIVA && (
              <p className="flex justify-between max-w-xs">
                <span>IVA</span>
                <span className="tabular-nums font-medium">{formatMoney(resumen.montoIVA)}</span>
              </p>
            )}
            <p className="flex justify-between max-w-xs text-slate-900 font-semibold text-base pt-2">
              <span>Total</span>
              <span className="tabular-nums">{formatMoney(resumen.total)}</span>
            </p>
          </div>
          <div className="mt-4">
            <Input label="Elaborado por" value={elaboradoPor} onChange={setElaboradoPor} />
          </div>
        </section>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-2.5 rounded-lg font-medium disabled:opacity-50 transition-colors"
          >
            {saving ? 'Guardando...' : 'Guardar cotización'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 px-6 py-2.5 rounded-lg font-medium transition-colors"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}

function Input({ label, value, onChange, type = 'text', required, className = '' }) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="input"
      />
    </div>
  )
}

function formatMoney(n) {
  return new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n))
}
