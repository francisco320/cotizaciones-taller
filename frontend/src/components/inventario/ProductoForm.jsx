import React, { useState, useEffect } from 'react';

export function ProductoForm({ initialData = null, onSubmit, onCancel, loading }) {
    const [formData, setFormData] = useState({
        codigo: '',
        nombre: '',
        categoria: '',
        descripcion: '',
        stock: 0,
        stockMinimo: 0,
        precioCompra: 0,
        precioVenta: 0,
        proveedor: '',
        ubicacion: ''
    });

    const [errors, setErrors] = useState({});

    useEffect(() => {
        if (initialData) {
            setFormData({
                codigo: initialData.codigo || '',
                nombre: initialData.nombre || '',
                categoria: initialData.categoria || '',
                descripcion: initialData.descripcion || '',
                stock: initialData.stock || 0,
                stockMinimo: initialData.stockMinimo || 0,
                precioCompra: initialData.precioCompra || 0,
                precioVenta: initialData.precioVenta || 0,
                proveedor: initialData.proveedor || '',
                ubicacion: initialData.ubicacion || ''
            });
        }
    }, [initialData]);

    const validate = () => {
        const newErrors = {};
        if (!formData.codigo.trim()) newErrors.codigo = 'El código es requerido';
        if (!formData.nombre.trim()) newErrors.nombre = 'El nombre es requerido';
        if (formData.stock < 0) newErrors.stock = 'No puede ser negativo';
        if (formData.stockMinimo < 0) newErrors.stockMinimo = 'No puede ser negativo';
        if (formData.precioCompra < 0) newErrors.precioCompra = 'No puede ser negativo';
        if (formData.precioVenta < 0) newErrors.precioVenta = 'No puede ser negativo';
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (validate()) {
            onSubmit(formData);
        }
    };

    const handleChange = (e) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'number' ? (value === '' ? '' : Number(value)) : value
        }));
        // Clear error when typing
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: null }));
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Código */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        Código *
                    </label>
                    <input
                        type="text"
                        name="codigo"
                        value={formData.codigo}
                        onChange={handleChange}
                        disabled={loading}
                        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white ${
                            errors.codigo ? 'border-red-500' : 'border-slate-300'
                        }`}
                        placeholder="Ej. PROD-001"
                    />
                    {errors.codigo && <p className="mt-1 text-xs text-red-500">{errors.codigo}</p>}
                </div>

                {/* Nombre */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        Nombre *
                    </label>
                    <input
                        type="text"
                        name="nombre"
                        value={formData.nombre}
                        onChange={handleChange}
                        disabled={loading}
                        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white ${
                            errors.nombre ? 'border-red-500' : 'border-slate-300'
                        }`}
                        placeholder="Ej. Filtro de Aceite"
                    />
                    {errors.nombre && <p className="mt-1 text-xs text-red-500">{errors.nombre}</p>}
                </div>

                {/* Categoría */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        Categoría
                    </label>
                    <input
                        type="text"
                        name="categoria"
                        value={formData.categoria}
                        onChange={handleChange}
                        disabled={loading}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                        placeholder="Ej. Filtros"
                    />
                </div>

                {/* Proveedor */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        Proveedor
                    </label>
                    <input
                        type="text"
                        name="proveedor"
                        value={formData.proveedor}
                        onChange={handleChange}
                        disabled={loading}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                        placeholder="Nombre del proveedor"
                    />
                </div>

                {/* Stock Actual */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        Stock Actual
                    </label>
                    <input
                        type="number"
                        name="stock"
                        value={formData.stock}
                        onChange={handleChange}
                        min="0"
                        step="0.01"
                        disabled={loading}
                        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white ${
                            errors.stock ? 'border-red-500' : 'border-slate-300'
                        }`}
                    />
                    {errors.stock && <p className="mt-1 text-xs text-red-500">{errors.stock}</p>}
                </div>

                {/* Stock Mínimo */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        Stock Mínimo (Alerta)
                    </label>
                    <input
                        type="number"
                        name="stockMinimo"
                        value={formData.stockMinimo}
                        onChange={handleChange}
                        min="0"
                        step="0.01"
                        disabled={loading}
                        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white ${
                            errors.stockMinimo ? 'border-red-500' : 'border-slate-300'
                        }`}
                    />
                    {errors.stockMinimo && <p className="mt-1 text-xs text-red-500">{errors.stockMinimo}</p>}
                </div>

                {/* Precio Compra */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        Precio de Compra ($)
                    </label>
                    <input
                        type="number"
                        name="precioCompra"
                        value={formData.precioCompra}
                        onChange={handleChange}
                        min="0"
                        step="0.01"
                        disabled={loading}
                        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white ${
                            errors.precioCompra ? 'border-red-500' : 'border-slate-300'
                        }`}
                    />
                    {errors.precioCompra && <p className="mt-1 text-xs text-red-500">{errors.precioCompra}</p>}
                </div>

                {/* Precio Venta */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        Precio de Venta ($)
                    </label>
                    <input
                        type="number"
                        name="precioVenta"
                        value={formData.precioVenta}
                        onChange={handleChange}
                        min="0"
                        step="0.01"
                        disabled={loading}
                        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white ${
                            errors.precioVenta ? 'border-red-500' : 'border-slate-300'
                        }`}
                    />
                    {errors.precioVenta && <p className="mt-1 text-xs text-red-500">{errors.precioVenta}</p>}
                </div>

                {/* Ubicación */}
                <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        Ubicación Física (Opcional)
                    </label>
                    <input
                        type="text"
                        name="ubicacion"
                        value={formData.ubicacion}
                        onChange={handleChange}
                        disabled={loading}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                        placeholder="Ej. Estante A, Pasillo 2"
                    />
                </div>

                {/* Descripción */}
                <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        Descripción
                    </label>
                    <textarea
                        name="descripcion"
                        value={formData.descripcion}
                        onChange={handleChange}
                        rows="3"
                        disabled={loading}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white resize-none"
                        placeholder="Detalles adicionales del producto..."
                    />
                </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                    type="button"
                    onClick={onCancel}
                    disabled={loading}
                    className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200 transition-colors"
                >
                    Cancelar
                </button>
                <button
                    type="submit"
                    disabled={loading}
                    className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-colors disabled:opacity-70"
                >
                    {loading ? (
                        <>
                            <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Guardando...
                        </>
                    ) : (
                        initialData ? 'Actualizar Producto' : 'Guardar Producto'
                    )}
                </button>
            </div>
        </form>
    );
}
