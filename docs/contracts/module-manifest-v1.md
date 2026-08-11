# Contrato: manifiesto del módulo precalificador

**Versión del manifiesto:** 1  
**Versión del módulo:** 1.0.0  
**Estado:** Candidato a integración (requiere revisión y aprobación del Enrutador)

Fuente canónica: `module-manifest.json` en la raíz del repositorio. Este documento lo describe
para revisión humana; el JSON es la versión procesable por máquina.

## Rol

- `role`: `additive-superpower`.
- `controller`: `conversational` (el Enrutador sigue siendo el controlador único del turno).
- `strategy`: `additive` (el módulo nunca sustituye la respuesta del conversador).

## Entrada

`createRouterIntegrationV1({ generator })` devuelve `qualifyTurn(input)`. El `input` sigue
`docs/contracts/router-integration-v1.md`:

- `schema_version`: `1`.
- Scopes obligatorios: `tenant_id`, `agent_id`, `campaign_id`, `conversation_id`.
- `idempotency_key` debe referenciar la `conversation_id` de la misma conversación.
- `agent_dna` vigente (única fuente de configuración).
- `conversation_summary`, `qualification_state` anterior y `custom_field_values` conocidos.
- `lead` con solo `first_name` y `phone` (aislados).
- `inbound.text` del último mensaje.

El módulo es stateless: no lee ni escribe leads, campañas, conversaciones ni credenciales de
ninguna organización. Todo proviene del `input` que el Enrutador controla.

## Salida

- `text`: respuesta sugerida opcional para el controlador.
- `qualification_state`: estado estructurado de la conversación.
- `custom_fields`: array de `{ field_id, value, confidence, consent_given }`.
- `events`: eventos de negocio derivados, cada uno con versión, conversación, revisión, clave de
  idempotencia, scopes (`tenant_id`, `agent_id`, `campaign_id`) y `request_id` determinista.

## Garantías

- `stateless`: el módulo no persiste datos operativos.
- `idempotent`: entrada idéntica (mismos scopes, clave de idempotencia y estado previo) produce
  salida idéntica; los reintentos no duplican eventos.
- `additive`: el conversador decide cuándo invocarlo y conserva las integraciones externas.
- Aislamiento por organización y conversación: el módulo rechaza estados con `_scope` ajeno y
  vincula cada evento derivado a los scopes recibidos.

## Errores

Todos los errores públicos están documentados en `docs/contracts/error-contract.md` y usan
prefijos estables (`invalid_router_input`, `router_integration`, `invalid_prequalifier_response`,
`invalid_custom_field_value`, `invalid_agent_configuration`).

## Habilitación

Cumple el criterio de `docs/contracts/router-integration-v1.md`: manifiesto, versión, contrato de
errores, pruebas de aislamiento por organización/conversación y pruebas de reintento idempotente.
La integración en producción es decisión del Enrutador tras revisión manual de este PR.
