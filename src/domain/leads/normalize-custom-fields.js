// Core capture types cover common contact, scheduling and qualification cases.
const TYPES = new Set(["text", "email", "phone", "number", "currency", "date", "datetime", "url", "boolean", "choice"]);
const SENSITIVITY = new Set(["standard", "sensitive"]);
const ASK_POLICIES = new Set(["relevant", "optional", "required"]);

function fail(code) { throw new Error(`invalid_custom_field:${code}`); }
function text(value, code, max = 80) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) fail(code);
  return value.trim();
}

/** Normalizes client-defined lead fields without extracting or inventing values. */
export function normalizeCustomFields(fields = []) {
  if (!Array.isArray(fields)) fail("must_be_array");
  if (fields.length > 12) fail("too_many");
  const ids = new Set();
  return fields.map((field) => {
    if (!field || typeof field !== "object" || Array.isArray(field)) fail("must_be_object");
    const id = text(field.id, "id_required", 48).toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_|_$/g, "");
    if (!id || ids.has(id)) fail("ids_must_be_unique");
    ids.add(id);
    const normalized = {
      id,
      label: text(field.label, "label_required"),
      type: text(field.type, "type_required"),
      // The agent infers the operational purpose from the label, mission and context.
      // Keep an existing purpose for backwards compatibility, but do not require clients to write it.
      purpose: typeof field.purpose === "string" ? field.purpose.trim().slice(0, 240) : "",
      sensitivity: field.sensitivity ?? "standard",
      ask_policy: field.ask_policy ?? "relevant",
    };
    if (!TYPES.has(normalized.type)) fail("type_invalid");
    if (!SENSITIVITY.has(normalized.sensitivity)) fail("sensitivity_invalid");
    if (!ASK_POLICIES.has(normalized.ask_policy)) fail("ask_policy_invalid");
    if (normalized.sensitivity === "sensitive" && field.consent_required !== true) fail("sensitive_consent_required");
    if (normalized.type === "choice") {
      if (!Array.isArray(field.options) || field.options.length < 2 || field.options.length > 20) fail("options_invalid");
      normalized.options = field.options.map((option) => text(option, "option_invalid", 100));
      if (new Set(normalized.options.map((option) => option.toLowerCase())).size !== normalized.options.length) fail("options_must_be_unique");
    }
    if (field.consent_required !== undefined && typeof field.consent_required !== "boolean") fail("consent_invalid");
    normalized.consent_required = normalized.sensitivity === "sensitive" || field.consent_required === true;
    return normalized;
  });
}
