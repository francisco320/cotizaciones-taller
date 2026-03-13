# Cotizaciones JS (Electron + SQLite)

Aplicación de escritorio offline para gestionar cotizaciones automotrices con generación de PDFs.

## 🧭 Descripción

Esta app es un proyecto Electron + React + SQLite para crear, editar, listar, eliminar cotizaciones y generar PDFs profesionales.

## ✅ Características principales

- CRUD de cotizaciones (SQLite en el proceso main)
- Items de cotización con cálculos automáticos (subtotal, IVA, total)
- Generación de PDF con `pdfkit`
- Previsualización de PDF embebido en la UI
- Guardado de PDFs en carpeta seleccionada por el usuario
- Configuración local de carpeta de PDFs (`electron-store` o fallback JSON)

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
