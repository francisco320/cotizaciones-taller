import { HashRouter, Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ListaCotizaciones } from './pages/ListaCotizaciones'
import { NuevaCotizacion } from './pages/NuevaCotizacion'
import { VerCotizacion } from './pages/VerCotizacion'
import { Clientes } from './pages/Clientes'
import { Respaldos } from './pages/Respaldos'

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<ListaCotizaciones />} />
          <Route path="clientes" element={<Clientes />} />
          <Route path="nueva" element={<NuevaCotizacion />} />
          <Route path="cotizacion/:id" element={<VerCotizacion />} />
          <Route path="cotizacion/:id/editar" element={<NuevaCotizacion />} />
          <Route path="respaldos" element={<Respaldos />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}

export default App
