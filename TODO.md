# Plan de trabajo

## Activo

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
- **TODO-044 — Integrar el agendamiento** cuando el proyecto externo publique su endpoint autenticado.

No se incluyen aquí ideas descartadas ni tareas pertenecientes al dashboard del Enrutador.
