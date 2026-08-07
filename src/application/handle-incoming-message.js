import { normalizeMetaMessage } from "../adapters/meta/normalize-meta-message.js";

export function handleIncomingMessage(payload, dependencies = {}) {
  const normalized = normalizeMetaMessage(payload, dependencies.clock?.() ?? new Date());
  dependencies.logger?.({ event: "message_normalized", event_id: normalized.event_id });
  const processing = dependencies.process?.(normalized);
  return { accepted: true, normalized, processing };
}
