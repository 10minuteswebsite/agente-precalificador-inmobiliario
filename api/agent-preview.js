import { createUserApiClient, requireUser } from "../src/application/create-user-api-client.js";
import { parseBody, sendJson } from "../src/application/http.js";
import { createOpenAiAgentPreviewGenerator } from "../src/adapters/ai/openai-agent-preview-generator.js";
import { createHttpTextGenerator } from "../src/adapters/ai/http-text-generator.js";

export function withProcessedKnowledge(configuration = {}, sources = []) {
  const processedKnowledge = sources.map((source) => `Fuente: ${source.file_name}\n${source.processed_knowledge}`).join("\n\n");
  return processedKnowledge ? { ...configuration, processed_knowledge: processedKnowledge } : configuration;
}

function generator() {
  if (process.env.OPENAI_API_KEY) return createOpenAiAgentPreviewGenerator({ apiKey: process.env.OPENAI_API_KEY });
  if (process.env.AGENT_RUNNER_URL) {
    const bridge = createHttpTextGenerator({ endpoint: process.env.AGENT_RUNNER_URL, token: process.env.AGENT_RUNNER_TOKEN });
    return { reply: async (input) => bridge({ ...input, mode: "preview" }), feedback: async (input) => bridge({ ...input, mode: "preview_feedback" }) };
  }
  throw new Error("preview_not_configured");
}

export default async function agentPreview(request, response) {
  if (!["POST", "PATCH"].includes(request.method)) return sendJson(response, 405, { error: "method_not_allowed" });
  try {
    const supabase = createUserApiClient(request);
    await requireUser(supabase);
    const body = parseBody(request);
    if (!body.agent_id || !body.tenant_id) return sendJson(response, 422, { error: "agent_id_and_tenant_id_required" });
    const { data: agent, error } = await supabase.from("agents").select("*").eq("id", body.agent_id).eq("tenant_id", body.tenant_id).single();
    if (error || !agent) return sendJson(response, 404, { error: "agent_not_found" });
    const { data: sources, error: sourcesError } = await supabase.from("agent_knowledge_sources").select("file_name, processed_knowledge").eq("agent_id", agent.id).eq("status", "processed").order("created_at", { ascending: true });
    if (sourcesError) throw sourcesError;
    const runtimeConfiguration = withProcessedKnowledge(agent.configuration ?? {}, sources ?? []);
    if (request.method === "PATCH") {
      if (body.action !== "apply_feedback" || !body.rules_addition?.trim()) return sendJson(response, 422, { error: "feedback_proposal_required" });
      const current = agent.configuration ?? {};
      const addition = body.rules_addition.trim().slice(0, 1000);
      const rules = [current.rules?.trim(), `Regla añadida desde una prueba: ${addition}`].filter(Boolean).join("\n");
      const { data: updated, error: updateError } = await supabase.from("agents").update({ configuration: { ...current, rules } }).eq("id", agent.id).select().single();
      if (updateError) throw updateError;
      return sendJson(response, 200, { agent: updated });
    }
    const engine = generator();
    const history = Array.isArray(body.history) ? body.history.slice(-12) : [];
    if (body.action === "feedback") {
      if (!String(body.feedback ?? "").trim()) return sendJson(response, 422, { error: "feedback_required" });
      const proposal = await engine.feedback({ agent_dna: runtimeConfiguration, agent_name: agent.name, history, feedback: String(body.feedback).trim().slice(0, 2000) });
      return sendJson(response, 200, { mode: "feedback", proposal });
    }
    const message = String(body.message ?? "").trim();
    if (!message) return sendJson(response, 422, { error: "message_required" });
    const result = await engine.reply({ mode: "preview", agent_dna: runtimeConfiguration, agent_name: agent.name, conversation_id: `preview:${agent.id}`, conversation_action: history.length ? "continue" : "start", conversation_summary: "", qualification_state: {}, lead: { first_name: "" }, inbound: { text: message }, history });
    return sendJson(response, 200, { mode: "reply", text: result.text });
  } catch (error) {
    const message = String(error?.message ?? "request_failed");
    const status = message === "authentication_required" ? 401 : message === "email_not_verified" ? 403 : message === "invalid_json" ? 400 : message === "preview_not_configured" ? 503 : 500;
    return sendJson(response, status, { error: status === 500 ? "preview_failed" : message });
  }
}
