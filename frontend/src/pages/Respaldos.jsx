import { useState } from 'react';

export function Respaldos() {
    const [isExporting, setIsExporting] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [message, setMessage] = useState(null);
    const [showConfirm, setShowConfirm] = useState(false);

    const handleExport = async () => {
        setIsExporting(true);
        setMessage(null);
        try {
            const api = window.electronAPI || window.api;
            const result = await api.exportBackup();
            
            if (result.canceled) {
                setMessage({ type: 'info', text: 'Exportación cancelada.' });
            } else if (result.success) {
                setMessage({ type: 'success', text: `Respaldo exportado correctamente a: ${result.path}` });
            } else {
                setMessage({ type: 'error', text: `Error al exportar: ${result.error}` });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Error inesperado al exportar.' });
            console.error(error);
        } finally {
            setIsExporting(false);
        }
    };

    const handleImportClick = () => {
        setShowConfirm(true);
    };

    const confirmImport = async () => {
        setShowConfirm(false);
        setIsImporting(true);
        setMessage(null);
        
        try {
            const api = window.electronAPI || window.api;
            const result = await api.importBackup();
            
            if (result.canceled) {
                setMessage({ type: 'info', text: 'Importación cancelada.' });
            } else if (result.success) {
                setMessage({ type: 'success', text: 'Datos importados correctamente. Recargue la aplicación para ver los cambios.' });
            } else {
                setMessage({ type: 'error', text: `Error al importar: ${result.error}` });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Error inesperado al importar.' });
            console.error(error);
        } finally {
            setIsImporting(false);
        }
    };

    return (
        <div className="animate-fade-in">
            <div className="mb-8">
                <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">Respaldos y Seguridad</h2>
                <p className="text-slate-500 mt-2">Gestiona las copias de seguridad de todos tus datos, clientes y cotizaciones.</p>
            </div>

            {message && (
                <div className={`p-4 rounded-lg mb-6 border flex items-center gap-3 transition-all ${
                    message.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
                    message.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' :
                    'bg-blue-50 border-blue-200 text-blue-800'
                }`}>
                    {message.type === 'success' && (
                        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                    )}
                    {message.type === 'error' && (
                        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    )}
                    <p className="font-medium">{message.text}</p>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Export Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col hover:shadow-md transition-shadow">
                    <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center mb-4">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path>
                        </svg>
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2">Exportar Datos</h3>
                    <p className="text-slate-500 mb-6 flex-1">
                        Crea una copia de seguridad completa de todas tus cotizaciones, items y directorio de clientes en un archivo JSON seguro.
                    </p>
                    <button 
                        onClick={handleExport}
                        disabled={isExporting || isImporting}
                        className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {isExporting ? (
                            <>
                                <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Exportando...
                            </>
                        ) : 'Generar Respaldo'}
                    </button>
                </div>

                {/* Import Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col hover:shadow-md transition-shadow">
                    <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center mb-4">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                        </svg>
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2">Importar Datos</h3>
                    <p className="text-slate-500 mb-6 flex-1">
                        Restaura tu información desde un archivo de respaldo previo. <strong className="text-red-500 font-medium">Atención:</strong> Esta acción reemplazará todos los datos actuales.
                    </p>
                    <button 
                        onClick={handleImportClick}
                        disabled={isExporting || isImporting}
                        className="w-full py-3 px-4 bg-white border-2 border-slate-200 hover:border-orange-500 hover:text-orange-600 text-slate-700 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {isImporting ? 'Importando...' : 'Restaurar Respaldo'}
                    </button>
                </div>

            </div>

            {/* Confirm Modal */}
            {showConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 animate-scale-up">
                        <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-4 mx-auto">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                            </svg>
                        </div>
                        <h3 className="text-xl font-bold text-center text-slate-900 mb-2">¿Estás seguro?</h3>
                        <p className="text-slate-500 text-center mb-6">
                            Estás a punto de reemplazar todos los datos de la aplicación. Esta acción sobrescribirá las cotizaciones y clientes actuales.
                            <br/><br/>
                            <span className="text-xs font-semibold text-slate-400 uppercase">Se creará un backup automático por seguridad.</span>
                        </p>
                        <div className="flex gap-3">
                            <button 
                                onClick={() => setShowConfirm(false)}
                                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={confirmImport}
                                className="flex-1 py-2.5 px-4 rounded-xl bg-red-600 text-white font-medium hover:bg-red-700 transition-colors"
                            >
                                Sí, importar datos
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
