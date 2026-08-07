import test from "node:test";
import assert from "node:assert/strict";
import { createHttpEmergencyResponder } from "../src/adapters/ai/http-emergency-responder.js";

test("emergency responder returns its provider-neutral text", async () => {
  const responder = createHttpEmergencyResponder({ endpoint: "https://internal.example/emergency", fetchImpl: async () => ({ ok: true, json: async () => ({ text: "¿Cómo puedo ayudarte?" }) }) });
  assert.equal(await responder.respond({ lead: { phone: "+1" } }), "¿Cómo puedo ayudarte?");
});
