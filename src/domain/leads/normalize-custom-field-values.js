function fail(code) {
  throw new Error(`invalid_custom_field_value:${code}`);
}

function matchesType(value, type) {
  if (["text", "choice", "currency"].includes(type)) return typeof value === "string" || typeof value === "number";
  if (["email", "phone", "date", "datetime", "url"].includes(type)) return typeof value === "string" && value.trim().length > 0;
  if (type === "number") return typeof value === "number" && Number.isFinite(value);
  if (type === "boolean") return typeof value === "boolean";
  return false;
}

export function normalizeCustomFieldValues({ fields = [], values = [], previous = {} } = {}) {
  if (!Array.isArray(values)) fail("must_be_array");
  const configured = new Map((Array.isArray(fields) ? fields : []).map((field) => [field.id, field]));
  const result = { ...(previous && typeof previous === "object" ? previous : {}) };
  const seen = new Set();
  for (const entry of values) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) fail("entry_invalid");
    const field = configured.get(entry.field_id);
    if (!field) fail("field_unknown");
    if (seen.has(entry.field_id)) fail("duplicate_field");
    seen.add(entry.field_id);
    if (!matchesType(entry.value, field.type)) fail("value_type_invalid");
    if (field.type === "choice" && !field.options.includes(String(entry.value))) fail("choice_invalid");
    const confidence = entry.confidence ?? 1;
    if (typeof confidence !== "number" || confidence < 0 || confidence > 1) fail("confidence_invalid");
    // A provider may mention a sensitive field before the lead has explicitly
    // authorized storing it. That is not an invalid turn: discard the
    // unconsented value and let the conversational controller ask permission
    // naturally. Failing the whole response here makes an otherwise valid
    // first message impossible to deliver.
    if (field.consent_required && entry.consent_given !== true) continue;
    result[field.id] = { label: field.label, value: entry.value, confidence, consent_given: field.consent_required ? true : Boolean(entry.consent_given) };
  }
  return result;
}
