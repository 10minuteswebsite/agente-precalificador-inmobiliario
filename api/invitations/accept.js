import { createHash } from "node:crypto";
import { createUserApiClient, requireUser } from "../../src/application/create-user-api-client.js";
import { createAdminClient } from "../../src/application/create-admin-client.js";
import { parseBody, sendJson } from "../../src/application/http.js";

export default async function acceptInvitation(request, response) {
  if (request.method !== "POST") return sendJson(response, 405, { error: "method_not_allowed" });
  try {
    const userClient = createUserApiClient(request);
    const user = await requireUser(userClient);
    const body = parseBody(request);
    const token = String(body.token ?? "");
    if (!token) return sendJson(response, 422, { error: "token_required" });
    const admin = createAdminClient();
    if (!admin) throw new Error("persistence_not_configured");
    const token_hash = createHash("sha256").update(token).digest("hex");
    const { data: invitation, error: lookupError } = await admin.from("invitations").select("*").eq("token_hash", token_hash).is("accepted_at", null).gt("expires_at", new Date().toISOString()).single();
    if (lookupError || !invitation || invitation.email !== String(user.email ?? "").toLowerCase()) return sendJson(response, 409, { error: "invitation_invalid" });
    const { data, error } = await admin.from("invitations").update({ accepted_at: new Date().toISOString() }).eq("id", invitation.id).select("id,email,role,accepted_at").single();
    if (error) throw error;
    return sendJson(response, 200, { invitation: data });
  } catch (error) {
    const status = error.message === "authentication_required" ? 401 : error.message === "email_not_verified" ? 403 : error.message === "invalid_json" ? 400 : error.message === "persistence_not_configured" ? 503 : 500;
    return sendJson(response, status, { error: status === 500 ? "request_failed" : error.message });
  }
}
