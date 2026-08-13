# Plan de trabajo

## Activo

- **TODO-044 — Integración aditiva con el Agendador**
  - Exponer una acción de agenda opcional desde el contrato compartido sin reemplazar el
    controlador conversacional. **En implementación; pruebas sintéticas pasan.**
  - Entregar el resultado al Enrutador para que ejecute el adaptador firmado; no duplicar lógica de
    calendario aquí.

## Completado

- **TODO-041 — Adaptador versionado con el Enrutador**
  - Definir manifiesto, versión, entrada/salida y errores públicos. **Hecho**
  - Añadir autenticación por scopes, aislamiento por organización/conversación e idempotencia. **Hecho**
  - Probar reintentos y fallos del módulo sin duplicar eventos. **Hecho**
  - Revisión manual completada; el módulo quedó integrado en `main` como `bf9c99e`.

## Siguiente

- **TODO-042 — Separación del núcleo extraído**
  - Crear una fachada pública única del módulo. **Hecho**
  - Migrar gradualmente al consumidor del Enrutador para no importar piezas internas. **Hecho en `agente-enrutador` PR #7**
  - Mantener compatibilidad con agentes existentes mediante el adaptador `createRouterIntegrationV1`.

## Backlog

- **TODO-043 — Publicar paquete o endpoint versionado** cuando el contrato y las pruebas de integración estén aprobados. Preparación del paquete completada (`npm pack --dry-run`); falta autorización/credencial para publicar en el registro elegido.

No se incluyen aquí ideas descartadas ni tareas pertenecientes al dashboard del Enrutador.
