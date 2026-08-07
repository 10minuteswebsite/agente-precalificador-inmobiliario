import { createUserApiClient, requireUser } from "../src/application/create-user-api-client.js";
import { createAdminClient, requireSuperAdmin } from "../src/application/create-admin-client.js";
import { sendJson } from "../src/application/http.js";

export default async function adminOverview(request, response) {
  if (request.method !== "GET") return sendJson(response, 405, { error: "method_not_allowed" });
  try {
    const userClient = createUserApiClient(request);
    await requireUser(userClient);
    await requireSuperAdmin(request, userClient);
    const admin = createAdminClient();
    if (!admin) throw new Error("persistence_not_configured");
    const [tenants, members, agents, campaigns, conversations, users] = await Promise.all([
      admin.from("tenants").select("id,name,created_at").order("created_at", { ascending: false }),
      admin.from("tenant_members").select("tenant_id,user_id,role"),
      admin.from("agents").select("id,tenant_id,status"),
      admin.from("campaigns").select("id,tenant_id,status"),
      admin.from("conversations").select("id,lead_id,campaign_id,status"),
      admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ]);
    for (const result of [tenants, members, agents, campaigns, conversations]) if (result.error) throw result.error;
    if (users.error) throw users.error;
    const emailByUser = new Map(users.data.users.map((user) => [user.id, user.email ?? null]));
    const campaignTenant = new Map(campaigns.data.map((campaign) => [campaign.id, campaign.tenant_id]));
    const clients = tenants.data.map((tenant) => {
      const tenantMembers = members.data.filter((member) => member.tenant_id === tenant.id);
      const owner = tenantMembers.find((member) => member.role === "owner") ?? tenantMembers[0];
      const tenantCampaigns = campaigns.data.filter((campaign) => campaign.tenant_id === tenant.id);
      const tenantConversations = conversations.data.filter((conversation) => campaignTenant.get(conversation.campaign_id) === tenant.id);
      const leadCount = new Set(tenantConversations.map((conversation) => conversation.lead_id).filter(Boolean)).size;
      return { id: tenant.id, name: tenant.name, created_at: tenant.created_at, owner_email: emailByUser.get(owner?.user_id) ?? null, member_count: tenantMembers.length, agent_count: agents.data.filter((agent) => agent.tenant_id === tenant.id).length, campaign_count: tenantCampaigns.length, conversation_count: tenantConversations.length, lead_count: leadCount };
    });
    return sendJson(response, 200, { role: "super_admin", metrics: { client_count: clients.length, agent_count: agents.data.length, campaign_count: campaigns.data.length, active_campaign_count: campaigns.data.filter((campaign) => campaign.status === "active").length, conversation_count: conversations.data.length }, clients });
  } catch (error) {
    const status = error.message === "authentication_required" ? 401 : ["email_not_verified", "admin_required", "super_admin_required"].includes(error.message) ? 403 : error.message === "persistence_not_configured" ? 503 : 500;
    return sendJson(response, status, { error: status === 500 ? "admin_overview_failed" : error.message });
  }
}
