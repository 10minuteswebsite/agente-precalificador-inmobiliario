import { createAdminClient } from "../../src/application/create-admin-client.js";
import { sendJson } from "../../src/application/http.js";
import {
  createSupportSessionCookie,
  exchangeHubSupportGrant,
  HUB_PRODUCT_SLUG,
  readQuery,
  serializeSupportSessionCookie,
} from "../../src/application/hub-session.js";

export default async function hubSupport(request, response) {
  if (request.method !== "GET") return sendJson(response, 405, { error: "method_not_allowed" });
  const app = readQuery(request, "app");
  const code = readQuery(request, "code");
  if (app !== HUB_PRODUCT_SLUG || !code) return sendJson(response, 400, { error: "invalid_support_callback" });

  try {
    const grant = await exchangeHubSupportGrant({ code });
    const admin = createAdminClient();
    if (!admin) throw new Error("product_auth_not_configured");
    const users = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (users.error) throw users.error;
    const targetEmail = typeof grant.target.email === "string" ? grant.target.email.toLowerCase() : null;
    const localUser = (users.data?.users ?? []).find((user) => user.user_metadata?.hub_user_id === grant.target.platform_user_id || (targetEmail && user.email?.toLowerCase() === targetEmail));
    if (!localUser) throw new Error("support_target_not_provisioned");
    const memberships = await admin.from("tenant_members").select("tenant_id").eq("user_id", localUser.id);
    if (memberships.error) throw memberships.error;
    const tenantIds = [...new Set((memberships.data ?? []).map((membership) => membership.tenant_id).filter(Boolean))];
    if (tenantIds.length !== 1) throw new Error(tenantIds.length ? "support_target_scope_ambiguous" : "support_target_not_in_workspace");
    const value = createSupportSessionCookie({ targetUserId: localUser.id, tenantId: tenantIds[0], grantId: grant.grant_id, expiresAt: grant.expires_at }, process.env.SUPER_FORMULARIOS_SUPPORT_SESSION_SECRET);
    response.statusCode = 303;
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Referrer-Policy", "no-referrer");
    response.setHeader("Set-Cookie", serializeSupportSessionCookie(value));
    response.setHeader("Location", "/support.html");
    response.end();
  } catch (error) {
    const known = new Set(["invalid_support_grant", "support_grant_invalid_or_expired", "support_grant_invalid", "support_target_not_provisioned", "support_target_scope_ambiguous", "support_target_not_in_workspace"]);
    const status = known.has(error.message) ? 401 : error.message === "hub_auth_not_configured" || error.message === "product_auth_not_configured" || error.message === "support_session_not_configured" ? 503 : 500;
    return sendJson(response, status, { error: status === 500 ? "support_authentication_failed" : error.message });
  }
}
