const EXPORT_COLUMNS = [
  "campaña",
  "código_campaña",
  "nombre",
  "whatsapp",
  "correo",
  "captado",
  "último_mensaje",
  "estado",
  "perfil",
  "urgencia",
  "intención",
  "resumen",
  "próxima_acción",
  "datos_capturados",
];

function text(value) {
  return typeof value === "string" ? value.replace(/[\r\n]+/g, " ").trim() : value == null ? "" : String(value);
}

function customFields(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([, field]) => field && typeof field === "object" && !Array.isArray(field)).map(([id, field]) => [id, {
    label: text(field.label || id).slice(0, 120),
    value: typeof field.value === "string" ? text(field.value).slice(0, 500) : field.value,
    ...(typeof field.confidence === "number" ? { confidence: Math.max(0, Math.min(1, field.confidence)) } : {}),
    consent_given: field.consent_given === true,
    ...(typeof field.origin === "string" ? { origin: text(field.origin).slice(0, 120) } : {}),
  }]));
}

export function toLeadExportRows(conversations = []) {
  return (Array.isArray(conversations) ? conversations : []).map((conversation) => {
    const state = conversation.qualification_state ?? {};
    const assessment = state.assessment ?? {};
    const lead = conversation.leads ?? {};
    const campaign = conversation.campaigns ?? {};
    const fields = customFields(conversation.custom_field_values);
    return {
      campaign: text(campaign.name),
      campaign_code: text(campaign.code),
      name: text(lead.first_name),
      whatsapp: text(lead.phone),
      email: text(lead.email),
      captured_at: text(conversation.created_at),
      last_message_at: text(conversation.last_message_at),
      status: text(conversation.status || assessment.status || "collecting"),
      profile: text(state.active_profile_id),
      urgency: text(assessment.urgency),
      intent: Array.isArray(state.intent?.labels) ? state.intent.labels.map(text).join("; ") : "",
      summary: text(conversation.summary),
      next_action: text(state.next_action),
      custom_fields: fields,
    };
  });
}

function quote(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export function createLeadCsv(rows = []) {
  const lines = [EXPORT_COLUMNS.map(quote).join(",")];
  for (const row of rows) {
    lines.push([
      row.campaign, row.campaign_code, row.name, row.whatsapp, row.email, row.captured_at,
      row.last_message_at, row.status, row.profile, row.urgency, row.intent, row.summary,
      row.next_action, JSON.stringify(row.custom_fields),
    ].map(quote).join(","));
  }
  return `\ufeff${lines.join("\n")}`;
}

export function createLeadExport({ conversations = [], format = "json" } = {}) {
  if (!["csv", "json"].includes(format)) throw new Error("lead_export_format_invalid");
  const rows = toLeadExportRows(conversations);
  if (format === "csv") return { contentType: "text/csv;charset=utf-8", body: createLeadCsv(rows), extension: "csv", rows };
  return { contentType: "application/json;charset=utf-8", body: JSON.stringify({ version: 1, lead_count: rows.length, leads: rows }, null, 2), extension: "json", rows };
}
