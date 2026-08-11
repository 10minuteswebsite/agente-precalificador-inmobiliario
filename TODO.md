# Plan de trabajo

## Activo

- **TODO-041 — Adaptador versionado con el Enrutador**
  - Definir manifiesto, versión, entrada/salida y errores públicos. **Hecho**
  - Añadir autenticación por scopes, aislamiento por organización/conversación e idempotencia. **Hecho**
  - Probar reintentos y fallos del módulo sin duplicar eventos. **Hecho**
  - Pendiente: revisión manual del PR antes de habilitar el consumo desde el Enrutador.

## Siguiente

- **TODO-042 — Separación del núcleo extraído**
  - Retirar gradualmente piezas copiadas que no pertenezcan al módulo.
  - Mantener compatibilidad con agentes existentes mediante el adaptador `createRouterIntegrationV1`.

## Backlog

- **TODO-043 — Publicar paquete o endpoint versionado** cuando el contrato y las pruebas de integración estén aprobados.
- **TODO-044 — Integrar el agendamiento** cuando el proyecto externo publique su endpoint autenticado.

No se incluyen aquí ideas descartadas ni tareas pertenecientes al dashboard del Enrutador.
