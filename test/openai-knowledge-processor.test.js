import test from "node:test";
import assert from "node:assert/strict";
import { createOpenAiKnowledgeProcessor } from "../src/adapters/ai/openai-knowledge-processor.js";

test("OpenAI knowledge processor extracts a private PDF without exposing the key", async () => {
  const processor = createOpenAiKnowledgeProcessor({ apiKey: "secret-key", fetchImpl: async (_url, options) => {
    assert.equal(options.headers.Authorization, "Bearer secret-key");
    const body = JSON.parse(options.body);
    assert.equal(body.store, false);
    const file = body.input[0].content.find((part) => part.type === "input_file");
    assert.equal(file.filename, "guide.pdf");
    assert.equal(Buffer.from(file.file_data.split(",")[1], "base64").toString(), "pdf bytes");
    return { ok: true, json: async () => ({ output: [{ content: [{ type: "output_text", text: "Fecha: 13 de septiembre" }] }] }) };
  } });
  assert.equal(await processor.process({ mime_type: "application/pdf", file_name: "guide.pdf", bytes: Buffer.from("pdf bytes") }), "Fecha: 13 de septiembre");
});

test("OpenAI knowledge processor sends images as input_image and normalizes provider errors", async () => {
  const processor = createOpenAiKnowledgeProcessor({ apiKey: "secret-key", fetchImpl: async (_url, options) => {
    const body = JSON.parse(options.body);
    assert.equal(body.input[0].content[1].type, "input_image");
    return { ok: false, status: 429, json: async () => ({ error: { type: "rate_limit" } }) };
  } });
  await assert.rejects(() => processor.process({ mime_type: "image/png", file_name: "poster.png", bytes: Buffer.from([1, 2]) }), /openai_knowledge_failed:rate_limit/);
});
