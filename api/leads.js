import { createUserApiClient, requireUser } from "../src/application/create-user-api-client.js";
import { parseBody, sendJson } from "../src/application/http.js";
import { createOpenAiConversationSummarizer } from "../src/adapters/ai/openai-conversation-summarizer.js";
import { normalizeStoredCustomFieldValues } from "../src/domain/leads/normalize-stored-custom-field-values.js";

export default async function leads(request, response) {
  if (!["GET", "PATCH"].includes(request.method)) return sendJson(response, 405, { error: "method_not_allowed" });
  try {
    const supabase = createUserApiClient(request);
    await requireUser(supabase);
    if (request.method === "GET") {
      let query = supabase.from("conversations").select("*, leads(*), campaigns(*)").order("last_message_at", { ascending: false });
      if (request.query?.campaign_id) query = query.eq("campaign_id", request.query.campaign_id);
      const { data, error } = await query;
      if (error) throw error;
      return sendJson(response, 200, { leads: data ?? [] });
    }
    const body = parseBody(request);
    if (!body.conversation_id) return sendJson(response, 422, { error: "conversation_id_required" });
    if (body.refresh_summary === true) {
      const { data: current, error: currentError } = await supabase.from("conversations").select("id,summary").eq("id", body.conversation_id).single();
      if (currentError) throw currentError;
      const { data: messages, error: messagesError } = await supabase.from("messages").select("body,direction,occurred_at").eq("conversation_id", body.conversation_id).order("occurred_at", { ascending: true });
      if (messagesError) throw messagesError;
      const transcript = (messages ?? []).map((message) => `${message.direction === "inbound" ? "Lead" : "Agente"}: ${message.body ?? ""}`).join("\n").slice(-12000);
      const summarizer = process.env.SUMMARY_SERVICE_URL
        ? { update: async (payload) => { const summaryResponse = await fetch(process.env.SUMMARY_SERVICE_URL, { method: "POST", headers: { "content-type": "application/json", ...(process.env.SUMMARY_SERVICE_TOKEN ? { authorization: `Bearer ${process.env.SUMMARY_SERVICE_TOKEN}` } : {}) }, body: JSON.stringify(payload) }); if (!summaryResponse.ok) throw new Error(`summary_service_failed:${summaryResponse.status}`); const summaryResult = await summaryResponse.json(); return typeof summaryResult === "string" ? summaryResult : summaryResult.summary; } }
        : process.env.OPENAI_API_KEY ? createOpenAiConversationSummarizer({ apiKey: process.env.OPENAI_API_KEY, model: process.env.OPENAI_MODEL || "gpt-5.6" }) : null;
      if (!summarizer) return sendJson(response, 503, { error: "summary_service_not_configured" });
      const summary = await summarizer.update({ current_summary: current.summary ?? "", note: `Reconstruye un resumen narrativo breve de 3 a 5 frases a partir de esta conversación. Conserva hechos e intención, mantén explícitas las preguntas médicas o sensibles, como consultas sobre cáncer, y no copies literalmente los mensajes:\n${transcript}`, conversation_id: current.id });
      if (typeof summary !== "string" || !summary.trim()) return sendJson(response, 502, { error: "summary_service_invalid_response" });
      const { data, error } = await supabase.from("conversations").update({ summary: summary.trim() }).eq("id", body.conversation_id).select().single();
      if (error) throw error;
      return sendJson(response, 200, { conversation: data });
    }
    if (typeof body.note === "string" && body.note.trim()) {
      const { data: current, error: currentError } = await supabase.from("conversations").select("id,summary").eq("id", body.conversation_id).single();
      if (currentError) throw currentError;
      const summarizer = process.env.SUMMARY_SERVICE_URL
        ? { update: async (payload) => { const summaryResponse = await fetch(process.env.SUMMARY_SERVICE_URL, { method: "POST", headers: { "content-type": "application/json", ...(process.env.SUMMARY_SERVICE_TOKEN ? { authorization: `Bearer ${process.env.SUMMARY_SERVICE_TOKEN}` } : {}) }, body: JSON.stringify(payload) }); if (!summaryResponse.ok) throw new Error(`summary_service_failed:${summaryResponse.status}`); const summaryResult = await summaryResponse.json(); return typeof summaryResult === "string" ? summaryResult : summaryResult.summary; } }
        : process.env.OPENAI_API_KEY ? createOpenAiConversationSummarizer({ apiKey: process.env.OPENAI_API_KEY, model: process.env.OPENAI_MODEL || "gpt-5.6" }) : null;
      if (!summarizer) return sendJson(response, 503, { error: "summary_service_not_configured" });
      const summary = await summarizer.update({ current_summary: current.summary ?? "", note: body.note.trim(), conversation_id: current.id });
      if (typeof summary !== "string" || !summary.trim()) return sendJson(response, 502, { error: "summary_service_invalid_response" });
      const { data, error } = await supabase.from("conversations").update({ summary: summary.trim() }).eq("id", body.conversation_id).select().single();
      if (error) throw error;
      return sendJson(response, 200, { conversation: data });
    }
    const update = {};
    if (typeof body.summary === "string") update.summary = body.summary;
    if (body.clear_custom_field_values === true) update.custom_field_values = {};
    else if (body.custom_field_values !== undefined) update.custom_field_values = normalizeStoredCustomFieldValues(body.custom_field_values);
    if (["active", "manual_review", "converted"].includes(body.status)) update.status = body.status;
    if (!Object.keys(update).length) return sendJson(response, 422, { error: "summary_or_valid_status_required" });
    const { data, error } = await supabase.from("conversations").update(update).eq("id", body.conversation_id).select().single();
    if (error) throw error;
    return sendJson(response, 200, { conversation: data });
  } catch (error) {
    const status = ["custom_field_values_invalid", "custom_field_value_invalid"].includes(error.message) ? 422 : error.message === "authentication_required" ? 401 : error.message === "email_not_verified" ? 403 : error.message === "invalid_json" ? 400 : 500;
    return sendJson(response, status, { error: status === 500 ? "request_failed" : error.message });
  }
}
