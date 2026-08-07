const DEFAULT_VERSION = "1.0";

function normalizeCapability(raw) {
  const value = typeof raw === "string" ? { id: raw } : raw;
  if (!value || typeof value !== "object" || Array.isArray(value) || typeof value.id !== "string" || !value.id.trim()) {
    throw new Error("invalid_agent_capability");
  }
  const version = typeof value.version === "string" && value.version.trim() ? value.version.trim() : DEFAULT_VERSION;
  const config = value.config && typeof value.config === "object" && !Array.isArray(value.config) ? value.config : {};
  return { id: value.id.trim(), version, config };
}

/** Normalizes additive agent capabilities without coupling them to a provider. */
export function normalizeAgentCapabilities(capabilities = []) {
  if (!Array.isArray(capabilities)) throw new Error("invalid_agent_capabilities");
  const normalized = capabilities.map(normalizeCapability);
  if (new Set(normalized.map((item) => item.id)).size !== normalized.length) throw new Error("duplicate_agent_capability");
  // La conversación es el agente controlador; los demás módulos son súper poderes aditivos.
  if (!normalized.some((item) => item.id === "conversational")) normalized.unshift({ id: "conversational", version: DEFAULT_VERSION, config: {} });
  return normalized;
}

export function capabilityIds(capabilities = []) {
  return normalizeAgentCapabilities(capabilities).map((item) => item.id);
}

/** Returns the provider-neutral control model used by every conversational runner. */
export function deriveAgentOrchestration(capabilities = []) {
  const ids = capabilityIds(capabilities);
  return {
    controller: "conversational",
    strategy: "additive",
    superpowers: ids.filter((id) => id !== "conversational"),
  };
}
