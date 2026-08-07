import { createUserApiClient, requireUser } from "../src/application/create-user-api-client.js";
import { parseBody, sendJson } from "../src/application/http.js";
import { validateAgentConfiguration } from "../src/domain/agents/validate-agent-configuration.js";
import { normalizeKnowledgeSources } from "../src/domain/agents/normalize-knowledge-sources.js";
import { normalizeAgentCapabilities } from "../src/domain/agents/normalize-agent-capabilities.js";
import { normalizeCustomFields } from "../src/domain/leads/normalize-custom-fields.js";

function normalizeConfiguration(configuration) {
  const normalized = validateAgentConfiguration(configuration);
  normalized.knowledge_sources = normalizeKnowledgeSources(configuration.knowledge_sources);
  normalized.capabilities = normalizeAgentCapabilities(configuration.capabilities ?? []);
  if (configuration.custom_fields !== undefined) normalized.custom_fields = normalizeCustomFields(configuration.custom_fields);
  return normalized;
}

export default async function agents(request, response) {
  if (!["GET", "POST", "PATCH"].includes(request.method)) return sendJson(response, 405, { error: "method_not_allowed" });
  try {
    const supabase = createUserApiClient(request);
    await requireUser(supabase);
    if (request.method === "GET") {
      const { data, error } = await supabase.from("agents").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return sendJson(response, 200, { agents: data ?? [] });
    }
    const body = parseBody(request);
    if (request.method === "PATCH") {
      if (!body.id) return sendJson(response, 422, { error: "agent_id_required" });
      const updates = {};
      if (typeof body.name === "string" && body.name.trim()) updates.name = body.name.trim();
      if (body.configuration && typeof body.configuration === "object" && !Array.isArray(body.configuration)) updates.configuration = normalizeConfiguration(body.configuration);
      if (["active", "inactive"].includes(body.status)) updates.status = body.status;
      if (!Object.keys(updates).length) return sendJson(response, 422, { error: "agent_updates_required" });
      const { data, error } = await supabase.from("agents").update(updates).eq("id", body.id).select().single();
      if (error) throw error;
      return sendJson(response, 200, { agent: data });
    }
    if (!body.tenant_id || !body.name) return sendJson(response, 422, { error: "tenant_id_and_name_required" });
    const configuration = normalizeConfiguration(body.configuration ?? {});
    const { data, error } = await supabase.from("agents").insert({ tenant_id: body.tenant_id, name: body.name, configuration }).select().single();
    if (error) throw error;
    return sendJson(response, 201, { agent: data });
  } catch (error) {
    const message = String(error?.message ?? "request_failed");
    const status = message === "authentication_required" ? 401 : message === "email_not_verified" ? 403 : message === "invalid_json" ? 400 : message.startsWith("invalid_agent_configuration:") || message.startsWith("invalid_agent_capabilit") || message.startsWith("duplicate_agent_capability") || message.startsWith("invalid_custom_field:") ? 422 : message === "persistence_not_configured" ? 503 : 500;
    return sendJson(response, status, { error: status === 500 ? "request_failed" : message });
  }
}
