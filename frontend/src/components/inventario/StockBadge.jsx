import React from 'react';

export function StockBadge({ stock, stockMinimo }) {
    if (stock <= 0) {
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                Agotado
            </span>
        );
    }

    if (stock <= stockMinimo) {
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                Stock Bajo
            </span>
        );
    }

    return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            Normal
        </span>
    );
}
