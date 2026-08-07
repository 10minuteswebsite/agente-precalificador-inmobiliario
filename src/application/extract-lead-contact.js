const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;

export function extractLeadContact(text = "") {
  const email = String(text).match(EMAIL_PATTERN)?.[0]?.toLowerCase() ?? null;
  return email ? { email } : {};
}
