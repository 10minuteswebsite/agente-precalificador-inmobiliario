import test from "node:test";
import assert from "node:assert/strict";
import { createHttpAgentDnaBuilder } from "../src/adapters/ai/http-agent-dna-builder.js";

test("HTTP Agent DNA builder isolates provider details", async () => {
  let call;
  const generate = createHttpAgentDnaBuilder({ endpoint: "https://builder.example.test/generate", token: "synthetic-token", fetchImpl: async (...args) => {
    call = args;
    return { ok: true, json: async () => ({ status: "needs_input", message: "¿Qué mercado atiendes?" }) };
  } });
  const result = await generate({ task: "build" });
  assert.equal(result.status, "needs_input");
  assert.equal(call[0], "https://builder.example.test/generate");
  assert.equal(call[1].headers.Authorization, "Bearer synthetic-token");
  assert.equal(call[1].signal instanceof AbortSignal, true);
});

test("HTTP Agent DNA builder translates provider failures", async () => {
  const generate = createHttpAgentDnaBuilder({ endpoint: "https://builder.example.test/generate", fetchImpl: async () => ({ ok: false, status: 429, json: async () => ({ error: { code: "rate_limited" } }) }) });
  await assert.rejects(() => generate({}), /agent_builder_failed:rate_limited/);
});
