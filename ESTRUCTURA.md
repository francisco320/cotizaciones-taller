# Estructura del proyecto – Sistema de cotizaciones

## Árbol de carpetas

```
cotizaciones-js/
├── src/
│   ├── config/
│   │   └── database.js      # Conexión MongoDB
│   ├── lib/
│   │   └── calculations.js  # Lógica pura: subtotales, IVA, total
│   ├── models/
│   │   ├── Cotizacion.js    # Schema Mongoose + virtual resumen
│   │   └── Counter.js       # Contador para número secuencial (7 dígitos)
│   ├── pdf/
│   │   ├── layout.js        # Constantes de diseño (márgenes, fuentes, colores)
│   │   └── generator.js     # Generación del PDF con PDFKit
│   ├── services/
│   │   └── cotizacion.service.js  # Crear, listar, obtener, generar PDF
│   ├── routes/
│   │   └── cotizaciones.js  # API REST: POST/GET, preview y descarga PDF
│   ├── app.js               # Express app y montaje de rutas
│   └── index.js             # Entrada: conexión DB + listen
├── package.json
└── ESTRUCTURA.md
```

## Separación de responsabilidades

| Capa | Ubicación | Responsabilidad |
|------|-----------|-----------------|
| **Lógica de negocio** | `src/lib/calculations.js` | Cálculos puros (subtotal ítem, sumatoria, IVA, total). Sin I/O. |
| **Modelos / datos** | `src/models/` | Esquemas Mongoose, contador, virtuales (ej. `resumen`). |
| **Plantillas / diseño PDF** | `src/pdf/layout.js` | Márgenes, tamaños de fuente, colores. Cambiar aquí no toca la lógica. |
| **Generación PDF** | `src/pdf/generator.js` | Orquestación del documento: header, cliente, vehículo, tabla, totales. |
| **Casos de uso** | `src/services/cotizacion.service.js` | Crear cotización, listar, obtener, generar PDF. |
| **API** | `src/routes/cotizaciones.js` | HTTP: validación de entrada, llamadas al servicio, respuestas. |

## ¿Es adecuada la estructura?

Sí. Esta organización:

- **Escala bien**: puedes añadir `src/repositories/cotizacion.repository.js` si más adelante quieres abstraer el acceso a datos (varios orígenes o caché).
- **Mantiene el PDF desacoplado**: cambiar de PDFKit a otra librería solo afecta a `src/pdf/`; el servicio sigue llamando a `generarPDF(...)`.
- **Cálculos reutilizables**: `calculations.js` se usa en el modelo (virtual `resumen`) y en el generador PDF; no hay duplicación de fórmulas.
- **Opcional**: carpeta `src/pdf/templates/` para plantillas HTML o Handlebars si en el futuro quieres PDF desde HTML; por ahora PDFKit puro es suficiente para un sistema ligero.

## Variables de entorno sugeridas

- `MONGODB_URI`: conexión a MongoDB (por defecto `mongodb://localhost:27017/cotizaciones`).
- `PORT`: puerto del servidor (por defecto 3000).
- `LOGO_PATH`: ruta absoluta o relativa al logo de la empresa para el PDF (opcional).

## Endpoints de la API

- `POST /api/cotizaciones` – Crear cotización (body con empresa, cliente, vehiculo, items, aplicaIVA, elaboradoPor, etc.).
- `GET /api/cotizaciones` – Listar (query: `limit`, `skip`).
- `GET /api/cotizaciones/:id` – Obtener por ID.
- `GET /api/cotizaciones/:id/preview` – Vista previa del PDF en el navegador (inline).
- `GET /api/cotizaciones/:id/descargar` – Descarga del PDF (attachment).
