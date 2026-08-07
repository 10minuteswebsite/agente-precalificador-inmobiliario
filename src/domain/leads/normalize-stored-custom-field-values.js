const MAX_FIELDS = 24;
const MAX_TEXT_LENGTH = 500;

/** Keep dashboard edits within the same safe, compact shape used by the runtime. */
export function normalizeStoredCustomFieldValues(values) {
  if (!values || typeof values !== "object" || Array.isArray(values)) throw new Error("custom_field_values_invalid");
  const entries = Object.entries(values).slice(0, MAX_FIELDS);
  return Object.fromEntries(entries.map(([id, field]) => {
    if (!/^[a-z0-9_-]{1,64}$/i.test(id) || !field || typeof field !== "object") throw new Error("custom_field_values_invalid");
    const value = field.value;
    if (!["string", "number", "boolean"].includes(typeof value) || (typeof value === "string" && value.length > MAX_TEXT_LENGTH)) throw new Error("custom_field_value_invalid");
    return [id, {
      label: typeof field.label === "string" ? field.label.slice(0, 120) : id,
      value,
      ...(typeof field.confidence === "number" ? { confidence: Math.max(0, Math.min(1, field.confidence)) } : {}),
      consent_given: field.consent_given === true,
    }];
  }));
}
