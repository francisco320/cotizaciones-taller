import { useState, useCallback, useEffect } from 'react';

export function useInventario() {
    const [productos, setProductos] = useState([]);
    const [stats, setStats] = useState({ total: 0, agotados: 0, bajoStock: 0, valorTotal: 0 });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchInventario = useCallback(async (search = '') => {
        setLoading(true);
        setError(null);
        try {
            const response = await window.electronAPI.getInventory(search);
            if (response.success) {
                setProductos(response.data);
                setStats(response.stats);
            } else {
                setError(response.error || 'Error al cargar el inventario');
            }
        } catch (err) {
            console.error('Error fetching inventario:', err);
            setError('Error de conexión con el servicio local.');
        } finally {
            setLoading(false);
        }
    }, []);

    // Debounced search
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            fetchInventario(searchTerm);
        }, 300); // 300ms debounce
        return () => clearTimeout(timeoutId);
    }, [searchTerm, fetchInventario]);

    const createProduct = async (data) => {
        const response = await window.electronAPI.createProduct(data);
        if (response.success) {
            await fetchInventario(searchTerm);
        }
        return response;
    };

    const updateProduct = async (id, data) => {
        const response = await window.electronAPI.updateProduct(id, data);
        if (response.success) {
            await fetchInventario(searchTerm);
        }
        return response;
    };

    const deleteProduct = async (id) => {
        const response = await window.electronAPI.deleteProduct(id);
        if (response.success) {
            await fetchInventario(searchTerm);
        }
        return response;
    };

    const updateStock = async (id, newStock) => {
        const response = await window.electronAPI.updateProductStock(id, newStock);
        if (response.success) {
            await fetchInventario(searchTerm);
        }
        return response;
    };

    return {
        productos,
        stats,
        loading,
        error,
        searchTerm,
        setSearchTerm,
        fetchInventario,
        createProduct,
        updateProduct,
        deleteProduct,
        updateStock
    };
}
