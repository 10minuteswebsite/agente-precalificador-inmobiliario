# Contrato: errores públicos del módulo

**Versión:** 1  
**Estado:** Implementado

El módulo expone únicamente estos prefijos de error. El Enrutador no debe depender de mensajes de
texto internos; puede clasificar la causa por el prefijo y, cuando existe, por el código final.

## Prefijos

### `invalid_router_input:<code>` — entrada que viola el contrato

Producidos por `validateRouterIntegrationInput` o por la comprobación de capacidad del adaptador:

| Código | Significado |
|---|---|
| `missing` | El payload no es un objeto. |
| `schema_version_unsupported` | `schema_version` no es `1`. |
| `tenant_id_required` / `agent_id_required` / `campaign_id_required` / `conversation_id_required` | Falta un scope obligatorio. |
| `idempotency_key_required` | Falta `idempotency_key`. |
| `idempotency_key_mismatch` | `idempotency_key` no referencia la `conversation_id` recibida. |
| `agent_dna_required` | Falta `agent_dna`. |
| `capability_not_declared` | El Agent DNA no declara la capacidad `real_estate_prequalifier`. |
| `lead_required` | Falta `lead`. |
| `lead_unsupported_fields` | `lead` contiene campos fuera de `first_name`/`phone`. |
| `inbound_required` / `inbound_text_required` | Falta `inbound` o `inbound.text`. |
| `qualification_state_invalid` | `qualification_state` no es un objeto. |
| `scope_mismatch` | `qualification_state._scope` pertenece a otra organización/conversación. |
| `custom_field_values_invalid` | `custom_field_values` no es un objeto. |
| `conversation_summary_invalid` | `conversation_summary` no es una cadena. |
| `conversation_action_invalid` | `conversation_action` no es `continue` ni `start`. |

### `router_integration:<causa>` — fallos del adaptador al invocar o normalizar al proveedor

| Código | Significado |
|---|---|
| `router_integration:generator_required` | Faltó inyectar el generador al crear el adaptador. |
| `router_integration:provider_unavailable:<detalle>` | El proveedor de IA falló; la causa se mantiene como texto informativo. |
| `router_integration:invalid_ai_response:<detalle>` | El proveedor devolvió una respuesta que el dominio rechazó (ver `invalid_prequalifier_response`). |

### Dominio existente (sin cambios)

- `invalid_prequalifier_response:<code>`: estado de precalificación inválido propuesto por el
  proveedor (definido en `src/domain/qualification/normalize-prequalifier-response.js`).
- `invalid_custom_field_value:<code>`: valores de campos personalizados inválidos.
- `invalid_agent_configuration:<code>`: configuración de Agent DNA inválida (respuesta `422` de la API).

## Semántica de reintento

- Entrada idéntica con la misma `idempotency_key` y el mismo `qualification_state` produce la misma
  salida (mismos eventos, misma revisión, mismo `request_id`).
- `router_integration:provider_unavailable` es reintentable con la misma clave.
- `invalid_router_input` no es reintentable: exige corregir la invocación.
- `router_integration:invalid_ai_response` indica un fallo del proveedor o una inconsistencia del
  estado propuesto; el Enrutador conserva la conversación y deriva la respuesta humana de espera.
