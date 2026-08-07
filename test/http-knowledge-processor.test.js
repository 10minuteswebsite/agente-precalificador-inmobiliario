import test from "node:test";
import assert from "node:assert/strict";
import { createHttpKnowledgeProcessor } from "../src/adapters/ai/http-knowledge-processor.js";

test("HTTP knowledge processor sends binary content through an isolated adapter", async () => {
  const processor = createHttpKnowledgeProcessor({ endpoint: "https://knowledge.example.test/extract", token: "synthetic", fetchImpl: async (_url, options) => {
    assert.equal(options.headers.Authorization, "Bearer synthetic");
    const body = JSON.parse(options.body);
    assert.equal(body.mime_type, "application/pdf");
    assert.equal(Buffer.from(body.content_base64, "base64").toString(), "pdf bytes");
    return { ok: true, json: async () => ({ text: "Contenido extraído" }) };
  } });
  assert.equal(await processor.process({ mime_type: "application/pdf", file_name: "guide.pdf", bytes: Buffer.from("pdf bytes") }), "Contenido extraído");
});

test("HTTP knowledge processor reports provider failures without leaking content", async () => {
  const processor = createHttpKnowledgeProcessor({ endpoint: "https://knowledge.example.test/extract", fetchImpl: async () => ({ ok: false, status: 502, json: async () => ({ error: { code: "unavailable" } }) }) });
  await assert.rejects(() => processor.process({ mime_type: "image/png", file_name: "image.png", bytes: Buffer.from([1, 2]) }), /knowledge_processor_failed:unavailable/);
});
