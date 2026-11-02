# Instrucciones generales del proyecto

## Contexto

Este repositorio contiene una aplicación de escritorio para talleres, desarrollada con Electron, React, Vite, Node.js y SQLite. Actualmente se está trabajando en su evolución y migración progresiva hacia Supabase.

## Reglas obligatorias

- Trabajar siempre sobre el software existente.
- No reconstruir la aplicación desde cero.
- No eliminar funcionalidades existentes.
- Revisar la arquitectura antes de modificar archivos.
- Respetar la estructura actual del proyecto.
- Mantener separada la lógica de negocio de la interfaz.
- Utilizar correctamente Electron IPC y preload.
- Evitar duplicar código y lógica.
- No instalar dependencias innecesarias.
- No modificar archivos ajenos a la tarea.
- No eliminar datos ni tablas sin autorización.
- Ejecutar pruebas después de cada cambio importante.
- Informar qué archivos fueron modificados y por qué.
- Si existe alguna duda sobre la estructura o funcionamiento, investigar antes de implementar.

## Forma de trabajo

Antes de implementar cualquier funcionalidad:

1. Analizar el código existente.
2. Identificar los archivos involucrados.
3. Explicar el enfoque de implementación.
4. Realizar cambios pequeños y controlados.
5. Validar que las funcionalidades existentes continúen funcionando.
