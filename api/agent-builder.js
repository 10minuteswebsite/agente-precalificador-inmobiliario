import { createUserApiClient, requireUser } from "../src/application/create-user-api-client.js";
import { buildAgentDna } from "../src/application/build-real-estate-agent-dna.js";
import { parseBody, sendJson } from "../src/application/http.js";
import { createHttpAgentDnaBuilder } from "../src/adapters/ai/http-agent-dna-builder.js";
import { createOpenAiAgentDnaBuilder } from "../src/adapters/ai/openai-agent-dna-builder.js";

function defaultBuilderFactory(options) {
  if (options.apiKey) return createOpenAiAgentDnaBuilder(options);
  return createHttpAgentDnaBuilder(options);
}

export function createAgentBuilderHandler({
  createClient = createUserApiClient,
  requireAuthenticated = requireUser,
  createBuilder = defaultBuilderFactory,
  env = process.env,
} = {}) {
  return async function agentBuilder(request, response) {
    if (request.method !== "POST") return sendJson(response, 405, { error: "method_not_allowed" });
    try {
      const supabase = createClient(request);
      const user = await requireAuthenticated(supabase);
      const body = parseBody(request);
      if (!body.tenant_id) return sendJson(response, 422, { error: "tenant_id_required" });
      const { data: membership, error: membershipError } = await supabase.from("tenant_members").select("tenant_id").eq("tenant_id", body.tenant_id).eq("user_id", user.id).maybeSingle();
      if (membershipError) throw membershipError;
      if (!membership) return sendJson(response, 403, { error: "tenant_access_denied" });
      const generate = createBuilder({
        apiKey: env.OPENAI_API_KEY,
        model: env.OPENAI_MODEL || "gpt-5.6",
        endpoint: env.AGENT_BUILDER_URL,
        token: env.AGENT_BUILDER_TOKEN,
      });
      const result = await buildAgentDna({ message: body.message, history: body.history, currentDraft: body.current_draft, generate });
      return sendJson(response, 200, result);
    } catch (error) {
      const message = String(error?.message ?? "request_failed");
      const status = message === "authentication_required" ? 401
        : message === "email_not_verified" || message === "tenant_access_denied" ? 403
          : message === "invalid_json" ? 400
            : message === "agent_builder_not_configured" || message === "openai_not_configured" ? 503
              : message.startsWith("agent_builder_failed:") ? 502
                : message.startsWith("openai_response_") ? 502
                : message.startsWith("agent_builder_") || message.startsWith("invalid_agent_configuration:") ? 422 : 500;
      return sendJson(response, status, { error: status === 500 ? "request_failed" : message });
    }
  };
}

export default createAgentBuilderHandler();
