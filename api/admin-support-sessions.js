import { createUserApiClient } from "../src/application/create-user-api-client.js";
import { createAdminClient, requireSuperAdmin } from "../src/application/create-admin-client.js";
import { createSupportSessionToken } from "../src/application/create-support-session-token.js";
import { parseBody, sendJson } from "../src/application/http.js";

function ttlMinutes(env = process.env) {
  const configured = Number(env.SUPPORT_SESSION_TTL_MINUTES ?? 15);
  return Number.isFinite(configured) ? Math.min(60, Math.max(5, Math.round(configured))) : 15;
}

export default async function adminSupportSessions(request, response) {
  if (!["POST", "DELETE"].includes(request.method)) return sendJson(response, 405, { error: "method_not_allowed" });
  try {
    const userClient = createUserApiClient(request);
    const adminUser = await requireSuperAdmin(request, userClient);
    const admin = createAdminClient();
    if (!admin) throw new Error("persistence_not_configured");
    const body = parseBody(request);
    if (request.method === "POST") {
      const tenantId = String(body.tenant_id ?? "").trim();
      const reason = String(body.reason ?? "").trim();
      if (!tenantId || !reason) return sendJson(response, 422, { error: "tenant_id_and_reason_required" });
      if (reason.length > 500) return sendJson(response, 422, { error: "reason_too_long" });
      const { data: tenant, error: tenantError } = await admin.from("tenants").select("id,name").eq("id", tenantId).maybeSingle();
      if (tenantError) throw tenantError;
      if (!tenant) return sendJson(response, 404, { error: "tenant_not_found" });
      const { token, token_hash } = createSupportSessionToken();
      const expiresAt = new Date(Date.now() + ttlMinutes() * 60_000).toISOString();
      const { data: session, error: sessionError } = await admin.from("support_sessions").insert({ token_hash, admin_user_id: adminUser.id, tenant_id: tenantId, reason, expires_at: expiresAt }).select("id,tenant_id,reason,created_at,expires_at").single();
      if (sessionError) throw sessionError;
      const { error: auditError } = await admin.from("support_session_events").insert({ support_session_id: session.id, admin_user_id: adminUser.id, action: "created", metadata: { reason } });
      if (auditError) throw auditError;
      return sendJson(response, 201, { session: { ...session, read_only: true }, token });
    }
    const sessionId = String(body.id ?? "").trim();
    if (!sessionId) return sendJson(response, 422, { error: "session_id_required" });
    const { data: session, error: sessionError } = await admin.from("support_sessions").select("id,tenant_id,revoked_at").eq("id", sessionId).maybeSingle();
    if (sessionError) throw sessionError;
    if (!session) return sendJson(response, 404, { error: "support_session_not_found" });
    if (!session.revoked_at) {
      const { error } = await admin.from("support_sessions").update({ revoked_at: new Date().toISOString() }).eq("id", session.id);
      if (error) throw error;
      const { error: auditError } = await admin.from("support_session_events").insert({ support_session_id: session.id, admin_user_id: adminUser.id, action: "revoked", metadata: {} });
      if (auditError) throw auditError;
    }
    return sendJson(response, 200, { revoked: true });
  } catch (error) {
    const message = String(error?.message ?? "request_failed");
    const status = message === "authentication_required" ? 401 : ["email_not_verified", "admin_required", "super_admin_required"].includes(message) ? 403 : message === "invalid_json" ? 400 : message === "persistence_not_configured" ? 503 : 500;
    return sendJson(response, status, { error: status === 500 ? "support_session_failed" : message });
  }
}
