import { createHash } from "node:crypto";

export const EVENT_SCOPE_FIELDS = Object.freeze(["tenant_id", "agent_id", "campaign_id", "conversation_id"]);

/**
 * Deterministic identifier derived from the Router idempotency key. The same
 * key always produces the same request_id, which lets the Router de-duplicate
 * retries without the module persisting any operational state.
 */
export function deriveRequestId(idempotencyKey) {
  return createHash("sha256").update(`router_integration_v1:${idempotencyKey}`).digest("hex").slice(0, 24);
}

/**
 * Binds every derived event to the scopes of the conversation the Router
 * controls and to the deterministic request_id, preserving revision and
 * idempotency keys already computed by the qualification domain.
 */
export function scopeEvents(events = [], requestId, scopes) {
  return events.map((event) => ({
    ...event,
    request_id: requestId,
    tenant_id: scopes.tenant_id,
    agent_id: scopes.agent_id,
    campaign_id: scopes.campaign_id,
  }));
}
