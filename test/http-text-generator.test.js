import test from "node:test";
import assert from "node:assert/strict";
import { createHttpTextGenerator } from "../src/adapters/ai/http-text-generator.js";

test("HTTP text generator isolates the configured agent service", async () => {
  let call;
  const generate = createHttpTextGenerator({ endpoint: "https://agent.example.test/respond", token: "token", fetchImpl: async (...args) => {
    call = args;
    return { ok: true, json: async () => ({ text: "Respuesta" }) };
  } });
  const result = await generate({ prompt: "hola" });
  assert.equal(result.text, "Respuesta");
  assert.equal(call[0], "https://agent.example.test/respond");
  assert.equal(call[1].headers.Authorization, "Bearer token");
});
