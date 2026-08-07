import { createAdminClient } from "../src/application/create-admin-client.js";
import { hashSupportSessionToken } from "../src/application/create-support-session-token.js";
import { sendJson } from "../src/application/http.js";

export default async function adminSupportView(request, response) {
  if (request.method !== "GET") return sendJson(response, 405, { error: "method_not_allowed" });
  try {
    const token = request.query?.token ?? new URL(request.url ?? "", "http://localhost").searchParams.get("token");
    const tokenHash = hashSupportSessionToken(token);
    if (!tokenHash) return sendJson(response, 401, { error: "support_token_invalid" });
    const admin = createAdminClient();
    if (!admin) throw new Error("persistence_not_configured");
    const { data: session, error: sessionError } = await admin.from("support_sessions").select("id,admin_user_id,tenant_id,reason,created_at,expires_at,revoked_at").eq("token_hash", tokenHash).maybeSingle();
    if (sessionError) throw sessionError;
    if (!session || session.revoked_at) return sendJson(response, 401, { error: "support_session_revoked" });
    if (new Date(session.expires_at).getTime() <= Date.now()) return sendJson(response, 410, { error: "support_session_expired" });
    const [tenant, agents, campaigns, members] = await Promise.all([
      admin.from("tenants").select("id,name,created_at").eq("id", session.tenant_id).single(),
      admin.from("agents").select("id,name,status,created_at").eq("tenant_id", session.tenant_id).order("created_at", { ascending: true }),
      admin.from("campaigns").select("id,name,purpose,prefilled_message,status,agent_id,created_at").eq("tenant_id", session.tenant_id).order("created_at", { ascending: true }),
      admin.from("tenant_members").select("user_id,role,created_at").eq("tenant_id", session.tenant_id),
    ]);
    for (const result of [tenant, agents, campaigns, members]) if (result.error) throw result.error;
    const campaignIds = (campaigns.data ?? []).map((item) => item.id);
    const campaignConversations = campaignIds.length ? await admin.from("conversations").select("id,lead_id,campaign_id,status,summary,last_message_at,created_at,custom_field_values").in("campaign_id", campaignIds).order("last_message_at", { ascending: false }) : { data: [], error: null };
    if (campaignConversations.error) throw campaignConversations.error;
    const leadIds = [...new Set((campaignConversations.data ?? []).map((item) => item.lead_id).filter(Boolean))];
    const leadsResult = leadIds.length ? await admin.from("leads").select("id,phone,first_name,email,created_at").in("id", leadIds) : { data: [], error: null };
    if (leadsResult.error) throw leadsResult.error;
    const { error: auditError } = await admin.from("support_session_events").insert({ support_session_id: session.id, admin_user_id: session.admin_user_id, action: "viewed", metadata: { read_only: true } });
    if (auditError) throw auditError;
    return sendJson(response, 200, { read_only: true, session: { id: session.id, tenant_id: session.tenant_id, reason: session.reason, created_at: session.created_at, expires_at: session.expires_at }, tenant: tenant.data, agents: agents.data ?? [], campaigns: campaigns.data ?? [], conversations: campaignConversations.data ?? [], leads: leadsResult.data ?? [], members: members.data ?? [] });
  } catch (error) {
    const message = String(error?.message ?? "support_view_failed");
    const status = message === "persistence_not_configured" ? 503 : 500;
    return sendJson(response, status, { error: status === 500 ? "support_view_failed" : message });
  }
}
