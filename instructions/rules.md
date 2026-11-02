# Migración de almacenamiento local a Supabase — Cotizaciones Taller

## Rol

Actúa como un desarrollador senior especializado en Electron, Node.js, React, JavaScript, PostgreSQL y Supabase, con experiencia en migraciones de aplicaciones de escritorio hacia arquitecturas cloud.

Tu responsabilidad es trabajar sobre el proyecto existente, comprender su arquitectura y realizar una migración progresiva, segura y funcional.

## 1. Contexto del proyecto

Estamos trabajando sobre una aplicación de escritorio de cotizaciones para talleres, que ya se encuentra desarrollada y en funcionamiento.

**Tecnologías actuales:**

- Electron para la aplicación de escritorio.
- React y Vite para el frontend.
- Node.js para el proceso principal.
- SQLite mediante `better-sqlite3` para el almacenamiento local.
- Electron IPC y preload para la comunicación entre frontend y backend.
- PDFKit para generar documentos PDF.
- pnpm como gestor de paquetes.

**Nueva arquitectura:**

Queremos migrar el almacenamiento de SQLite a Supabase (PostgreSQL), centralizando los datos en la nube.

El objetivo es que la aplicación de escritorio actual y una futura aplicación web móvil puedan compartir la misma información.

Las tablas y políticas de seguridad RLS ya fueron creadas en Supabase.

## 2. Credenciales de Supabase

Utiliza las siguientes credenciales:

- SUPABASE_URL: `https://htnlwnuwilxeimgtammj.supabase.co`
- SUPABASE_ANON_KEY: `sb_publishable_VhuUitQn8a_F3GKZAOJ3DQ_rots0qmJ`

Consideraciones de seguridad:

- La clave publishable/anon puede utilizarse en el cliente si las políticas RLS están correctamente configuradas.
- Nunca incluyas una clave `service_role` en Electron, React ni en ningún código distribuido al usuario.
- No expongas credenciales en archivos públicos ni las escribas directamente en el código fuente.
- Utiliza variables de entorno y la configuración adecuada para el empaquetado de Electron.
- No des por hecho que las credenciales o las políticas RLS son suficientes: verifica qué operaciones permite cada rol.

## 3. Primera fase: auditoría obligatoria

Antes de modificar cualquier archivo, inspecciona el proyecto completo.

Debes identificar:

1. La estructura actual de carpetas y archivos.
2. Cómo se inicializa SQLite.
3. La estructura real de las tablas y sus columnas.
4. Los archivos responsables de guardar, consultar, actualizar y eliminar información.
5. Los servicios y repositorios existentes.
6. Los canales IPC y las funciones expuestas desde preload.
7. Los componentes React que consumen los datos.
8. Las relaciones entre clientes, cotizaciones y productos.
9. Cómo se generan los folios de cotizaciones.
10. Cómo se generan los PDF y de dónde obtienen su información.

No inventes nombres de tablas, columnas, funciones ni relaciones.

Consulta el esquema SQL real de Supabase y compáralo con el modelo de datos actual de SQLite.

**Al terminar esta fase, presenta un informe breve con:**

- Estructura actual.
- Tablas locales detectadas.
- Tablas remotas detectadas.
- Diferencias entre ambos esquemas.
- Archivos que necesitan modificaciones.
- Riesgos y posibles incompatibilidades.

No comiences la migración hasta comprender estas relaciones.

## 4. Segunda fase: arquitectura de Supabase

Implementa una arquitectura organizada y desacoplada.

Requisitos:

- Crear un cliente centralizado de Supabase.
- Separar la lógica de acceso a datos de los componentes React.
- Crear o adaptar repositorios para clientes, cotizaciones y productos.
- Mantener la comunicación mediante IPC cuando corresponda.
- Evitar duplicar consultas a Supabase en distintos componentes.
- Centralizar el tratamiento de errores.
- Utilizar operaciones asíncronas correctamente.

Respeta la arquitectura actual del proyecto. No reconstruyas la aplicación ni introduzcas una arquitectura completamente nueva sin necesidad.

## 5. Tercera fase: migración de funcionalidades

Migra progresivamente las operaciones de almacenamiento para las siguientes entidades:

### Clientes

- Registrar clientes.
- Consultar clientes.
- Buscar clientes.
- Actualizar información.
- Eliminar clientes, respetando las relaciones existentes.

### Cotizaciones

- Crear cotizaciones.
- Consultar cotizaciones.
- Consultar cotizaciones por folio.
- Actualizar cotizaciones.
- Eliminar cotizaciones cuando esté permitido.
- Consultar los detalles e ítems asociados.
- Mantener correctamente los totales, impuestos y subtotales.
- Mantener la generación y visualización de PDF.

### Productos

- Registrar productos.
- Consultar productos.
- Buscar productos.
- Actualizar productos.
- Eliminar productos cuando esté permitido.

No implementes funcionalidades adicionales que no existan actualmente.

## 6. Reglas críticas para los datos

### Folios de cotización

Actualmente se necesita conservar la numeración de cotizaciones, comenzando desde el folio 352.

Antes de implementar esta lógica:

1. Inspecciona cómo se generan actualmente los folios.
2. Comprueba cómo está definido el campo en PostgreSQL.
3. Verifica si utiliza una secuencia, identidad o lógica personalizada.
4. Configura correctamente el siguiente folio para evitar duplicados.
5. Garantiza que la generación sea segura ante dos usuarios creando cotizaciones simultáneamente.

El folio debe generarse en el servidor mediante un mecanismo atómico. No utilices simplemente el último folio leído desde React para calcular el siguiente.

### Ítems de cotización

Verifica cómo están representados actualmente los ítems.

Si se almacenan como JSON, comprueba su compatibilidad con el esquema remoto.

Si se almacenan en una tabla relacionada, respeta las relaciones y claves foráneas.

No pierdas:

- Descripción.
- Cantidad.
- Precio unitario.
- Subtotal.
- Tipo de producto o servicio, si existe.
- Cualquier otro campo detectado en el modelo actual.

### Integridad de datos

Cuando una cotización y sus ítems deban guardarse conjuntamente, utiliza una transacción en PostgreSQL mediante una función RPC o mecanismo equivalente.

Evita que una cotización quede guardada parcialmente si falla la inserción de sus detalles.

## 7. Cuarta fase: asincronía y manejo de errores

La aplicación no debe bloquearse mientras realiza solicitudes a Supabase.

Implementa:

- `async/await` correctamente.
- Estados de carga en las operaciones de interfaz.
- Manejo centralizado de errores.
- Mensajes comprensibles para el usuario.
- Tratamiento de errores de conexión.
- Tratamiento de sesiones expiradas.
- Prevención de solicitudes duplicadas.
- Validación de respuestas de Supabase.
- Manejo de operaciones que fallen por restricciones RLS.

No muestres mensajes de éxito cuando una operación haya fallado.

La aplicación debe seguir siendo utilizable cuando no exista conexión a Internet, aunque las operaciones cloud que requieran conexión deberán informar claramente que no se pudieron completar.

No implementes sincronización offline automática ni colas de sincronización en esta fase.

## 8. Quinta fase: migración de datos existentes

Antes de sustituir SQLite:

1. Comprueba si existen datos locales.
2. Identifica qué datos deben conservarse.
3. Diseña un procedimiento de exportación e importación.
4. Evita duplicar registros durante una importación.
5. Conserva los identificadores y relaciones cuando sea posible.
6. Comprueba que los registros importados coincidan con los originales.
7. Genera un respaldo de SQLite antes de cualquier operación destructiva.

No elimines SQLite ni sus tablas hasta que la migración haya sido verificada y aprobada.

La migración de datos debe ser un proceso independiente de la migración del código.

## 9. Sexta fase: pruebas y validación

Comprueba como mínimo:

- Conexión con Supabase.
- Registro y consulta de clientes.
- Creación y consulta de cotizaciones.
- Generación de folios consecutivos.
- Guardado y recuperación de ítems.
- Cálculos de subtotal, impuestos y total.
- Registro y consulta de productos.
- Generación de PDF.
- Tratamiento de errores de conexión.
- Comportamiento de las políticas RLS.
- Comunicación entre React, preload y Electron.
- Funcionamiento del programa empaquetado para Windows.

Verifica que los datos guardados desde la aplicación de escritorio puedan consultarse desde Supabase y que la arquitectura permita que una futura aplicación web consuma los mismos datos.

## 10. Restricciones importantes

- No reconstruyas la aplicación desde cero.
- No elimines funcionalidades existentes.
- No modifiques innecesariamente el diseño visual.
- No elimines SQLite sin verificar la migración de datos.
- No inventes estructuras de tablas.
- No dupliques lógica de negocio.
- No introduzcas dependencias innecesarias.
- No cambies el sistema de generación de PDF sin una razón técnica.
- No modifiques las políticas RLS sin identificar primero el problema y explicar el cambio necesario.
- No utilices claves privilegiadas en el cliente.
- No consideres terminada una operación solamente porque no produjo un error visible.

## 11. Forma de trabajo

Trabaja por etapas y no modifiques todo el proyecto de una sola vez.

Para cada etapa:

1. Explica qué archivos modificarás y por qué.
2. Implementa los cambios.
3. Comprueba que no se rompan las funcionalidades existentes.
4. Ejecuta las pruebas correspondientes.
5. Informa los archivos modificados y los resultados.
6. Identifica cualquier problema pendiente antes de continuar.

Si detectas una incompatibilidad entre SQLite y Supabase, detente y explica el problema antes de realizar cambios que puedan ocasionar pérdida de información.

## 12. Resultado esperado

Al finalizar, la aplicación de escritorio debe:

- Utilizar Supabase como fuente principal de datos.
- Permitir administrar clientes, cotizaciones y productos.
- Conservar los folios y la estructura de las cotizaciones.
- Mantener la generación de PDF.
- Manejar correctamente las operaciones asíncronas.
- Mantener una arquitectura preparada para una futura aplicación web móvil.
- No perder los datos existentes durante la migración.

**Prioridad absoluta: preservar el funcionamiento del software actual y garantizar la integridad de los datos.**
