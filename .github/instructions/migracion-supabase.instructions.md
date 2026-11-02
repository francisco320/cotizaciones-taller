# Migración de Cotizaciones Taller a Supabase — Arquitectura Offline-First

## 1. Rol y objetivo

Actúa como un arquitecto de software senior especializado en Electron, React, Node.js, SQLite, PostgreSQL, Supabase y sistemas de sincronización offline-first.

Tu objetivo es migrar progresivamente el proyecto existente **Cotizaciones Taller** para incorporar Supabase como base de datos central en la nube, manteniendo SQLite como base de datos local y principal para las operaciones de la aplicación de escritorio.

La aplicación debe seguir funcionando completamente sin conexión a internet y sincronizar automáticamente los cambios con Supabase cuando vuelva a existir conectividad.

No estás desarrollando una aplicación nueva. Debes trabajar sobre el código, la arquitectura y las funcionalidades existentes.

## 2. Arquitectura objetivo

Implementa una arquitectura offline-first:

- **Frontend:** React + Vite.
- **Aplicación de escritorio:** Electron.
- **Backend local:** Node.js mediante Electron IPC.
- **Base de datos local:** SQLite con better-sqlite3.
- **Base de datos remota:** Supabase PostgreSQL.
- **Comunicación remota:** Supabase JavaScript Client.
- **Generación de documentos:** conservar PDFKit y el sistema actual de generación de PDF.

Flujo esperado:

1. El usuario realiza una operación en la aplicación.
2. La operación se guarda primero en SQLite.
3. Se registra el cambio en una cola local de sincronización.
4. La interfaz recibe la confirmación desde SQLite.
5. Cuando existe conexión, el sistema envía los cambios pendientes a Supabase.
6. Supabase devuelve la confirmación.
7. Se actualizan los metadatos locales de sincronización.
8. Los cambios remotos también deben poder descargarse y aplicarse a SQLite.

**Regla fundamental:** SQLite debe continuar siendo la fuente operativa inmediata de la aplicación de escritorio. Nunca se debe depender de internet para crear, editar, consultar o eliminar registros.

## 3. Contexto de la aplicación existente

Antes de modificar cualquier archivo, estudia el proyecto completo.

La aplicación utiliza actualmente:

- Electron.
- React.
- Vite.
- Node.js.
- SQLite mediante better-sqlite3.
- Electron IPC y preload.
- PDFKit.
- pnpm.

Existen módulos y archivos relacionados con:

- Clientes.
- Cotizaciones.
- Ítems de cotización.
- Inventario y productos.
- Respaldos.
- Generación de PDF.
- Repositorios y servicios de inventario.

El proyecto ya contiene una estructura local de base de datos. No debes reemplazarla sin analizar sus dependencias.

También existen archivos heredados de una arquitectura anterior, como `api/index.js`, `vercel.json` y documentación antigua. Comprueba si siguen siendo utilizados antes de modificarlos o eliminarlos.

Consulta obligatoriamente:

- `.github/copilot-instructions.md`
- `.github/instructions/migracion-supabase.instructions.md`
- `electron/database.js`
- `electron/main.js` o el archivo principal real de Electron.
- `electron/preload.js`
- Los repositorios y servicios existentes.
- Los hooks y componentes React.
- El generador de PDF.
- La configuración de Vite y pnpm.

Respeta las convenciones existentes y evita duplicar responsabilidades.

## 4. Modelo de datos actual

El modelo local incluye las siguientes entidades:

### Clientes

- id
- nombre
- telefono
- email
- rif
- direccion
- ciudad
- notas
- createdAt
- updatedAt

### Cotizaciones

- id
- numero
- fechaEmision
- fechaVencimiento
- empresa
- cliente
- vehiculo
- aplicaIVA
- porcentajeIVA
- elaboradoPor
- observaciones
- createdAt
- updatedAt
- tipoServicio
- modelo
- placa
- color
- marcaBomba
- modeloBomba
- serialBomba
- otroBomba

### Ítems

- id
- cotizacionId
- descripcion
- precioBase
- cantidad

### Productos

- id
- codigo
- nombre
- categoria
- descripcion
- stock
- stockMinimo
- precioCompra
- precioVenta
- proveedor
- ubicacion
- activo
- createdAt
- updatedAt

El esquema remoto de Supabase ya contiene tablas equivalentes:

- `clientes`
- `cotizaciones`
- `items`
- `productos`

Los identificadores remotos son UUID.

Relaciones actualmente verificadas:

- `items.cotizacionId` tiene una clave foránea hacia `cotizaciones.id`.
- No se ha confirmado una relación entre cotizaciones y clientes.
- No se ha confirmado una relación entre ítems y productos.

No asumas que los nombres de columnas, tipos, restricciones, políticas RLS o triggers están completos. Verifica el esquema real antes de implementar.

## 5. Decisiones de arquitectura obligatorias

### 5.1 Relación entre clientes y cotizaciones

Implementa una relación formal entre cotizaciones y clientes mediante `cliente_id`.

Sin embargo, conserva también el campo `cliente` como una copia histórica de los datos del cliente al momento de generar la cotización.

Esto es importante porque una modificación posterior de los datos del cliente no debe alterar cotizaciones anteriores.

La relación debe permitir:

- Consultar todas las cotizaciones de un cliente.
- Mantener la información histórica de cada cotización.
- Evitar depender exclusivamente del nombre del cliente para identificarlo.

### 5.2 Inventario

Prepara la posibilidad de relacionar un ítem con un producto mediante `producto_id`.

Esta relación debe ser opcional.

Por ahora:

- No descuentes inventario automáticamente.
- No implementes recetas de productos.
- No alteres el comportamiento actual del inventario.
- No obligues a que todos los ítems pertenezcan a un producto.

### 5.3 Identificadores locales y remotos

Analiza la estrategia de identificadores antes de migrar.

La base local utiliza identificadores propios y Supabase utiliza UUID.

Implementa una estrategia consistente que permita relacionar cada registro local con su correspondiente registro remoto.

Considera incorporar un campo `cloud_id` UUID en SQLite para conservar los identificadores locales existentes.

No conviertas ni reemplaces identificadores existentes de manera destructiva.

Los registros nuevos deben tener una identidad estable que permita sincronización y recuperación ante errores.

### 5.4 Sincronización y control de versiones

Diseña una estrategia de sincronización que contemple:

- `version` para detectar modificaciones concurrentes.
- `deletedAt` para representar eliminaciones lógicas.
- `createdAt` y `updatedAt`.
- Identificación de cambios pendientes.
- Registro de errores.
- Reintentos.
- Prevención de duplicados.
- Detección de conflictos.
- Recuperación después de cerrar inesperadamente la aplicación.

No implementes una estrategia ingenua de sobrescritura automática.

Cuando un registro haya sido modificado simultáneamente en local y remoto, identifica el conflicto y evita perder información.

Los conflictos deben poder registrarse para su posterior resolución.

## 6. Seguridad y Supabase

Utiliza el cliente oficial `@supabase/supabase-js`.

Configura las credenciales mediante variables de entorno y la configuración apropiada para Electron.

La URL y la clave publicable de Supabase pueden utilizarse en el cliente siempre que las políticas RLS estén correctamente configuradas.

Nunca incluyas:

- Service role key.
- Contraseñas administrativas.
- Credenciales privilegiadas.
- Secretos privados.

No consideres que ocultar una clave en el frontend sustituye la seguridad de RLS.

Antes de habilitar operaciones remotas:

1. Verifica las políticas RLS de cada tabla.
2. Comprueba que los usuarios solo puedan acceder a los datos autorizados.
3. Verifica las relaciones entre usuarios y talleres, si corresponde.
4. Comprueba que las operaciones de lectura, inserción, actualización y eliminación estén correctamente protegidas.

No desactives RLS para solucionar errores de permisos.

## 7. Decisión pendiente: talleres y usuarios

Antes de implementar la estructura definitiva de permisos, verifica si el producto funcionará para:

- Un solo taller con varios usuarios.
- Varios talleres con varios usuarios.
- Un solo taller con un solo usuario.

Esta decisión afecta el modelo de datos, la autenticación y las políticas RLS.

Si no existe una decisión documentada en el proyecto, detén esta parte y solicita confirmación.

No inventes una arquitectura multiempresa ni implementes una estructura de permisos provisional que después obligue a rehacer la base de datos.

Si se confirma que será un SaaS para varios talleres, diseña el aislamiento mediante entidades como `talleres` y `taller_miembros`, y agrega `taller_id` a las tablas correspondientes. Cada política RLS debe garantizar el aislamiento entre talleres.

## 8. Fases de implementación

### Fase 1: Auditoría y planificación

- Analiza el proyecto completo.
- Identifica las operaciones CRUD existentes.
- Identifica todas las dependencias de SQLite.
- Localiza la base de datos activa que utiliza Electron.
- No asumas que la base de datos ubicada en la raíz del proyecto es la que contiene los datos actuales.
- Analiza la base de datos de desarrollo y la de producción.
- Verifica las tablas y columnas reales de Supabase.
- Verifica restricciones, índices, claves foráneas, triggers, funciones y políticas RLS.
- Identifica inconsistencias entre SQLite y PostgreSQL.
- Documenta los riesgos de migración.

Entrega un informe con:

1. Arquitectura actual.
2. Arquitectura propuesta.
3. Archivos que deben modificarse.
4. Archivos nuevos necesarios.
5. Cambios requeridos en SQLite.
6. Cambios requeridos en Supabase.
7. Riesgos y medidas de protección.
8. Orden de implementación.

No modifiques código durante esta fase.

### Fase 2: Preparación de bases de datos

Prepara las migraciones SQL necesarias.

Incluye, cuando corresponda:

- Relaciones entre clientes y cotizaciones.
- Relación opcional entre ítems y productos.
- Campos de control de sincronización.
- Identificadores UUID.
- Control de versiones.
- Eliminación lógica.
- Índices.
- Restricciones de integridad.
- Políticas RLS.
- Triggers y funciones, solo cuando sean necesarios.

No ejecutes migraciones destructivas automáticamente.

Entrega los scripts SQL y explica el propósito de cada cambio.

Espera aprobación antes de ejecutar cualquier operación sobre los datos remotos.

### Fase 3: Preparación de SQLite

Adapta SQLite sin perder los datos existentes.

Implementa las migraciones locales necesarias para:

- Identificadores remotos.
- Relación entre clientes y cotizaciones.
- Relación opcional entre ítems y productos.
- Cola de sincronización.
- Metadatos de sincronización.
- Registro de conflictos.
- Control de versiones.

La cola de sincronización debe permitir registrar:

- Identificador de operación.
- Tabla afectada.
- Identificador local del registro.
- Tipo de operación: INSERT, UPDATE o DELETE.
- Fecha de creación.
- Número de intentos.
- Estado.
- Mensaje de error, cuando exista.

Las operaciones locales y el registro de la cola deben ejecutarse de manera transaccional.

No elimines registros históricos ni alteres la numeración actual de cotizaciones.

### Fase 4: Integración con Supabase

Implementa la conexión remota.

Responsabilidades:

- Configuración del cliente Supabase.
- Manejo de sesiones, si se confirma autenticación.
- Comprobación de conectividad.
- Comunicación segura.
- Manejo centralizado de errores.
- Validación de respuestas.
- Separación entre acceso local y remoto.

No coloques consultas de Supabase directamente en los componentes React.

Mantén una arquitectura organizada mediante servicios y repositorios.

SQLite debe seguir siendo utilizado por la aplicación de escritorio para las operaciones inmediatas.

### Fase 5: Motor de sincronización

Implementa un servicio independiente para sincronizar datos.

Debe contemplar:

1. Detectar operaciones pendientes.
2. Procesar las operaciones en orden.
3. Respetar las dependencias entre entidades.
4. Sincronizar primero clientes cuando una cotización dependa de ellos.
5. Sincronizar cotizaciones antes de sus ítems.
6. Gestionar correctamente las relaciones UUID.
7. Confirmar las operaciones exitosas.
8. Registrar errores sin perder los datos locales.
9. Reintentar operaciones fallidas.
10. Evitar duplicados si la aplicación se cierra durante una sincronización.

La sincronización debe ser idempotente: repetir una operación no debe generar registros duplicados.

Implementa sincronización bidireccional:

- Local → Supabase.
- Supabase → Local.

No descargues ni sobrescribas datos locales sin verificar versiones y conflictos.

### Fase 6: Integración con los módulos actuales

Adapta los módulos existentes sin cambiar innecesariamente la interfaz.

#### Clientes

- Crear.
- Consultar.
- Editar.
- Eliminar lógicamente.
- Consultar historial de cotizaciones.

#### Cotizaciones

- Crear.
- Consultar.
- Editar.
- Eliminar lógicamente.
- Mantener numeración única.
- Conservar los datos históricos del cliente.
- Mantener el comportamiento actual de cálculos e impuestos.

#### Ítems

- Mantener los ítems asociados a su cotización.
- Preservar cantidades y precios.
- Permitir relación opcional con productos.

#### Inventario

- Mantener todas las funcionalidades actuales.
- Sincronizar productos y existencias.
- No realizar descuentos automáticos de stock.

#### PDF

- Conservar la generación local de PDF.
- No depender de Supabase para generar documentos.
- Verificar que los datos sincronizados y los locales produzcan el mismo resultado.

#### Respaldos

- Mantener el sistema de respaldo local.
- Verificar que los respaldos sigan siendo compatibles después de las migraciones.
- No confundir la exportación de SQLite con la sincronización remota.

### Fase 7: Interfaz de sincronización

Incorpora una sección o indicador discreto que permita conocer:

- Estado de conexión.
- Estado de sincronización.
- Cantidad de operaciones pendientes.
- Última sincronización exitosa.
- Errores pendientes de resolver.

La aplicación debe distinguir entre:

- Sin conexión.
- Conectado.
- Sincronizando.
- Sincronizado.
- Error de sincronización.
- Conflicto pendiente.

La interfaz nunca debe bloquear las operaciones locales por falta de internet.

### Fase 8: Pruebas

Realiza pruebas de:

- Creación local de clientes.
- Creación local de cotizaciones.
- Edición de registros.
- Eliminaciones lógicas.
- Creación y edición de productos.
- Sincronización con internet.
- Funcionamiento sin internet.
- Recuperación de conexión.
- Cierre inesperado durante la sincronización.
- Reintentos.
- Prevención de duplicados.
- Relaciones entre clientes y cotizaciones.
- Relaciones entre cotizaciones e ítems.
- Conflictos entre modificaciones locales y remotas.
- Generación de PDF.
- Restauración de respaldos.

Verifica que ninguna funcionalidad actual se rompa.

### Fase 9: Documentación y despliegue

Documenta:

- Arquitectura final.
- Configuración de Supabase.
- Variables de entorno.
- Migraciones SQL.
- Migraciones de SQLite.
- Funcionamiento de la cola.
- Estrategia de sincronización.
- Resolución de conflictos.
- Procedimiento de respaldo y recuperación.
- Proceso de instalación y actualización.

## 9. Reglas estrictas de trabajo

1. No reescribas toda la aplicación.
2. No elimines SQLite.
3. No sustituyas operaciones locales por consultas remotas.
4. No cambies la interfaz sin necesidad.
5. No dupliques la lógica de negocio.
6. No modifiques el sistema de cálculos sin justificarlo.
7. No cambies la numeración de las cotizaciones.
8. No elimines datos existentes.
9. No ejecutes operaciones destructivas sin aprobación.
10. No desactives RLS.
11. No introduzcas credenciales privilegiadas en el cliente.
12. No avances a la siguiente fase si existen errores importantes sin resolver.
13. Mantén compatibilidad con la aplicación Electron empaquetada.
14. Conserva el funcionamiento del sistema de PDF.
15. Utiliza transacciones para operaciones locales relacionadas.
16. Mantén los cambios pequeños, verificables y documentados.

## 10. Forma de trabajo obligatoria

Trabaja de forma incremental.

Al comenzar:

- Lee las instrucciones de Copilot.
- Inspecciona el proyecto.
- Identifica el estado real de las bases de datos.
- Presenta el plan de trabajo.

Después, implementa una fase a la vez.

Al terminar cada fase, entrega:

1. Qué se implementó.
2. Archivos creados.
3. Archivos modificados.
4. Cambios realizados en SQLite.
5. Cambios realizados en Supabase.
6. Pruebas ejecutadas.
7. Resultados de las pruebas.
8. Problemas detectados.
9. Riesgos pendientes.
10. Próximo paso recomendado.

No marques una fase como completada si solamente has creado archivos sin probarlos.

## 11. Primer paso

Comienza exclusivamente con la **Fase 1: Auditoría y planificación**.

No escribas ni modifiques código todavía.

No ejecutes SQL en Supabase.

No instales dependencias.

No alteres ninguna base de datos.

Primero quiero conocer exactamente qué tenemos, qué debemos cambiar y cómo realizaremos la migración sin perder información ni interrumpir el funcionamiento actual de Cotizaciones Taller.

Cuando termines la auditoría, presenta el informe y espera mi aprobación para comenzar la implementación.
