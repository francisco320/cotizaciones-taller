import { useState, useEffect } from 'react';
import { clientesAPI } from '../api/client';

export function ClienteModal({ isOpen, onClose, onSave, clienteToEdit = null }) {
  const [formData, setFormData] = useState({
    nombre: '',
    telefono: '',
    email: '',
    rif: '',
    direccion: '',
    ciudad: '',
    notas: ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (clienteToEdit) {
      setFormData({
        nombre: clienteToEdit.nombre || '',
        telefono: clienteToEdit.telefono || '',
        email: clienteToEdit.email || '',
        rif: clienteToEdit.rif || '',
        direccion: clienteToEdit.direccion || '',
        ciudad: clienteToEdit.ciudad || '',
        notas: clienteToEdit.notas || ''
      });
    } else {
      setFormData({
        nombre: '',
        telefono: '',
        email: '',
        rif: '',
        direccion: '',
        ciudad: '',
        notas: ''
      });
    }
  }, [clienteToEdit, isOpen]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.nombre.trim()) {
      setError('El nombre es obligatorio.');
      return;
    }
    
    setSaving(true);
    setError('');
    
    try {
      let result;
      if (clienteToEdit && clienteToEdit.id) {
        result = await clientesAPI.actualizar(clienteToEdit.id, formData);
      } else {
        result = await clientesAPI.crear(formData);
      }
      onSave(result);
      onClose();
    } catch (err) {
      setError(err.message || 'Error al guardar el cliente');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-xl font-semibold text-slate-800">
            {clienteToEdit ? 'Editar Cliente' : 'Nuevo Cliente'}
          </h2>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors text-2xl leading-none"
          >
            &times;
          </button>
        </div>
        
        <div 
          className="p-6 space-y-6"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
        >
          {error && (
            <div className="p-3 text-sm text-red-700 bg-red-50 rounded-lg border border-red-100">
              {error}
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Nombre / Razón Social *</label>
              <input 
                type="text" 
                name="nombre" 
                value={formData.nombre} 
                onChange={handleChange} 
                required
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-shadow" 
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">RIF / CI</label>
              <input 
                type="text" 
                name="rif" 
                value={formData.rif} 
                onChange={handleChange} 
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-shadow" 
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Teléfono</label>
              <input 
                type="text" 
                name="telefono" 
                value={formData.telefono} 
                onChange={handleChange} 
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-shadow" 
              />
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input 
                type="email" 
                name="email" 
                value={formData.email} 
                onChange={handleChange} 
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-shadow" 
              />
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Dirección</label>
              <input 
                type="text" 
                name="direccion" 
                value={formData.direccion} 
                onChange={handleChange} 
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-shadow" 
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Ciudad</label>
              <input 
                type="text" 
                name="ciudad" 
                value={formData.ciudad} 
                onChange={handleChange} 
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-shadow" 
              />
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Notas</label>
              <textarea 
                name="notas" 
                value={formData.notas} 
                onChange={handleChange} 
                rows="2"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-shadow resize-none" 
              ></textarea>
            </div>
          </div>
          
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button 
              type="button" 
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button 
              type="button" 
              onClick={(e) => {
                e.preventDefault();
                handleSubmit(e);
              }}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Guardar Cliente'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
