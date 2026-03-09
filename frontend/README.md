# Frontend – Cotizaciones (React + Tailwind)

El diseño sigue la guía en `../design/README.md` (teal, slate, cards blancas).

## Cómo ejecutar

1. Instalar dependencias (en esta carpeta):

   ```bash
   pnpm install
   ```

2. Tener el backend corriendo en `http://localhost:3000`.

3. Arrancar el frontend:

   ```bash
   pnpm dev
   ```

   La app se abre en `http://localhost:5173`. Las peticiones a `/api/*` se redirigen al backend por el proxy de Vite.

## Rutas

- **/** – Listado de cotizaciones.
- **/nueva** – Formulario para crear una cotización (empresa, cliente, vehículo, ítems, IVA, elaborado por).
- **/cotizacion/:id** – Detalle de una cotización con vista previa del PDF y enlaces para ver/descargar.

## Build

```bash
pnpm build
pnpm preview   # previsualizar el build
```
