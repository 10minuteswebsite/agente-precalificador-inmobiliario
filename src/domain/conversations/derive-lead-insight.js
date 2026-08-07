const INTENT_RULES = [
  { pattern: /\b(reservar|reserva|agendar|agenda|cita|apart(ar|ado))\b/i, label: "Solicitar reserva o cita" },
  { pattern: /\b(precio|costo|cu[aá]nto|valor)\b/i, label: "Consultar precio" },
  { pattern: /\b(cu[aá]ndo|fecha|horario|hora)\b/i, label: "Consultar fecha u horario" },
  { pattern: /\b(d[oó]nde|lugar|ubicaci[oó]n|direcci[oó]n)\b/i, label: "Consultar ubicación" },
];

function cleanText(text) {
  return String(text ?? "").replace(/\s+/g, " ").trim().slice(0, 280);
}

function narrative(labels) {
  if (!labels.length) return "La intención del lead aún no está definida.";
  const has = (label) => labels.includes(label);
  if (has("Solicitar reserva o cita")) return "El lead llegó interesado en la oferta, ha avanzado en la conversación y ahora muestra intención de reservar; el siguiente paso es llevarlo a la cita o confirmación.";
  if (has("Consultar precio") && has("Consultar fecha u horario") && has("Consultar ubicación")) {
    return "El lead llegó interesado en la actividad y ha ido explorando sus detalles. Ahora quiere confirmar cuándo se realiza, dónde es y cuál es el precio antes de decidir.";
  }
  if (has("Consultar precio") && has("Consultar fecha u horario")) {
    return "El lead está evaluando la actividad y ha pedido confirmar la fecha y el precio antes de decidir si avanza.";
  }
  if (has("Consultar fecha u horario") && has("Consultar ubicación")) {
    return "El lead está evaluando la actividad y ha pedido confirmar cuándo se realiza y dónde tendrá lugar.";
  }
  if (has("Consultar precio")) return "El lead está comparando la oferta y necesita conocer el precio antes de decidir.";
  if (has("Consultar fecha u horario")) return "El lead está evaluando la oferta y necesita confirmar la fecha o el horario antes de decidir.";
  if (has("Consultar ubicación")) return "El lead está evaluando la oferta y necesita confirmar dónde se realiza antes de decidir.";
  return "El lead llegó interesado en la oferta y está tratando de entenderla mejor antes de decidir.";
}

/**
 * Creates a conservative insight when no live summarizer is configured.
 * It only restates observed inbound text and explicit keyword signals.
 */
export function deriveLeadInsight({ text, previousLabels = [], campaignContext = "" } = {}) {
  const message = cleanText(text);
  const currentLabels = INTENT_RULES.filter(({ pattern }) => pattern.test(message)).map(({ label }) => label);
  const labels = [...new Set([...previousLabels, ...currentLabels])];
  if (!labels.length && message) labels.push("Solicitar información");
  const intent = { labels, confidence: labels.length ? 0.7 : 0, source: "message_rules" };
  const summary = message
    ? `${campaignContext ? `El lead llegó por la campaña “${cleanText(campaignContext)}”. ` : ""}${narrative(labels)}`
    : "Sin texto disponible para resumir.";
  return { summary, intent };
}

export function mergeLeadSummary({ previousSummary = "", previousLabels = [], text, campaignContext = "" } = {}) {
  const message = cleanText(text);
  const hasKnownSignal = INTENT_RULES.some(({ pattern }) => pattern.test(message));
  if (previousSummary.trim() && !hasKnownSignal && previousLabels.length) {
    return `${previousSummary.trim()} También planteó una consulta adicional que requiere aclaración.`.slice(0, 900);
  }
  if (previousSummary.trim() && !hasKnownSignal && !previousLabels.length) return previousSummary.trim();
  return deriveLeadInsight({ text, previousLabels, campaignContext }).summary;
}
