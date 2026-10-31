import React from 'react';

export function InventoryStats({ stats }) {
    const { total = 0, agotados = 0, bajoStock = 0, valorTotal = 0 } = stats || {};

    const formatCurrency = (val) => {
        return new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD' }).format(val);
    };

    const cards = [
        {
            title: 'Total Productos',
            value: total,
            icon: (
                <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
            ),
            bg: 'bg-indigo-50',
            border: 'border-indigo-100'
        },
        {
            title: 'Agotados',
            value: agotados,
            icon: (
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
            ),
            bg: 'bg-red-50',
            border: 'border-red-100'
        },
        {
            title: 'Bajo Stock',
            value: bajoStock,
            icon: (
                <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
            ),
            bg: 'bg-amber-50',
            border: 'border-amber-100'
        },
        {
            title: 'Valor Inventario',
            value: formatCurrency(valorTotal),
            icon: (
                <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            ),
            bg: 'bg-emerald-50',
            border: 'border-emerald-100'
        }
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {cards.map((card, index) => (
                <div key={index} className={`rounded-xl border ${card.border} bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-md`}>
                    <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-lg ${card.bg}`}>
                            {card.icon}
                        </div>
                        <div>
                            <p className="text-sm font-medium text-slate-500">{card.title}</p>
                            <p className="text-2xl font-bold text-slate-800">{card.value}</p>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
