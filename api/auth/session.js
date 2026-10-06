import { createUserApiClient, requireUser } from "../../src/application/create-user-api-client.js";
import { sendJson } from "../../src/application/http.js";

export default async function session(request, response) {
  if (request.method !== "GET") return sendJson(response, 405, { error: "method_not_allowed" });
  try {
    const user = await requireUser(createUserApiClient(request));
    return sendJson(response, 200, { authenticated: true, user: { id: user.id, email: user.email ?? null, metadata: user.user_metadata ?? {} } });
  } catch (error) {
    const status = error.message === "authentication_required" ? 401 : 500;
    return sendJson(response, status, { authenticated: false, error: status === 401 ? error.message : "session_check_failed" });
  }
}
