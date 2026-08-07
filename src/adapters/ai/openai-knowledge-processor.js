function errorCode(body, status) {
  return body?.error?.code ?? body?.error?.type ?? status;
}

function outputText(body) {
  const text = (body?.output ?? [])
    .flatMap((item) => item?.content ?? [])
    .find((part) => part?.type === "output_text" && typeof part.text === "string")?.text;
  if (!text?.trim()) throw new Error("openai_knowledge_empty_response");
  return text.trim();
}

const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

/**
 * OpenAI adapter for extracting usable knowledge from private files.
 * The original bytes are sent only server-to-server and are never stored in the agent context.
 */
export function createOpenAiKnowledgeProcessor({
  apiKey,
  model = "gpt-5.6",
  endpoint = "https://api.openai.com/v1/responses",
  fetchImpl = fetch,
  timeoutMs = 60_000,
  maxOutputChars = 100_000,
} = {}) {
  if (!apiKey) return null;
  return {
    async process({ mime_type, file_name, bytes }) {
      const data = Buffer.from(bytes).toString("base64");
      const content = IMAGE_TYPES.has(mime_type)
        ? [
            { type: "input_text", text: "Describe and transcribe all useful business knowledge visible in this image. Return only clean plain text." },
            { type: "input_image", image_url: `data:${mime_type};base64,${data}`, detail: "high" },
          ]
        : [
            { type: "input_file", filename: file_name, file_data: `data:${mime_type};base64,${data}`, ...(mime_type === "application/pdf" ? { detail: "low" } : {}) },
            { type: "input_text", text: "Extrae todo el conocimiento útil para un agente de atención. Conserva nombres, fechas, precios, condiciones, preguntas y respuestas. Devuelve únicamente texto limpio y estructurado, sin comentarios sobre el proceso." },
          ];
      const response = await fetchImpl(endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, store: false, input: [{ role: "user", content }] }),
        signal: typeof AbortSignal?.timeout === "function" ? AbortSignal.timeout(timeoutMs) : undefined,
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(`openai_knowledge_failed:${errorCode(body, response.status)}`);
      return outputText(body).slice(0, maxOutputChars);
    },
  };
}
