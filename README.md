# Cotizaciones Taller (Electron + SQLite y web móvil)

Aplicación de escritorio offline para gestionar cotizaciones automotrices con generación de PDFs y un flujo web móvil online para crear cotizaciones en Supabase.

## 🧭 Descripción

Esta app es un proyecto Electron + React + SQLite para crear, editar, listar, eliminar cotizaciones y generar PDFs profesionales.

## ✅ Características principales

- CRUD de cotizaciones (SQLite en el proceso main)
- Items de cotización con cálculos automáticos (subtotal, IVA, total)
- Generación de PDF con `pdfkit`
- Previsualización de PDF embebido en la UI
- Guardado de PDFs en carpeta seleccionada por el usuario
- Configuración local de carpeta de PDFs (`electron-store` o fallback JSON)
- Creación de cotizaciones desde el navegador del celular para usuarios autenticados

## 📁 Estructura del proyecto

```
cotizaciones-js/
├── electron/            # Lógica de Electron (DB SQLite, PDF, preload)
├── frontend/            # App React + Vite
├── assets/              # Iconos / recursos
├── database.sqlite*     # Base de datos SQLite local (runtime)
├── main.js              # Proceso principal de Electron
├── package.json         # Scripts y dependencias Electron
└── README.md            # Este archivo
```

## 🧰 Tecnologías

- Electron
- React + Vite
- better-sqlite3 (SQLite)
- PDFKit (generación de PDF)
- Tailwind CSS (UI)
- uuid

## 🚀 Instalación y desarrollo

1. Instala dependencias en la raíz

```bash
cd /home/franciscojose/Documents/cotizaciones-js
pnpm install
```

2. Instala dependencias del frontend

```bash
cd frontend
pnpm install
```

3. Ejecuta en modo desarrollo

```bash
cd /home/franciscojose/Documents/cotizaciones-js
pnpm run dev
```

Esto ejecuta `pnpm run dev:electron`, que arranca Vite y luego inicia Electron.

### Scripts útiles

- `pnpm run dev`: run frontend + electron (desarrollo)
- `pnpm run dev:frontend`: arranca solo Vite
- `pnpm run dev:electron`: arranca frontend + electron con `wait-on`
- `pnpm run start`: iniciar la app empaquetada local (Electron)
- `pnpm run build`: compila frontend para producción
- `pnpm run dist`: build + empaquetado con electron-builder

> Nota: `pnpm run postinstall` ejecuta `electron-rebuild` para `better-sqlite3`.

## 📝 Uso básico

1. Abre la app.
2. Crea una cotización nueva (cliente, vehículo/bomba, items, IVA, observaciones).
3. Guarda.
4. Desde el listado puedes ver, editar, borrar y previsualizar PDF.
5. En el detalle puedes generar y guardar el PDF en una carpeta seleccionada.

## 🔧 Configuración específica

### Carpeta de PDFs

La app recuerda la carpeta de PDF con `electron-store`. Si no hay carpeta configurada, pide una al primer uso.

### Base de datos

SQLite se almacena en:
- En desarrollo: `database.sqlite` en la raíz
- En empaquetado: `${app.getPath('userData')}/database.sqlite`

### Sincronización con Supabase

SQLite continúa siendo la fuente de datos local. La sincronización requiere que
el proceso de Electron reciba `SUPABASE_URL` y `SUPABASE_ANON_KEY` como variables
de entorno; la aplicación no lee archivos `.env`. No configures una clave
`service_role`.

En PowerShell, configura las variables solo para la sesión de desarrollo antes
de ejecutar `pnpm run dev`:

```powershell
$env:SUPABASE_URL = "https://<project-ref>.supabase.co"
$env:SUPABASE_ANON_KEY = "<publishable-key>"
pnpm run dev
```

En desarrollo, la autenticación utiliza cuentas existentes de Supabase; la
sesión se conserva cifrada cuando Electron dispone de almacenamiento seguro.

Los comandos `pnpm run dist:win`, `pnpm run dist:linux` y `pnpm run dist:mac`
generan una configuración de Supabase dentro del paquete usando las variables
de entorno `SUPABASE_URL` y `SUPABASE_ANON_KEY`, o los valores `VITE_SUPABASE_URL`
y `VITE_SUPABASE_ANON_KEY` de `frontend/.env.local`. Así, quienes instalen el
programa no tienen que configurar variables de Windows. Para GitHub Actions,
define `SUPABASE_URL` como variable del repositorio y `SUPABASE_ANON_KEY` como
secreto del repositorio. Solo uses una clave publishable/anon; nunca incluyas
una clave `service_role`.

Antes de habilitar sincronización en una instalación, ejecuta manualmente
`supabase/migrations/202611020002_sync_rpc.sql` en el SQL Editor del proyecto.
La aplicación local no ejecuta migraciones remotas. Luego inicia sesión desde
el indicador de sincronización. Sin conexión o sin sesión, las operaciones
locales continúan disponibles y se encolan para sincronización posterior.

### Web móvil

La aplicación detecta el navegador web y muestra un formulario móvil separado
del flujo Electron/SQLite. La web requiere internet y una sesión existente de
Supabase Auth; no ofrece registro público. El formulario busca clientes activos
y permite consultar cotizaciones paginadas con sus ítems. Las cotizaciones
pueden exportarse a PDF desde el navegador. El formulario guarda la cotización
junto con sus ítems mediante `sync_save_cotizacion`, que asigna el folio en
Supabase.

Configura estas variables en `frontend/.env.local` para desarrollo o en el
entorno del hosting:

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<publishable-or-anon-key>
```

La clave publicable/anon es visible para el navegador y no reemplaza RLS.
Nunca uses una `service_role` key en variables `VITE_*`. La configuración de
Auth debe mantener deshabilitado el registro público. Las políticas actuales
permiten operaciones a cualquier usuario autenticado; limita las cuentas que
pueden iniciar sesión y revisa RLS antes de ampliar el acceso.

El despliegue estático usa el build `frontend/dist` generado por `pnpm run
build`. Configura ambas variables `VITE_*` en el proveedor antes de construir.
La web crea cotizaciones en Supabase; el sistema de sincronización de Electron
las descargará a SQLite durante su siguiente ciclo de sincronización.

### Cambios en PDF

El diseño y generación de PDF están en `electron/layout.js` y `electron/pdfGenerator.js`.

## 🧪 Validación rápida

- Abrir el proyecto y ejecutar `pnpm run dev`
- Crear un nuevo registro en `frontend`
- Generar PDF y verificar archivo guardado
- Abrir y eliminar cotizaciones

## 📦 Empaquetado

- `pnpm run dist:linux`
- `pnpm run dist:win`
- `pnpm run dist:mac`

## ⚠️ Notas importantes

- Asegúrate de ejecutar `pnpm install` en la raíz y en `frontend` antes de correr `pnpm run dev`.
- Si el PDF no se genera, verifica la carpeta de salida (seleccionada por usuario).

## Licencia

MIT
