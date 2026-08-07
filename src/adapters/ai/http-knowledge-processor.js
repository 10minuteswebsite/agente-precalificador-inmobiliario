export function createHttpKnowledgeProcessor({ endpoint, token, fetchImpl = fetch } = {}) {
  if (!endpoint) return null;
  return {
    async process({ mime_type, file_name, bytes }) {
      const response = await fetchImpl(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ mime_type, file_name, content_base64: Buffer.from(bytes).toString("base64") }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(`knowledge_processor_failed:${body?.error?.code ?? response.status}`);
      if (typeof body?.text !== "string" || !body.text.trim()) throw new Error("knowledge_processor_empty_response");
      return body.text.trim();
    },
  };
}
