import test from "node:test";
import assert from "node:assert/strict";
import { createOpenAiStructuredGenerator } from "../src/adapters/ai/openai-structured-generator.js";

test("requests strict, stateless structured output without exposing the key in the body", async () => {
  let request;
  const generate = createOpenAiStructuredGenerator({
    apiKey: "synthetic-secret",
    fetchImpl: async (_url, options) => {
      request = options;
      return { ok: true, async json() { return { output: [{ type: "message", content: [{ type: "output_text", text: '{"answer":"ok"}' }] }] }; } };
    },
  });
  const schema = { type: "object", properties: { answer: { type: "string" } }, required: ["answer"], additionalProperties: false };
  const result = await generate({ name: "test_result", schema, instructions: "Return a result.", input: { safe: true } });
  const body = JSON.parse(request.body);
  assert.deepEqual(result, { answer: "ok" });
  assert.equal(body.model, "gpt-5.6");
  assert.equal(body.store, false);
  assert.equal(body.text.format.strict, true);
  assert.equal(request.headers.Authorization, "Bearer synthetic-secret");
  assert.equal(request.body.includes("synthetic-secret"), false);
});

test("surfaces provider failures and refusals as controlled errors", async () => {
  const failed = createOpenAiStructuredGenerator({ apiKey: "x", fetchImpl: async () => ({ ok: false, status: 429, async json() { return { error: { code: "rate_limit" } }; } }) });
  await assert.rejects(() => failed({ name: "x", schema: {}, instructions: "x", input: "x" }), /openai_response_failed:rate_limit/);
  const refused = createOpenAiStructuredGenerator({ apiKey: "x", fetchImpl: async () => ({ ok: true, async json() { return { output: [{ content: [{ type: "refusal", refusal: "no" }] }] }; } }) });
  await assert.rejects(() => refused({ name: "x", schema: {}, instructions: "x", input: "x" }), /openai_response_refused/);
});

test("requires an API key before creating the provider", () => {
  assert.throws(() => createOpenAiStructuredGenerator(), /openai_not_configured/);
});

