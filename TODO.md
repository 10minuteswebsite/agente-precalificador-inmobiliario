# Plan de trabajo

## Activo

- **TODO-045 — Alinear el módulo con superpower.handoff.v1** · 2026-08-19
  - Actualizar la estrategia pública de `additive` a `handoff` sin romper `schema_version: 1`. **Hecho**
  - Evitar que el módulo genere diálogo interno de disponibilidad o solicitud de correo. **Hecho**
  - Publicar el commit y actualizar el consumidor fijado del Enrutador. **Pendiente**

- **TODO-046 — Unificar la fuente de correo del lead** · 2026-08-19
  - Validar el correo persistido y el capturado en la conversación con el mismo resolver. **Hecho**
  - Evitar que Prompt Master vuelva a solicitar un correo válido ya guardado. **Hecho**
  - Mantener la solicitud cuando el correo guardado está malformado. **Hecho**

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

- **TODO-043 — Publicar paquete o endpoint versionado** cuando el contrato y las pruebas de integración estén aprobados. Preparación del paquete y workflows de prueba/publicación completados (`npm pack --dry-run`, etiqueta protegida contra versiones divergentes); el registro devuelve `404`, por lo que falta configurar el trusted publisher de npm y autorizar la primera etiqueta.
- **TODO-044 — Integrar el agendamiento** cuando el proyecto externo publique su endpoint autenticado.

No se incluyen aquí ideas descartadas ni tareas pertenecientes al dashboard del Enrutador.
