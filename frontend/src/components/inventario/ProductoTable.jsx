import React from 'react';
import { StockBadge } from './StockBadge';

export function ProductoTable({ productos, loading, onEdit, onDelete }) {
    const formatCurrency = (val) => {
        return new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD' }).format(val || 0);
    };

    if (loading) {
        return (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="animate-pulse flex flex-col">
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="flex space-x-4 p-4 border-b border-slate-100">
                            <div className="h-4 bg-slate-200 rounded w-1/6"></div>
                            <div className="h-4 bg-slate-200 rounded w-1/4"></div>
                            <div className="h-4 bg-slate-200 rounded w-1/6"></div>
                            <div className="h-4 bg-slate-200 rounded w-1/6"></div>
                            <div className="h-4 bg-slate-200 rounded w-1/6"></div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (!productos || productos.length === 0) {
        return (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
                <svg className="mx-auto h-12 w-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-slate-900">No hay productos</h3>
                <p className="mt-1 text-sm text-slate-500">
                    Comienza agregando un nuevo producto al inventario.
                </p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                Código
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                Producto
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                Categoría
                            </th>
                            <th scope="col" className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                Precio Venta
                            </th>
                            <th scope="col" className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                Stock
                            </th>
                            <th scope="col" className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                Estado
                            </th>
                            <th scope="col" className="relative px-6 py-3">
                                <span className="sr-only">Acciones</span>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                        {productos.map((producto) => (
                            <tr key={producto.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                                    {producto.codigo}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm font-medium text-slate-900">{producto.nombre}</div>
                                    {producto.proveedor && (
                                        <div className="text-xs text-slate-500">{producto.proveedor}</div>
                                    )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                    {producto.categoria || '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 text-right font-medium">
                                    {formatCurrency(producto.precioVenta)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 text-center font-semibold">
                                    {producto.stock}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                    <StockBadge stock={producto.stock} stockMinimo={producto.stockMinimo} />
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <button
                                        onClick={() => onEdit(producto)}
                                        className="text-teal-600 hover:text-teal-900 mr-4 transition-colors"
                                        title="Editar producto"
                                    >
                                        <svg className="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                    </button>
                                    <button
                                        onClick={() => onDelete(producto)}
                                        className="text-red-600 hover:text-red-900 transition-colors"
                                        title="Eliminar producto"
                                    >
                                        <svg className="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
