import test from "node:test";
import assert from "node:assert/strict";
import { createHttpConversationSummarizer } from "../src/adapters/ai/http-conversation-summarizer.js";

test("summary adapter returns only the processed live summary", async () => {
  let request;
  const summarizer = createHttpConversationSummarizer({ endpoint: "https://internal.example/summary", fetchImpl: async (...args) => {
    request = args;
    return { ok: true, json: async () => ({ summary: "Lead interesado y listo para cita" }) };
  } });
  const result = await summarizer.update({ current_summary: "", note: "Quiere visitar el sábado" });
  assert.equal(result, "Lead interesado y listo para cita");
  assert.equal(JSON.parse(request[1].body).note, "Quiere visitar el sábado");
});
