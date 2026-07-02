import React, { useState, useEffect } from 'react';
import { useInventario } from '../hooks/useInventario';
import { InventoryStats } from '../components/inventario/InventoryStats';
import { InventorySearch } from '../components/inventario/InventorySearch';
import { ProductoTable } from '../components/inventario/ProductoTable';
import { ProductoModal } from '../components/inventario/ProductoModal';

export function Inventario() {
    const {
        productos,
        stats,
        loading,
        error: fetchError,
        searchTerm,
        setSearchTerm,
        fetchInventario,
        createProduct,
        updateProduct,
        deleteProduct
    } = useInventario();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [actionError, setActionError] = useState(null);

    // Initial load
    useEffect(() => {
        fetchInventario();
    }, [fetchInventario]);

    const handleOpenCreateModal = () => {
        setSelectedProduct(null);
        setActionError(null);
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (producto) => {
        setSelectedProduct(producto);
        setActionError(null);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedProduct(null);
        setActionError(null);
    };

    const handleSubmit = async (formData) => {
        setActionLoading(true);
        setActionError(null);

        try {
            let response;
            if (selectedProduct) {
                response = await updateProduct(selectedProduct.id, formData);
            } else {
                response = await createProduct(formData);
            }

            if (response.success) {
                handleCloseModal();
            } else {
                setActionError(response.error || 'Ocurrió un error al guardar.');
            }
        } catch (error) {
            setActionError('Error de comunicación con el servicio.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleDelete = async (producto) => {
        if (window.confirm(`¿Estás seguro de que deseas eliminar el producto: ${producto.nombre}? Esta acción no se puede deshacer.`)) {
            try {
                const response = await deleteProduct(producto.id);
                if (!response.success) {
                    alert(response.error || 'Error al eliminar el producto.');
                }
            } catch (error) {
                alert('Error al intentar eliminar.');
            }
        }
    };

    return (
        <div className="space-y-6">
            {/* Encabezado Principal */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Inventario</h2>
                    <p className="text-sm text-slate-500 mt-1">
                        Gestiona tus productos, repuestos y existencias
                    </p>
                </div>
                <button
                    onClick={handleOpenCreateModal}
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-teal-600 rounded-lg shadow-sm hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 transition-colors"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Nuevo Producto
                </button>
            </div>

            {/* Error global (fetch) */}
            {fetchError && (
                <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg flex items-center gap-3">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {fetchError}
                </div>
            )}

            {/* Estadísticas */}
            <InventoryStats stats={stats} />

            {/* Buscador y Controles */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <InventorySearch value={searchTerm} onChange={setSearchTerm} />
                <div className="text-sm text-slate-500">
                    Mostrando <span className="font-semibold text-slate-900">{productos.length}</span> productos
                </div>
            </div>

            {/* Tabla */}
            <ProductoTable 
                productos={productos} 
                loading={loading} 
                onEdit={handleOpenEditModal}
                onDelete={handleDelete}
            />

            {/* Modal de Formulario */}
            <ProductoModal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                initialData={selectedProduct}
                onSubmit={handleSubmit}
                loading={actionLoading}
                error={actionError}
            />
        </div>
    );
}
