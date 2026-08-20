# Contrato: estado y eventos de precalificación

**Estado:** Implementado
**Versión:** 1

## Resultado

Cada conversación conserva un estado estructurado separado del texto y del resumen. El servicio de IA propone respuestas y evaluación; el Enrutador valida los campos contra el Agent DNA, preserva hechos anteriores y deriva los eventos de negocio.

## Estado

- `revision`: aumenta con cada actualización válida;
- `active_profile_id`: perfil configurado detectado;
- `answers`: respuestas conocidas por identificador y confianza;
- `missing_question_ids`: datos configurados todavía pendientes;
- `assessment.status`: `collecting`, `prequalified`, `not_ready` o `human_review`;
- `assessment.urgency`: `low`, `medium` o `high`;
- `assessment.reasons` y `limitations`: explicación breve para el realtor;
- `next_action`: acción compatible con el estado.
- `appointment_consent`: `pending`, `accepted`, `declined` o `ambiguous`. La precalificación por sí sola no autoriza una cita; el handoff de agenda requiere `accepted`.

La IA no puede añadir respuestas para preguntas inexistentes, eliminar hechos previos omitiéndolos ni marcar como precalificado un caso sin perfil. El dominio deriva las preguntas obligatorias faltantes, respeta sus condiciones y evalúa todos los criterios indispensables antes de aceptar una precalificación. Una precalificación conserva `appointment_consent=pending`; solo `appointment_consent=accepted` permite que el Enrutador entregue el control al Agendador.

Si el proveedor falla o propone un estado inválido, el mensaje ya persistido abre una revisión humana, conserva la conversación y envía al lead una espera amable. La caída de una notificación interna opcional no interrumpe este flujo.

## Eventos derivados

- `qualification.updated`: en cada revisión válida;
- `lead.prequalified`: únicamente al entrar por primera vez en estado precalificado;
- `appointment.requested`: junto con la transición anterior.

Cada evento contiene versión, conversación, revisión y clave de idempotencia. Los eventos no se confían directamente al proveedor de IA.

## Persistencia

La migración `0008_conversation_qualification_state.sql` añade el estado JSON versionado a la conversación. El aislamiento continúa heredando campaña, organización y RLS.
