const TEXT_TYPES = new Set(["text/plain", "text/markdown", "text/csv"]);
const MAX_PROCESSED_CHARS = 100_000;

export function canProcessKnowledgeType(mimeType) {
  return TEXT_TYPES.has(mimeType);
}

/** Converts safe text sources into bounded context; binary extraction stays behind another adapter. */
export function processKnowledgeContent({ mimeType, bytes }) {
  if (!canProcessKnowledgeType(mimeType)) throw new Error("knowledge_processor_unavailable");
  if (!(bytes instanceof Uint8Array) && !Buffer.isBuffer(bytes)) throw new Error("knowledge_bytes_required");
  const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes).replace(/\u0000/g, "").trim();
  if (!text) throw new Error("knowledge_content_empty");
  return text.slice(0, MAX_PROCESSED_CHARS);
}

