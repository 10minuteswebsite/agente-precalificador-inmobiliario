# Integración con Agentic System / Agente Enrutador

**Estado:** contrato de coordinación
**Fuente de cambios del Enrutador:** [10minuteswebsite/agente-enrutador](https://github.com/10minuteswebsite/agente-enrutador)
**Última revisión del Enrutador:** commit `770605e` · 2026-08-07

Este documento es el mensaje operativo para el proyecto Calificador. El Enrutador es quien
recibe cada conversación de WhatsApp y conserva el aislamiento de organización, lead, campaña y
conversación. El Calificador debe comportarse como un súper poder invocable por el conversador; no
debe convertirse en una segunda inteligencia que responda por encima del agente principal.

## Jerarquía obligatoria

1. `conversational` es el controlador único del turno: entiende la intención, conserva el tono y
   decide si necesita precalificar, agendar u ofrecer otra capacidad.
2. `real_estate_prequalifier` es un módulo ejecutor por handoff. Devuelve estado estructurado y
   sugerencia de siguiente paso; no envía mensajes por su cuenta ni reemplaza la respuesta del
   conversador.
3. Un mismo agente puede tener `conversational + real_estate_prequalifier + scheduler`. La misión
   del Agent DNA define la prioridad y el orden; las capacidades no son tipos excluyentes de agente.
4. Si no se declara ninguna capacidad, el Enrutador normaliza `conversational`. Un DNA antiguo con
   `kind: real_estate_prequalifier` se interpreta como compatibilidad histórica y se normaliza a
   `conversational + real_estate_prequalifier`. Un agente genérico nunca recibe precalificación por
   inferencia.

## Entrada del módulo

El Enrutador invoca el módulo con un contrato equivalente a:

```json
{
  "schema_version": 1,
  "tenant_id": "org_scope",
  "agent_id": "agent_scope",
  "campaign_id": "campaign_scope",
  "conversation_id": "conversation_scope",
  "idempotency_key": "qualification:conversation:revision",
  "agent_dna": "configuration vigente",
  "conversation_summary": "resumen narrativo de esta campaña",
  "qualification_state": "estado anterior o vacío",
  "custom_field_values": "datos ya confirmados",
  "scheduler_available": false,
  "orchestration": {
    "controller": "conversational",
    "strategy": "handoff",
    "handoff_contract_version": "superpower.handoff.v1"
  },
  "lead": { "first_name": "solo nombre", "phone": "phone aislado" },
  "inbound": { "text": "último mensaje transcrito" }
}
```

El módulo debe usar únicamente el `agent_dna`, el resumen y el estado de esa conversación. No debe
leer leads, campañas ni conversaciones de otra organización.

## Salida del módulo

Debe devolver un resultado estructurado para que el conversador lo integre:

```json
{
  "text": "respuesta sugerida opcional para el controlador",
  "qualification_state": {
    "schema_version": 1,
    "active_profile_id": "profile_or_null",
    "answers": {},
    "missing_question_ids": [],
    "assessment": { "status": "collecting", "urgency": "low", "reasons": [], "limitations": [] },
    "next_action": "continue_qualification"
  },
  "custom_fields": [],
  "events": [],
  "scheduling": {
    "action": "none",
    "service_id": "",
    "range_start": "",
    "range_end": "",
    "timezone": "",
    "city": "",
    "booking_id": "",
    "modality": "phone",
    "confirmed": false,
    "answers": {}
  }
}
```

`scheduler_available` es opcional y por defecto `false`. Cuando es `true`, el generador puede
devolver una acción `scheduling` estrictamente estructurada para iniciar un handoff. El módulo no
llama al calendario ni crea, modifica o cancela citas: el Enrutador ejecuta la acción mediante su
adaptador de agenda, aplicando sus reglas de autorización, idempotencia y confirmación explícita.
El texto del módulo no debe enumerar disponibilidad ni solicitar el correo que administra el
Agendador. Si la capacidad no está habilitada, cualquier salida de agenda se rechaza.

Los estados y acciones válidos son los definidos en
`docs/contracts/qualification-state-and-events.md`. Los eventos deben incluir revisión e
idempotencia. La transición a `prequalified` puede derivar `lead.prequalified` y
`appointment.requested`, pero la creación de la cita pertenece al adaptador de agenda.
Las acciones válidas son `none`, `propose_slots`, `get_booking`, `confirm_booking`,
`reschedule_booking` y `cancel_booking`; todas llevan la forma completa del ejemplo para mantener
un contrato estricto y versionable.

## Modos de preguntas

- `automatic`: usa la base profesional autónoma.
- `semi_automatic`: usa la base autónoma con `max_questions` entre 1 y 50.
- `manual`: usa las preguntas del cliente y exige al menos una.

Las preguntas deben sentirse como conversación, una por turno, sin anunciar que se está llenando un
formulario. El módulo debe entender fechas, números, correo y lenguaje natural sin pedir formatos
técnicos. Los campos sensibles requieren consentimiento y nunca deben inventarse.

## Cambios ya realizados en el Enrutador

- La creación de agentes comienza con identidad vacía y solo Conversación general seleccionada.
- La interfaz distingue el controlador conversacional de los súper poderes.
- El backend normaliza capacidades antiguas y garantiza el controlador.
- El runner pasa al proveedor la orquestación: controlador `conversational`, estrategia `handoff` y
  lista de súper poderes habilitados.
- Los prompts derivados indican que el conversador decide cuándo invocar el módulo.
- Se corrigió la activación accidental por `kind` en agentes genéricos.
- Precalificación ofrece modos automático, semi-automático y manual con preguntas agregables y
  eliminables.
- El Agent DNA sigue siendo la fuente de verdad; los prompts son derivados y versionados.

## Evolución prevista del Enrutador

- Conectar este repositorio mediante un adaptador versionado, autenticado e idempotente; no copiar
  su código al dashboard.
- Integrar el súper poder de agendamiento cuando `agente-agendador` publique su manifiesto y
  endpoint autenticado.
- Añadir progresivamente cursos, asistente personal y otras capacidades como módulos aditivos.
- Mantener el wizard de creación como una modalidad del mismo formulario: la IA prellena el Agent
  DNA y el cliente confirma antes de guardar.
- Incorporar archivos, imágenes y fuentes procesadas como conocimiento privado del agente.
- Mantener leads, resúmenes, notas, exportaciones, búsqueda, estados y campañas en el Enrutador,
  nunca dentro del módulo de precalificación.
- Añadir posteriormente Messenger, Instagram y Telegram como canales de la misma inteligencia, sin
  crear memorias separadas.

## Criterio para habilitar la integración

No habilitar el módulo en producción hasta que este repositorio publique manifiesto, versión,
contrato de errores, pruebas de aislamiento por organización/conversación y pruebas de reintento
idempotente. El Enrutador seguirá conservando una copia compatible hasta completar esa migración.
