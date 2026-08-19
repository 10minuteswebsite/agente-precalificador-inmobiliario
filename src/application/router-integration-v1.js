import { validateRouterIntegrationInput } from "../domain/contracts/router-integration-input.js";
import { deriveRequestId, scopeEvents } from "../domain/contracts/router-integration-events.js";
import { normalizeAgentResponse } from "../domain/qualification/normalize-prequalifier-response.js";

export const ROUTER_INTEGRATION_V1 = Object.freeze({
  schemaVersion: 1,
  capability: "real_estate_prequalifier",
  controller: "conversational",
  strategy: "handoff",
  handoff_contract_version: "superpower.handoff.v1",
});

function declaresCapability(agentDna) {
  if (agentDna.kind === ROUTER_INTEGRATION_V1.capability) return true;
  return (agentDna.capabilities ?? []).some(
    (capability) => (typeof capability === "string" ? capability : capability?.id) === ROUTER_INTEGRATION_V1.capability,
  );
}

function toCustomFields(values) {
  return Object.entries(values ?? {}).map(([field_id, entry]) => ({
    field_id,
    value: entry.value,
    confidence: entry.confidence ?? 1,
    consent_given: entry.consent_given ?? false,
  }));
}

function scopesOf(contract) {
  return {
    tenant_id: contract.tenant_id,
    agent_id: contract.agent_id,
    campaign_id: contract.campaign_id,
    conversation_id: contract.conversation_id,
  };
}

/**
 * Versioned adapter between the conversational Router (controller) and this
 * prequalification module (additive superpower). The Router keeps memory,
 * leads, campaigns and external integrations; this adapter exposes the
 * prequalification result plus an optional scheduler action defined by
 * docs/contracts/router-integration-v1.md.
 *
 * It is stateless and deterministic: for identical input (same scopes,
 * idempotency key and previous qualification state) it returns identical
 * output, so retries never duplicate events. Every derived event is bound to
 * the conversation scopes the Router supplied.
 */
export function createRouterIntegrationV1({ generator } = {}) {
  if (typeof generator !== "function") throw new Error("router_integration:generator_required");
  return async function qualifyTurn(input) {
    const contract = validateRouterIntegrationInput(input);
    if (!declaresCapability(contract.agent_dna)) throw new Error("invalid_router_input:capability_not_declared");

    let output;
    try {
      output = await generator({
        agent_dna: contract.agent_dna,
        orchestration: {
          controller: ROUTER_INTEGRATION_V1.controller,
          strategy: ROUTER_INTEGRATION_V1.strategy,
          handoff_contract_version: ROUTER_INTEGRATION_V1.handoff_contract_version,
          superpowers: [ROUTER_INTEGRATION_V1.capability, ...(contract.scheduler_available ? ["scheduler"] : [])],
        },
        campaign_id: contract.campaign_id,
        conversation_id: contract.conversation_id,
        conversation_action: contract.conversation_action,
        conversation_summary: contract.conversation_summary,
        qualification_state: contract.qualification_state,
        custom_field_values: contract.custom_field_values,
        scheduler_available: contract.scheduler_available,
        lead: contract.lead,
        inbound: contract.inbound,
      });
    } catch (error) {
      throw new Error(`router_integration:provider_unavailable:${error?.message ?? "unknown"}`);
    }

    let result;
    try {
      result = normalizeAgentResponse({
        agentDna: contract.agent_dna,
        output,
        currentState: contract.qualification_state,
        conversationId: contract.conversation_id,
        schedulingEnabled: contract.scheduler_available,
      });
    } catch (error) {
      throw new Error(`router_integration:invalid_ai_response:${error?.message ?? "invalid"}`);
    }

    const requestId = deriveRequestId(contract.idempotency_key);
    return {
      text: result.text,
      qualification_state: result.qualification_state,
      custom_fields: toCustomFields(result.custom_field_values),
      ...(result.scheduling ? { scheduling: result.scheduling } : {}),
      events: scopeEvents(result.events ?? [], requestId, scopesOf(contract)),
    };
  };
}
