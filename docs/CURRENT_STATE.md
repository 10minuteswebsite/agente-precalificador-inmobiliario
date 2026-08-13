# Estado actual

**Fecha:** 2026-08-11  
**Rama:** `opencode/issue4-20260811104836` (PR abierto para revisión manual)  
**Fuente de verdad:** GitHub, repositorio `10minuteswebsite/agente-precalificador-inmobiliario`

## Arquitectura

- `src/domain/agents`: Agent DNA, perfiles, tipos habilitados y validación.
- `src/domain/qualification`: normalización determinista del estado, límites, criterios y eventos.
- `src/domain/contracts`: validación de entrada del contrato Router y deriva de `request_id`/eventos
  con scopes (introducido en TODO-041).
- `src/application/router-integration-v1.js`: adaptador versionado `createRouterIntegrationV1`.
- `src/prequalifier/index.js`: fachada pública única del módulo para evitar imports internos.
- `package.json`: exportaciones públicas limitadas a la fachada raíz y el manifiesto.
- `src/domain/reporting`: informe diario con respuestas y análisis.
- `src/adapters/ai`: proveedores de generación detrás de contratos.
- `src/adapters/meta`: normalización de webhooks y envío de WhatsApp.
- `src/ports`: límites provider-neutral.
- `src/application` y `api`: composición y endpoints de la extracción inicial.

El módulo no es el controlador conversacional. El Enrutador invoca el contrato documentado y conserva
la memoria, el aislamiento, los leads, las campañas y el estado operativo.

## TODO-041 implementado

- **Manifiesto y versión:** `module-manifest.json` (schema `1`, versión `1.0.0`) y
  `docs/contracts/module-manifest-v1.md`; capacidad `real_estate_prequalifier`, rol súper poder
  aditivo, controlador `conversational`, estrategia `additive`.
- **Contrato de errores:** `docs/contracts/error-contract.md` con prefijos estables
  `invalid_router_input`, `router_integration` y los del dominio existente.
- **Adaptador versionado:** `createRouterIntegrationV1({ generator })` valida la entrada
  (`schema_version`, scopes, `idempotency_key` ligada a la conversación, `lead` mínimo,
  `inbound.text`), rechaza estados con `_scope` ajeno, exige que el Agent DNA declare la capacidad,
  invoca el generador y normaliza el estado/eventos del dominio.
- **Aislamiento e idempotencia:** el adaptador es stateless y determinista; cada evento derivado se
  vincula a `tenant_id`, `agent_id`, `campaign_id`, `conversation_id` y a un `request_id` derivado
  de la clave de idempotencia. Entrada idéntica produce salida idéntica: los reintentos no duplican
  eventos.
- **Pruebas de contrato:** `test/router-integration-v1.test.js` cubre forma de salida, validación,
  aislamiento por organización/conversación, idempotencia, reintentos, fallos del proveedor y
  respuestas inválidas, transición a precalificado y mapeo de campos personalizados.

## Estado verificado

- La extracción contiene contratos de Agent DNA, integración, estado/eventos e informe diario.
- Los modos automático, semi-automático y manual están documentados; manual sustituye preguntas autónomas.
- La configuración de tipos de operación y los límites de preguntas están en el Agent DNA.
- `npm test` pasa **216 pruebas** en la rama TODO-041 (200 preexistentes + 16 nuevas de contrato).
- No se modificó código funcional existente ni dependencias durante TODO-041.
- La migración a OpenCode-first sigue activa en `main`.

## Integraciones e infraestructura

- WhatsApp Meta y correo son adaptadores reemplazables.
- Supabase es la persistencia operativa del sistema anfitrión; este repositorio no debe almacenar datos
  de leads ni secretos.
- El Enrutador tiene el despliegue activo y conserva una copia compatible durante la migración.
- La agenda pertenece a un proyecto externo y no está habilitada como responsabilidad de este módulo.

## Riesgos y pendientes

- El adaptador no está aún conectado desde `agente-enrutador`; el criterio de habilitación exige la
  revisión manual de este PR y la decisión del Enrutador.
- No se probó la invocación real contra un despliegue (requiere acceso al entorno configurado;
  `verify:prequalifier` permanece pendiente de credenciales).
- La extracción aún contiene piezas compartidas de la aplicación para mantener las pruebas y la
  compatibilidad; la separación definitiva continúa después de integrar la fachada pública.

**Siguiente paso exacto:** revisar e integrar coordinadamente el PR #6 de este repositorio y el PR #7
de `agente-enrutador`, luego retirar imports internos restantes.
