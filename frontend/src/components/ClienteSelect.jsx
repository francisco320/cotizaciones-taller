import { useState, useEffect, useRef } from 'react';
import { clientesAPI } from '../api/client';
import { ClienteModal } from './ClienteModal';

export function ClienteSelect({ value, onChange, onClientSelect }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState(value || '');
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    setSearch(value || '');
  }, [value]);

  useEffect(() => {
    if (!isOpen) return;

    const fetchClientes = async () => {
      setLoading(true);
      try {
        const data = await clientesAPI.listar(search);
        setClientes(data || []);
      } catch (err) {
        console.error('Error fetching clientes:', err);
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(() => {
      fetchClientes();
    }, 300);

    return () => clearTimeout(timer);
  }, [search, isOpen]);

  // Handle outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (cliente) => {
    onChange(cliente.nombre);
    if (onClientSelect) {
      onClientSelect(cliente);
    }
    setIsOpen(false);
  };

  const handleModalSave = (newCliente) => {
    onChange(newCliente.nombre);
    if (onClientSelect) {
      onClientSelect(newCliente);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="block text-sm font-medium text-slate-700 mb-1">Nombre / Cliente *</label>
      <div className="relative">
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            onChange(e.target.value); // Keep allowing manual typing
            if (onClientSelect) onClientSelect(null)
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          required
          className="input w-full pr-10"
          placeholder="Buscar o ingresar cliente..."
          autoComplete="off"
        />
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="absolute right-2 top-1.5 p-1 text-teal-600 hover:text-teal-700 hover:bg-teal-50 rounded"
          title="Crear nuevo cliente"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
          </svg>
        </button>
      </div>

      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {loading ? (
            <div className="p-3 text-sm text-center text-slate-500">Buscando...</div>
          ) : clientes.length === 0 ? (
            <div className="p-3 text-sm text-center text-slate-500">
              {search ? 'No se encontraron clientes.' : 'Escribe para buscar...'}
              <button 
                type="button"
                onClick={() => { setIsOpen(false); setIsModalOpen(true); }}
                className="block w-full mt-2 text-teal-600 hover:underline font-medium"
              >
                Crear "{search}"
              </button>
            </div>
          ) : (
            <ul className="py-1">
              {clientes.map(cliente => (
                <li
                  key={cliente.id}
                  onClick={() => handleSelect(cliente)}
                  className="px-3 py-2 cursor-pointer hover:bg-slate-50 border-b border-slate-50 last:border-0"
                >
                  <div className="font-medium text-slate-900 text-sm">{cliente.nombre}</div>
                  <div className="text-xs text-slate-500 flex gap-2">
                    {cliente.rif && <span>RIF: {cliente.rif}</span>}
                    {cliente.telefono && <span>Tel: {cliente.telefono}</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <ClienteModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleModalSave}
        clienteToEdit={null}
      />
    </div>
  );
}
