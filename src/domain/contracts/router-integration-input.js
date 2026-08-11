export const ROUTER_INTEGRATION_SCHEMA_VERSION = 1;
const LEAD_FIELDS = new Set(["first_name", "phone"]);

function fail(code) {
  throw new Error(`invalid_router_input:${code}`);
}

function requiredString(value, code) {
  if (typeof value !== "string" || !value.trim()) fail(code);
  return value.trim();
}

function requiredObject(value, code) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(code);
  return value;
}

/**
 * Validates and normalizes the versioned Router integration contract input.
 * The module is stateless and additive: it accepts only the scopes and data
 * belonging to the conversation that the Router controls, and refuses anything
 * that could leak data from another organization or conversation.
 */
export function validateRouterIntegrationInput(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) fail("missing");
  if (input.schema_version !== ROUTER_INTEGRATION_SCHEMA_VERSION) fail("schema_version_unsupported");

  const scopes = {
    tenant_id: requiredString(input.tenant_id, "tenant_id_required"),
    agent_id: requiredString(input.agent_id, "agent_id_required"),
    campaign_id: requiredString(input.campaign_id, "campaign_id_required"),
    conversation_id: requiredString(input.conversation_id, "conversation_id_required"),
  };

  const idempotencyKey = requiredString(input.idempotency_key, "idempotency_key_required");
  if (!idempotencyKey.includes(scopes.conversation_id)) fail("idempotency_key_mismatch");

  const agentDna = requiredObject(input.agent_dna, "agent_dna_required");

  const lead = requiredObject(input.lead, "lead_required");
  const unsupportedLeadFields = Object.keys(lead).filter((key) => !LEAD_FIELDS.has(key));
  if (unsupportedLeadFields.length) fail("lead_unsupported_fields");

  const inbound = requiredObject(input.inbound, "inbound_required");
  if (typeof inbound.text !== "string" || !inbound.text.trim()) fail("inbound_text_required");

  const qualificationState = input.qualification_state ?? {};
  if (!qualificationState || typeof qualificationState !== "object" || Array.isArray(qualificationState)) fail("qualification_state_invalid");
  if (qualificationState._scope) {
    if (
      qualificationState._scope.tenant_id !== scopes.tenant_id ||
      qualificationState._scope.conversation_id !== scopes.conversation_id
    ) {
      fail("scope_mismatch");
    }
  }

  const customFieldValues = input.custom_field_values ?? {};
  if (!customFieldValues || typeof customFieldValues !== "object" || Array.isArray(customFieldValues)) fail("custom_field_values_invalid");

  const conversationSummary = input.conversation_summary ?? "";
  if (typeof conversationSummary !== "string") fail("conversation_summary_invalid");
  const conversationAction = input.conversation_action ?? "continue";
  if (!["continue", "start"].includes(conversationAction)) fail("conversation_action_invalid");

  return {
    ...scopes,
    idempotency_key: idempotencyKey,
    agent_dna: agentDna,
    lead,
    inbound,
    qualification_state: qualificationState,
    custom_field_values: customFieldValues,
    conversation_summary: conversationSummary,
    conversation_action: conversationAction,
  };
}
