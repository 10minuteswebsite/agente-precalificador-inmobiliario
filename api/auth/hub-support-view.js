import { createAdminClient } from "../../src/application/create-admin-client.js";
import { sendJson } from "../../src/application/http.js";
import { parseCookies, readSupportSessionCookie, SUPPORT_SESSION_COOKIE } from "../../src/application/hub-session.js";

export default async function hubSupportView(request, response) {
  if (request.method !== "GET") return sendJson(response, 405, { error: "method_not_allowed" });
  const cookies = parseCookies(request.headers?.cookie ?? "");
  const session = readSupportSessionCookie(cookies[SUPPORT_SESSION_COOKIE], process.env.SUPER_FORMULARIOS_SUPPORT_SESSION_SECRET);
  if (!session) return sendJson(response, 401, { error: "support_session_invalid_or_expired" });
  try {
    const admin = createAdminClient();
    if (!admin) throw new Error("persistence_not_configured");
    const [tenant, agents, campaigns, members] = await Promise.all([
      admin.from("tenants").select("id,name,created_at").eq("id", session.tenant_id).single(),
      admin.from("agents").select("id,name,status,created_at").eq("tenant_id", session.tenant_id).order("created_at", { ascending: true }),
      admin.from("campaigns").select("id,name,purpose,prefilled_message,status,agent_id,created_at").eq("tenant_id", session.tenant_id).order("created_at", { ascending: true }),
      admin.from("tenant_members").select("user_id,role,created_at").eq("tenant_id", session.tenant_id),
    ]);
    for (const result of [tenant, agents, campaigns, members]) if (result.error) throw result.error;
    const campaignIds = (campaigns.data ?? []).map((campaign) => campaign.id);
    const conversations = campaignIds.length ? await admin.from("conversations").select("id,lead_id,campaign_id,status,summary,last_message_at,created_at,custom_field_values").in("campaign_id", campaignIds).order("last_message_at", { ascending: false }) : { data: [], error: null };
    if (conversations.error) throw conversations.error;
    const leadIds = [...new Set((conversations.data ?? []).map((conversation) => conversation.lead_id).filter(Boolean))];
    const leads = leadIds.length ? await admin.from("leads").select("id,phone,first_name,email,created_at").in("id", leadIds) : { data: [], error: null };
    if (leads.error) throw leads.error;
    return sendJson(response, 200, { read_only: true, grant_id: session.grant_id, expires_at: session.expires_at, tenant: tenant.data, agents: agents.data ?? [], campaigns: campaigns.data ?? [], conversations: conversations.data ?? [], leads: leads.data ?? [], members: members.data ?? [] });
  } catch (error) {
    return sendJson(response, error.message === "persistence_not_configured" ? 503 : 500, { error: error.message === "persistence_not_configured" ? error.message : "support_view_failed" });
  }
}
