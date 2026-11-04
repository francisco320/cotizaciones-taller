import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

const DesktopApp = lazy(() => import('./App.jsx'))
const WebMobileApp = lazy(() =>
  import('./web/WebMobileApp.jsx').then(module => ({ default: module.WebMobileApp })),
)
const AppEntry = window.electronAPI ? DesktopApp : WebMobileApp

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Suspense fallback={<main className="mobile-page mobile-content">Cargando…</main>}>
      <AppEntry />
    </Suspense>
  </StrictMode>,
)
