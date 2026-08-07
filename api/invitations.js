import { createUserApiClient, requireUser } from "../src/application/create-user-api-client.js";
import { createAdminClient, requireAdmin } from "../src/application/create-admin-client.js";
import { createInvitationToken } from "../src/application/create-invitation-token.js";
import { parseBody, sendJson } from "../src/application/http.js";

export default async function invitations(request, response) {
  if (!["GET", "POST"].includes(request.method)) return sendJson(response, 405, { error: "method_not_allowed" });
  try {
    const userClient = createUserApiClient(request);
    await requireUser(userClient);
    await requireAdmin(request, userClient);
    const admin = createAdminClient();
    if (!admin) throw new Error("persistence_not_configured");
    if (request.method === "GET") {
      const { data, error } = await admin.from("invitations").select("id,email,role,expires_at,accepted_at,created_at").order("created_at", { ascending: false });
      if (error) throw error;
      return sendJson(response, 200, { invitations: data ?? [] });
    }
    const body = parseBody(request);
    const email = String(body.email ?? "").trim().toLowerCase();
    const role = String(body.role ?? "member");
    if (!email || !email.includes("@")) return sendJson(response, 422, { error: "email_required" });
    if (!["owner", "admin", "member"].includes(role)) return sendJson(response, 422, { error: "invalid_role" });
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const invitation = createInvitationToken();
    const { data, error } = await admin.from("invitations").insert({ email, role, token_hash: invitation.token_hash, expires_at: expiresAt }).select("id,email,role,expires_at,created_at").single();
    if (error) throw error;
    return sendJson(response, 201, { invitation: data, token: invitation.token });
  } catch (error) {
    const status = error.message === "authentication_required" ? 401 : error.message === "email_not_verified" ? 403 : error.message === "admin_required" ? 403 : error.message === "invalid_json" ? 400 : error.message === "persistence_not_configured" ? 503 : 500;
    return sendJson(response, status, { error: status === 500 ? "request_failed" : error.message });
  }
}
