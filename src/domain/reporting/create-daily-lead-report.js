const URGENCY_ORDER = { high: 0, medium: 1, low: 2 };

function safe(value, fallback = "No disponible") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function safeLine(value, fallback) {
  return safe(value, fallback).replace(/[\r\n]+/g, " ").slice(0, 500);
}

function formatCapturedFields(values) {
  if (!values || typeof values !== "object" || Array.isArray(values)) return "Ningún campo personalizado registrado";
  const entries = Object.entries(values).filter(([, field]) => field && typeof field === "object" && !Array.isArray(field));
  if (!entries.length) return "Ningún campo personalizado registrado";
  return entries.map(([id, field]) => {
    const label = safeLine(field.label, id);
    const value = safeLine(typeof field.value === "string" ? field.value : String(field.value), "No disponible");
    const confidence = typeof field.confidence === "number" ? ` · Confianza: ${Math.round(Math.max(0, Math.min(1, field.confidence)) * 100)}%` : "";
    const consent = field.consent_given === true ? "sí" : "no requerido/no confirmado";
    const origin = safeLine(field.origin, "capturado en conversación");
    return `${label}: ${value} · Origen: ${origin} · Consentimiento: ${consent}${confidence}`;
  }).join("; ");
}

function formatAnswers(state) {
  const answers = state?.answers;
  if (!answers || typeof answers !== "object" || Array.isArray(answers) || !Object.keys(answers).length) return "Ninguna respuesta estructurada registrada";
  return Object.entries(answers).map(([id, answer]) => {
    const value = answer?.value === undefined ? "No disponible" : safeLine(typeof answer.value === "string" ? answer.value : String(answer.value), "No disponible");
    const confidence = typeof answer?.confidence === "number" ? ` · Confianza: ${Math.round(Math.max(0, Math.min(1, answer.confidence)) * 100)}%` : "";
    return `${id}: ${value}${confidence}`;
  }).join("; ");
}

function leadLine(conversation) {
  const state = conversation.qualification_state ?? {};
  const assessment = state.assessment ?? {};
  const name = safe(conversation.leads?.first_name, "Lead sin nombre");
  const phone = safe(conversation.leads?.phone);
  const profile = safe(state.active_profile_id, "Perfil pendiente");
  const status = safe(assessment.status, "collecting");
  const reasons = Array.isArray(assessment.reasons) && assessment.reasons.length ? assessment.reasons.join("; ") : "Sin razones registradas";
  const limitations = Array.isArray(assessment.limitations) && assessment.limitations.length ? assessment.limitations.join("; ") : "Ninguna registrada";
  return `${name} · ${phone}\nPerfil: ${profile} · Estado: ${status} · Urgencia: ${safe(assessment.urgency, "low")}\nRazones: ${reasons}\nLimitaciones: ${limitations}\nPróxima acción: ${safe(state.next_action, "continuar calificación")}\nRespuestas de precalificación: ${formatAnswers(state)}\nDatos capturados: ${formatCapturedFields(conversation.custom_field_values)}`;
}

export function createDailyLeadReport({ agent, conversations, periodStart, periodEnd } = {}) {
  const sorted = [...(conversations ?? [])].sort((a, b) => (URGENCY_ORDER[a.qualification_state?.assessment?.urgency] ?? 3) - (URGENCY_ORDER[b.qualification_state?.assessment?.urgency] ?? 3));
  const counts = sorted.reduce((result, conversation) => {
    const status = conversation.qualification_state?.assessment?.status ?? "collecting";
    result[status] = (result[status] ?? 0) + 1;
    return result;
  }, {});
  const summary = `Total: ${sorted.length} · Precalificados: ${counts.prequalified ?? 0} · En proceso: ${counts.collecting ?? 0} · Aún no listos: ${counts.not_ready ?? 0} · Revisión humana: ${counts.human_review ?? 0}`;
  return {
    to: agent.configuration.reporting.recipients,
    subject: `Informe diario de leads · ${agent.name}`,
    text: [`Informe del ${periodStart.toISOString()} al ${periodEnd.toISOString()}`, summary, ...sorted.map(leadLine)].join("\n\n"),
    metadata: { agent_id: agent.id, tenant_id: agent.tenant_id, lead_count: sorted.length, counts },
  };
}
