import { createUserApiClient, requireUser } from "../src/application/create-user-api-client.js";
import { parseBody, sendJson } from "../src/application/http.js";
import { generateCampaignCode } from "../src/application/generate-campaign-code.js";
import { buildWhatsAppCampaignLink } from "../src/application/build-whatsapp-campaign-link.js";
import { normalizeCampaignMessage, suggestUniqueCampaignMessage } from "../src/application/suggest-unique-campaign-message.js";

export default async function campaigns(request, response) {
  if (!["GET", "POST", "PATCH"].includes(request.method)) return sendJson(response, 405, { error: "method_not_allowed" });
  try {
    const supabase = createUserApiClient(request);
    await requireUser(supabase);
    if (request.method === "GET") {
      const { data, error } = await supabase.from("campaigns").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return sendJson(response, 200, { campaigns: (data ?? []).map((campaign) => ({ ...campaign, whatsapp_url: buildWhatsAppCampaignLink({ phone: process.env.META_SHARED_WHATSAPP_NUMBER, message: campaign.prefilled_message }) })) });
    }
    const body = parseBody(request);
    if (request.method === "PATCH") {
      if (!body.id || !["active", "archived"].includes(body.status)) return sendJson(response, 422, { error: "campaign_status_update_required" });
      const { data, error } = await supabase.from("campaigns").update({ status: body.status }).eq("id", body.id).select().single();
      if (error) throw error;
      return sendJson(response, 200, { campaign: data });
    }
    if (!body.tenant_id || !body.agent_id || !body.name || !body.purpose || !body.prefilled_message) return sendJson(response, 422, { error: "campaign_fields_required" });
    const message = String(body.prefilled_message).trim().replace(/\s+/g, " ");
    const { data: existing, error: existingError } = await supabase.from("campaigns").select("prefilled_message").eq("tenant_id", body.tenant_id);
    if (existingError) throw existingError;
    if ((existing ?? []).some((campaign) => normalizeCampaignMessage(campaign.prefilled_message) === normalizeCampaignMessage(message))) {
      return sendJson(response, 409, { error: "campaign_message_already_used", suggestion: suggestUniqueCampaignMessage(message, (existing ?? []).map((campaign) => campaign.prefilled_message), Math.random, body.purpose || body.name) });
    }
    // `code` remains an internal compatibility key for legacy links; new links no longer expose it.
    const payload = { tenant_id: body.tenant_id, agent_id: body.agent_id, name: body.name, purpose: String(body.purpose).trim().replace(/\s+/g, " "), code: generateCampaignCode(), prefilled_message: message };
    let insertPayload = payload;
    let result = await supabase.from("campaigns").insert(insertPayload).select().single();
    // Keep deployments compatible while the purpose-column migration is rolling out.
    if (result.error?.code === "42703") {
      const { purpose, ...legacyPayload } = payload;
      insertPayload = legacyPayload;
      result = await supabase.from("campaigns").insert(insertPayload).select().single();
    }
    for (let attempt = 1; result.error?.code === "23505" && attempt < 4; attempt += 1) {
      insertPayload = { ...insertPayload, code: generateCampaignCode() };
      result = await supabase.from("campaigns").insert(insertPayload).select().single();
    }
    if (result.error) throw result.error;
    return sendJson(response, 201, { campaign: { ...result.data, whatsapp_url: buildWhatsAppCampaignLink({ phone: process.env.META_SHARED_WHATSAPP_NUMBER, message: result.data.prefilled_message }) } });
  } catch (error) {
    const databaseCode = String(error?.code ?? "");
    const safeError = databaseCode === "23505"
      ? "campaign_code_already_exists"
      : databaseCode === "23503"
        ? "agent_not_in_workspace"
        : databaseCode === "42501"
          ? "campaign_access_denied"
          : error.message;
    const status = safeError === "authentication_required" ? 401 : safeError === "email_not_verified" ? 403 : safeError === "invalid_json" ? 400 : safeError === "persistence_not_configured" ? 503 : safeError === "campaign_code_already_exists" ? 409 : safeError === "agent_not_in_workspace" || safeError === "campaign_access_denied" ? 403 : 500;
    return sendJson(response, status, { error: status === 500 ? "campaign_creation_failed" : safeError });
  }
}
