# Estado actual

**Fecha:** 2026-08-07  
**Rama de preparación:** `migration/opencode_prep`  
**Fuente de verdad:** GitHub, repositorio `10minuteswebsite/agente-precalificador-inmobiliario`

## Arquitectura

- `src/domain/agents`: Agent DNA, perfiles, tipos habilitados y validación.
- `src/domain/qualification`: normalización determinista del estado, límites, criterios y eventos.
- `src/domain/reporting`: informe diario con respuestas y análisis.
- `src/adapters/ai`: proveedores de generación detrás de contratos.
- `src/adapters/meta`: normalización de webhooks y envío de WhatsApp.
- `src/ports`: límites provider-neutral.
- `src/application` y `api`: composición y endpoints de la extracción inicial.

El módulo no es el controlador conversacional. El Enrutador invoca el contrato documentado y conserva
la memoria, el aislamiento, los leads, las campañas y el estado operativo.

## Estado verificado

- La extracción contiene contratos de Agent DNA, integración, estado/eventos e informe diario.
- Los modos automático, semi-automático y manual están documentados; manual sustituye preguntas autónomas.
- La configuración de tipos de operación y los límites de preguntas están en el Agent DNA.
- `npm test` pasó 200 pruebas en la rama base antes de esta preparación.
- No se modificó código funcional ni dependencias en esta rama.

## Integraciones e infraestructura

- WhatsApp Meta y correo son adaptadores reemplazables.
- Supabase es la persistencia operativa del sistema anfitrión; este repositorio no debe almacenar datos
  de leads ni secretos.
- El Enrutador tiene el despliegue activo y conserva una copia compatible durante la migración.
- La agenda pertenece a un proyecto externo y no está habilitada como responsabilidad de este módulo.

## Riesgos y pendientes

- La extracción aún contiene piezas compartidas de la aplicación para mantener las pruebas y la compatibilidad;
  la separación definitiva requiere un adaptador versionado, no una copia silenciosa.
- Falta publicar un manifiesto del módulo, contrato de errores y pruebas específicas de aislamiento/reintento
  para habilitar el consumo directo desde el Enrutador.

**Siguiente paso exacto:** diseñar y probar el adaptador versionado del Enrutador contra
`docs/contracts/router-integration-v1.md`.
