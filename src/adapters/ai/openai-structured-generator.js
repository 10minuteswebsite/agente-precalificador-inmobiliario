function outputText(body) {
  for (const item of body?.output ?? []) {
    for (const part of item?.content ?? []) {
      if (part?.type === "refusal") throw new Error("openai_response_refused");
      if (part?.type === "output_text" && part.text) return part.text;
    }
  }
  throw new Error("openai_response_empty");
}

/** Provider adapter for strict JSON responses through the OpenAI Responses API. */
export function createOpenAiStructuredGenerator({
  apiKey,
  model = "gpt-5.6",
  fetchImpl = fetch,
  endpoint = "https://api.openai.com/v1/responses",
  timeoutMs = 30_000,
} = {}) {
  if (!apiKey) throw new Error("openai_not_configured");
  return async function generate({ name, schema, instructions, input }) {
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        store: false,
        instructions,
        input: typeof input === "string" ? input : JSON.stringify(input),
        text: { format: { type: "json_schema", name, strict: true, schema } },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`openai_response_failed:${body?.error?.code ?? response.status}`);
    try { return JSON.parse(outputText(body)); } catch (error) {
      if (String(error?.message).startsWith("openai_")) throw error;
      throw new Error("openai_response_invalid_json");
    }
  };
}

