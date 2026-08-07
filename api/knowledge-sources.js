import { createHash, randomUUID } from "node:crypto";
import { createUserApiClient, requireUser } from "../src/application/create-user-api-client.js";
import { parseBody, sendJson } from "../src/application/http.js";
import { KNOWLEDGE_FILE_LIMITS, buildKnowledgeStoragePath, validateKnowledgeFile } from "../src/domain/agents/validate-knowledge-file.js";
import { processKnowledgeContent } from "../src/domain/agents/process-knowledge-content.js";
import { createHttpKnowledgeProcessor } from "../src/adapters/ai/http-knowledge-processor.js";
import { createOpenAiKnowledgeProcessor } from "../src/adapters/ai/openai-knowledge-processor.js";

export function createKnowledgeSourcesHandler({ createClient = createUserApiClient, requireAuthenticated = requireUser, knowledgeProcessor = createOpenAiKnowledgeProcessor({ apiKey: process.env.OPENAI_API_KEY, model: process.env.OPENAI_KNOWLEDGE_MODEL || process.env.OPENAI_MODEL || "gpt-5.6" }) ?? createHttpKnowledgeProcessor({ endpoint: process.env.KNOWLEDGE_PROCESSOR_URL, token: process.env.KNOWLEDGE_PROCESSOR_TOKEN }) } = {}) {
  return async function knowledgeSources(request, response) {
    if (!['GET', 'POST', 'DELETE'].includes(request.method)) return sendJson(response, 405, { error: "method_not_allowed" });
    try {
      const supabase = createClient(request);
      await requireAuthenticated(supabase);
      if (request.method === "GET") {
        const url = new URL(request.url ?? "/api/knowledge-sources", "http://localhost");
        const agentId = url.searchParams.get("agent_id");
        if (!agentId) return sendJson(response, 422, { error: "agent_id_required" });
        const { data: agent, error: agentError } = await supabase.from("agents").select("id, tenant_id").eq("id", agentId).maybeSingle();
        if (agentError) throw agentError;
        if (!agent) return sendJson(response, 403, { error: "agent_access_denied" });
        const { data, error } = await supabase.from("agent_knowledge_sources").select("id, file_name, mime_type, byte_size, status, failure_reason, created_at, updated_at").eq("agent_id", agentId).order("created_at", { ascending: false });
        if (error) throw error;
        return sendJson(response, 200, { sources: data ?? [] });
      }
      const body = parseBody(request);
      if (request.method === "DELETE") {
        if (!body.source_id) return sendJson(response, 422, { error: "source_id_required" });
        const { data: source, error: sourceError } = await supabase.from("agent_knowledge_sources").select("id, storage_path").eq("id", body.source_id).maybeSingle();
        if (sourceError) throw sourceError;
        if (!source) return sendJson(response, 404, { error: "knowledge_source_not_found" });
        const { error: storageError } = await supabase.storage.from("agent-knowledge").remove([source.storage_path]);
        if (storageError) throw storageError;
        const { error: deleteError } = await supabase.from("agent_knowledge_sources").delete().eq("id", source.id);
        if (deleteError) throw deleteError;
        return sendJson(response, 200, { deleted: true, source_id: source.id });
      }
      if (body.source_id) {
        const { data: source, error: sourceError } = await supabase.from("agent_knowledge_sources").select("*").eq("id", body.source_id).maybeSingle();
        if (sourceError) throw sourceError;
        if (!source) return sendJson(response, 404, { error: "knowledge_source_not_found" });
        try {
          const { data: file, error: downloadError } = await supabase.storage.from("agent-knowledge").download(source.storage_path);
          if (downloadError) throw downloadError;
          const bytes = new Uint8Array(await file.arrayBuffer());
          const actualHash = createHash("sha256").update(bytes).digest("hex");
          if (bytes.byteLength !== source.byte_size || actualHash !== source.sha256) {
            await supabase.from("agent_knowledge_sources").update({ status: "failed", failure_reason: "knowledge_file_integrity_failed", updated_at: new Date().toISOString() }).eq("id", source.id);
            return sendJson(response, 422, { error: "knowledge_file_integrity_failed" });
          }
          let processedKnowledge;
          try {
            processedKnowledge = processKnowledgeContent({ mimeType: source.mime_type, bytes });
          } catch (processingError) {
            if (processingError?.message !== "knowledge_processor_unavailable" || !knowledgeProcessor) throw processingError;
            processedKnowledge = await knowledgeProcessor.process({ mime_type: source.mime_type, file_name: source.file_name, bytes });
          }
          const { data, error } = await supabase.from("agent_knowledge_sources").update({ status: "processed", processed_knowledge: processedKnowledge, failure_reason: null, updated_at: new Date().toISOString() }).eq("id", source.id).select().single();
          if (error) throw error;
          return sendJson(response, 200, { source: data });
        } catch (error) {
          const reason = String(error?.message ?? "knowledge_processing_failed");
          if (reason === "knowledge_processor_unavailable") return sendJson(response, 202, { source, status: "pending", processing: "adapter_required" });
          await supabase.from("agent_knowledge_sources").update({ status: "failed", failure_reason: reason.slice(0, 240), updated_at: new Date().toISOString() }).eq("id", source.id);
          return sendJson(response, 422, { error: "knowledge_processing_failed" });
        }
      }
      const file = validateKnowledgeFile({ organizationId: body.tenant_id, agentId: body.agent_id, name: body.file_name, mimeType: body.mime_type, bytes: body.byte_size });
      if (typeof body.sha256 !== "string" || !/^[a-f0-9]{64}$/i.test(body.sha256)) return sendJson(response, 422, { error: "file_hash_invalid" });
      const { data: agent, error: agentError } = await supabase.from("agents").select("id").eq("id", file.agentId).eq("tenant_id", file.tenantId).maybeSingle();
      if (agentError) throw agentError;
      if (!agent) return sendJson(response, 403, { error: "agent_access_denied" });
      const { count, error: countError } = await supabase.from("agent_knowledge_sources").select("id", { count: "exact", head: true }).eq("agent_id", file.agentId);
      if (countError) throw countError;
      if ((count ?? 0) >= KNOWLEDGE_FILE_LIMITS.maxSourcesPerAgent) return sendJson(response, 422, { error: "knowledge_source_limit_reached" });
      const hash = body.sha256.toLowerCase();
      const { data: existing, error: existingError } = await supabase.from("agent_knowledge_sources").select("id, file_name, mime_type, byte_size, status, failure_reason, created_at, updated_at, storage_path").eq("agent_id", file.agentId).eq("sha256", hash).maybeSingle();
      if (existingError) throw existingError;
      if (existing) return sendJson(response, 200, { source: existing, upload: { bucket: "agent-knowledge", path: existing.storage_path }, duplicate: true });
      const sourceId = randomUUID();
      const storagePath = buildKnowledgeStoragePath({ tenantId: file.tenantId, agentId: file.agentId, sourceId, extension: file.extension });
      const { data, error } = await supabase.from("agent_knowledge_sources").insert({ id: sourceId, tenant_id: file.tenantId, agent_id: file.agentId, file_name: file.fileName, mime_type: file.mimeType, byte_size: file.bytes, sha256: hash, storage_path: storagePath }).select().single();
      if (error) throw error;
      return sendJson(response, 201, { source: data, upload: { bucket: "agent-knowledge", path: storagePath } });
    } catch (error) {
      const message = String(error?.message ?? "request_failed");
      const status = message === "authentication_required" ? 401 : message === "email_not_verified" ? 403 : message === "invalid_json" ? 400 : message.endsWith("_required") || message.startsWith("file_") ? 422 : 500;
      return sendJson(response, status, { error: status === 500 ? "request_failed" : message });
    }
  };
}

export default createKnowledgeSourcesHandler();
