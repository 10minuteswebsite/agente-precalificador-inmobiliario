const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeLeadEmail(value) {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return EMAIL_PATTERN.test(email) ? email : null;
}

export function resolveKnownLeadEmail({ agentDna = {}, customFieldValues = {}, lead = {} } = {}) {
  const emailFields = (agentDna.custom_fields ?? []).filter((field) =>
    field?.type === "email" || /email|correo/i.test(`${field?.id ?? ""} ${field?.label ?? ""}`),
  );
  for (const field of emailFields) {
    const entry = customFieldValues?.[field.id];
    const value = entry && typeof entry === "object" && "value" in entry ? entry.value : entry;
    const email = normalizeLeadEmail(value);
    if (email) return email;
  }
  return normalizeLeadEmail(lead?.email);
}
