# Plan de trabajo

## Activo

- **TODO-041 — Adaptador versionado con el Enrutador**
  - Definir manifiesto, versión, entrada/salida y errores públicos.
  - Añadir autenticación, aislamiento por organización/conversación e idempotencia.
  - Probar reintentos y fallos del módulo sin duplicar eventos.

## Siguiente

- **TODO-042 — Separación del núcleo extraído**
  - Retirar gradualmente piezas copiadas que no pertenezcan al módulo.
  - Mantener compatibilidad con agentes existentes mediante el adaptador.

## Backlog

- **TODO-043 — Publicar paquete o endpoint versionado** cuando el contrato y las pruebas de integración estén aprobados.
- **TODO-044 — Integrar el agendamiento** cuando el proyecto externo publique su endpoint autenticado.

No se incluyen aquí ideas descartadas ni tareas pertenecientes al dashboard del Enrutador.
