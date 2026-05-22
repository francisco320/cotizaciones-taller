import { Link, Outlet, useLocation } from 'react-router-dom'
import logo from '../assets/logo.png'

export function Layout() {
  const location = useLocation();

  const navItems = [
    { name: 'Cotizaciones', path: '/' },
    { name: 'Clientes', path: '/clientes' }
  ];

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col transition-all duration-300 shadow-xl z-20">
        <div className="h-16 flex items-center px-6 border-b border-slate-800 shrink-0">
          <Link to="/" className="flex items-center gap-3">
            <img src={logo} alt="Logo" className="h-8 w-auto brightness-0 invert" />
            <span className="text-lg font-bold text-white tracking-wide">Sistema</span>
          </Link>
        </div>
        
        <div className="p-4 flex-1 overflow-y-auto">
          <div className="mb-6">
            <p className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Menú Principal
            </p>
            <nav className="space-y-1">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
                return (
                  <Link
                    key={item.name}
                    to={item.path}
                    className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                      isActive 
                        ? 'bg-teal-600 text-white font-medium' 
                        : 'hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    {item.name}
                  </Link>
                )
              })}
            </nav>
          </div>
        </div>

        <div className="p-4 border-t border-slate-800">
          <Link
            to="/nueva"
            className="w-full flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-400 text-slate-900 font-semibold px-4 py-2 rounded-lg transition-colors shadow-sm"
          >
            <span>+ Nueva Cotización</span>
          </Link>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Top Header (Optional for mobile toggle in future) */}
        <header className="h-16 bg-white border-b border-slate-200 shrink-0 flex items-center px-6 shadow-sm z-10 justify-between">
          <h1 className="text-xl font-semibold text-slate-800">
            {location.pathname === '/clientes' ? 'Gestión de Clientes' : 
             location.pathname === '/nueva' ? 'Nueva Cotización' : 
             location.pathname.startsWith('/cotizacion/') ? 'Detalle de Cotización' : 
             'Listado de Cotizaciones'}
          </h1>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="max-w-6xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
