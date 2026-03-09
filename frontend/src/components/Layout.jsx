import { Link, Outlet } from 'react-router-dom'
import logo from '../assets/logo.png'

export function Layout() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <img src={logo} alt="Logo" className="h-8 w-auto" />
            <span className="text-xl font-semibold text-slate-900">Cotizaciones</span>
          </Link>
          <nav className="flex gap-4">
            <Link
              to="/"
              className="text-slate-600 hover:text-teal-600 font-medium"
            >
              Listado
            </Link>
            <Link
              to="/nueva"
              className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              Nueva cotización
            </Link>
          </nav>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
