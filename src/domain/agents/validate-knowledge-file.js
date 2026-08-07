import { createHash } from "node:crypto";

export const KNOWLEDGE_FILE_LIMITS = Object.freeze({
  maxBytes: 10 * 1024 * 1024,
  maxSourcesPerAgent: 20,
  allowedMimeTypes: Object.freeze({
    "application/pdf": "pdf", "text/plain": "txt", "text/markdown": "md", "text/csv": "csv",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp",
  }),
});

function requiredString(value, field) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field}_required`);
  return value.trim();
}

export function validateKnowledgeFile({ organizationId, agentId, name, mimeType, bytes }) {
  const tenantId = requiredString(organizationId, "organization_id");
  const targetAgentId = requiredString(agentId, "agent_id");
  const fileName = requiredString(name, "file_name").slice(0, 180);
  const normalizedMime = requiredString(mimeType, "mime_type").toLowerCase();
  const size = Number(bytes);
  if (!Number.isSafeInteger(size) || size <= 0) throw new Error("file_size_invalid");
  if (size > KNOWLEDGE_FILE_LIMITS.maxBytes) throw new Error("file_size_exceeded");
  const extension = KNOWLEDGE_FILE_LIMITS.allowedMimeTypes[normalizedMime];
  if (!extension) throw new Error("file_type_not_allowed");
  return { tenantId, agentId: targetAgentId, fileName, mimeType: normalizedMime, bytes: size, extension };
}

export function hashKnowledgeFile(content) {
  if (!Buffer.isBuffer(content) && !(content instanceof Uint8Array)) throw new Error("file_content_required");
  return createHash("sha256").update(content).digest("hex");
}

export function buildKnowledgeStoragePath({ tenantId, agentId, sourceId, extension }) {
  const safe = [tenantId, agentId, sourceId].map((value) => requiredString(value, "storage_path_part"));
  return `${safe.join("/")}.${requiredString(extension, "extension")}`;
}
