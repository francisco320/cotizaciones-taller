# Cotizaciones JS

Sistema integral para la gestión, creación y generación de cotizaciones en PDF. Desarrollado con el stack MERN (MongoDB, Express, React, Node.js).

## 🚀 Características

*   **Gestión de Cotizaciones:** Crear, editar, ver, listar y eliminar cotizaciones.
*   **Generación de PDF:** PDF dinámico con diseño profesional usando `pdfkit`.
*   **Cálculos Automáticos:** Subtotales, IVA (configurable) y totales calculados en tiempo real.
*   **Interfaz Moderna:** Frontend reactivo construido con Vite y estilizado con Tailwind CSS.
*   **Vista Previa:** Previsualización instantánea del PDF generado en el navegador.

## 🛠️ Tecnologías

### Backend
*   **Node.js** & **Express**: Servidor API RESTful.
*   **MongoDB** & **Mongoose**: Base de datos NoSQL y modelado de objetos.
*   **PDFKit**: Librería robusta para la generación de documentos PDF.

### Frontend
*   **React**: Biblioteca para construir interfaces de usuario.
*   **Vite**: Entorno de desarrollo ultrarrápido.
*   **Tailwind CSS**: Framework de utilidades CSS para diseño rápido y responsivo.
*   **React Router**: Enrutamiento declarativo para aplicaciones React.

## 📂 Estructura del Proyecto

```
cotizaciones-js/
├── src/                # Lógica del Backend
│   ├── config/         # Configuración (BD, etc.)
│   ├── lib/            # Funciones puras y cálculos de negocio
│   ├── models/         # esquemas de Mongoose (Cotizacion, Counter)
│   ├── pdf/            # Generación y diseño de PDF (Layout, Generator)
│   ├── routes/         # Definición de rutas de la API
│   ├── services/       # Lógica de negocio y casos de uso
│   ├── app.js          # Configuración de la aplicación Express
│   └── index.js        # Punto de entrada del servidor
├── frontend/           # Aplicación React
│   ├── src/
│   │   ├── api/        # Cliente HTTP para conectar con el backend
│   │   ├── components/ # Componentes reutilizables
│   │   ├── config/     # Configuración del frontend (Datos empresa, etc.)
│   │   ├── pages/      # Vistas de la aplicación
│   │   └── lib/        # Utilidades compartidas (cálculos)
│   └── ...
├── scripts/            # Scripts de utilidad y pruebas
└── ...
```

## ⚙️ Instalación y Configuración

### Prerrequisitos
*   Node.js (v18+ recomendado)
*   MongoDB (corriendo localmente o URI remota)
*   pnpm (o npm)

### 1. Clonar el repositorio
```bash
git clone <url-del-repositorio>
cd cotizaciones-js
```

### 2. Configurar el Backend

Instalar dependencias:
```bash
npm install
# o con pnpm
pnpm install
```

Variables de entorno (opcional):
Puedes crear un archivo `.env` en la raíz o configurar las variables en tu entorno.
*   `PORT`: Puerto del servidor (por defecto `3000`).
*   `MONGODB_URI`: Cadena de conexión a MongoDB (por defecto `mongodb://localhost:27017/cotizaciones`).
*   `LOGO_PATH`: Ruta al archivo de imagen para el logo en el PDF.

Iniciar el servidor de desarrollo:
```bash
npm run dev
```

### 3. Configurar el Frontend

Navegar al directorio del frontend e instalar dependencias:
```bash
cd frontend
npm install
# o con pnpm
pnpm install
```

Iniciar el servidor de desarrollo del frontend:
```bash
npm run dev
```

El frontend estará disponible generalmente en `http://localhost:5173`.

## 📖 Uso

1.  Abre el frontend en tu navegador.
2.  Navega a "Nueva Cotización" para crear un documento.
3.  Ingresa los datos del cliente, vehículo e ítems.
4.  Guarda la cotización.
5.  Desde el listado o el detalle, puedes:
    *   **Ver PDF:** Abre una vista previa en el navegador.
    *   **Descargar PDF:** Descarga el archivo generado.
    *   **Editar:** Modifica los datos de la cotización.
    *   **Borrar:** Elimina la cotización permanentemente.

## 🔧 Personalización

*   **Datos de la Empresa:** Edita `frontend/src/config/company.js` para cambiar el nombre, RIF, dirección, teléfono y email que aparecen por defecto en los formularios.
*   **Diseño del PDF:** Modifica `src/pdf/layout.js` para ajustar márgenes, colores y tamaños de fuente.
*   **Lógica PDF:** Edita `src/pdf/generator.js` para cambiar la estructura y contenido del PDF.

## 📄 Licencia

Este proyecto está bajo la Licencia MIT.
