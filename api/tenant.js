import { createUserApiClient, requireUser } from "../src/application/create-user-api-client.js";
import { parseBody, sendJson } from "../src/application/http.js";

export default async function tenant(request, response) {
  if (!["GET", "POST"].includes(request.method)) return sendJson(response, 405, { error: "method_not_allowed" });
  try {
    const supabase = createUserApiClient(request);
    const user = await requireUser(supabase);
    if (request.method === "GET") {
      const { data, error } = await supabase.from("tenant_members").select("role, tenants(*)").eq("user_id", user.id);
      if (error) throw error;
      return sendJson(response, 200, { tenants: (data ?? []).map((item) => ({ ...item.tenants, role: item.role })) });
    }
    const body = parseBody(request);
    const name = String(body.name ?? "").trim();
    if (!name) return sendJson(response, 422, { error: "name_required" });
    const { data: created, error: tenantError } = await supabase.rpc("create_tenant", { tenant_name: name });
    if (tenantError) throw tenantError;
    return sendJson(response, 201, { tenant: created, role: "owner" });
  } catch (error) {
    const status = error.message === "authentication_required" ? 401 : error.message === "email_not_verified" ? 403 : error.message === "invalid_json" ? 400 : error.message === "persistence_not_configured" ? 503 : 500;
    return sendJson(response, status, { error: status === 500 ? "request_failed" : error.message });
  }
}
