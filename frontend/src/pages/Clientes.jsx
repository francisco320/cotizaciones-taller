import { useState, useEffect } from 'react';
import { clientesAPI } from '../api/client';
import { ClienteModal } from '../components/ClienteModal';

export function Clientes() {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [clienteToEdit, setClienteToEdit] = useState(null);

  const fetchClientes = () => {
    setLoading(true);
    clientesAPI.listar(search)
      .then(data => {
        setClientes(data || []);
      })
      .catch(err => {
        console.error('Error fetching clientes:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchClientes();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const handleCreate = () => {
    setClienteToEdit(null);
    setIsModalOpen(true);
  };

  const handleEdit = (cliente) => {
    setClienteToEdit(cliente);
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('¿Está seguro de que desea eliminar este cliente?')) {
      try {
        await clientesAPI.eliminar(id);
        fetchClientes();
      } catch (err) {
        console.error('Error deleting cliente:', err);
        alert('Error al eliminar el cliente');
      }
    }
  };

  const handleModalSave = (savedCliente) => {
    fetchClientes();
  };

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:w-96">
          <input
            type="text"
            placeholder="Buscar por nombre o RIF..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 shadow-sm"
          />
          <svg className="w-5 h-5 text-slate-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
          </svg>
        </div>
        <button
          onClick={handleCreate}
          className="w-full sm:w-auto bg-teal-600 hover:bg-teal-700 text-white px-5 py-2.5 rounded-lg font-medium transition-colors shadow-sm flex items-center justify-center gap-2"
        >
          <span>+ Nuevo Cliente</span>
        </button>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 uppercase text-xs font-semibold">
              <tr>
                <th className="px-6 py-4">Cliente / RIF</th>
                <th className="px-6 py-4">Contacto</th>
                <th className="px-6 py-4 text-center">Cotizaciones</th>
                <th className="px-6 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="4" className="px-6 py-8 text-center text-slate-500">
                    <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-teal-600 border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
                    <p className="mt-2 text-sm">Cargando clientes...</p>
                  </td>
                </tr>
              ) : clientes.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-6 py-12 text-center text-slate-500">
                    <p className="text-lg font-medium text-slate-700 mb-1">No se encontraron clientes</p>
                    <p className="text-sm">Intenta con otros términos de búsqueda o crea un nuevo cliente.</p>
                  </td>
                </tr>
              ) : (
                clientes.map((cliente) => (
                  <tr key={cliente.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900">{cliente.nombre}</div>
                      <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                        {cliente.rif && <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200">{cliente.rif}</span>}
                        {cliente.ciudad && <span>{cliente.ciudad}</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {cliente.telefono && <div className="text-slate-700">{cliente.telefono}</div>}
                      {cliente.email && <div className="text-slate-500 text-xs mt-0.5">{cliente.email}</div>}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <span className="font-semibold text-slate-800 tabular-nums bg-slate-100 px-2.5 py-1 rounded-full text-xs">
                          {cliente.totalCotizaciones || 0}
                        </span>
                        {cliente.totalCotizaciones > 5 && (
                          <span className="mt-1 text-[10px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            Frecuente
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleEdit(cliente)}
                          className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-md transition-colors"
                          title="Editar"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path>
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(cliente.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                          title="Eliminar"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination placeholder (for future use) */}
        {!loading && clientes.length > 0 && (
          <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
            <span className="text-sm text-slate-500">Mostrando {clientes.length} resultados</span>
          </div>
        )}
      </div>

      <ClienteModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleModalSave}
        clienteToEdit={clienteToEdit}
      />
    </div>
  );
}
