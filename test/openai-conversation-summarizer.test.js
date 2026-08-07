import test from "node:test";
import assert from "node:assert/strict";
import { createOpenAiConversationSummarizer } from "../src/adapters/ai/openai-conversation-summarizer.js";

test("conversation summarizer keeps provider details behind an adapter", async () => {
  let request;
  const summarizer = createOpenAiConversationSummarizer({ apiKey: "synthetic", fetchImpl: async (_url, options) => {
    request = JSON.parse(options.body);
    return { ok: true, async json() { return { output: [{ content: [{ type: "output_text", text: JSON.stringify({ summary: "El lead confirmó su interés y el equipo añadió información de seguimiento." }) }] }] }; } };
  } });
  const summary = await summarizer.update({ current_summary: "El lead evalúa la actividad.", note: "Confirmó que desea reservar." });
  assert.match(summary, /confirmó su interés/);
  assert.equal(request.store, false);
  assert.equal(request.text.format.name, "lead_summary_update");
});

test("conversation summarizer includes the latest WhatsApp message", async () => {
  let request;
  const summarizer = createOpenAiConversationSummarizer({ apiKey: "synthetic", fetchImpl: async (_url, options) => {
    request = JSON.parse(options.body);
    return { ok: true, async json() { return { output: [{ content: [{ type: "output_text", text: JSON.stringify({ summary: "El lead consulta por una situación médica y requiere orientación segura." }) }] }] }; } };
  } });
  await summarizer.update({ current_summary: "El lead explora las constelaciones.", message: { text: "Necesito saber si pueden curar el cáncer" } });
  assert.match(request.input, /pueden curar el cáncer/);
});

test("conversation summarizer requests a compact narrative without duplicating the message", async () => {
  let request;
  const summarizer = createOpenAiConversationSummarizer({ apiKey: "x", fetchImpl: async (...args) => {
    request = args;
    return { ok: true, async json() { return { output: [{ content: [{ type: "output_text", text: JSON.stringify({ summary: "El lead consulta por cáncer y requiere orientación segura." }) }] }] }; } };
  } });
  await summarizer.update({ current_summary: "", note: "Necesito saber si pueden curar el cáncer", message: { text: "Necesito saber si pueden curar el cáncer" } });
  const body = JSON.parse(request[1].body);
  assert.equal(JSON.parse(body.input).note.match(/cáncer/g)?.length, 1);
  assert.match(body.instructions, /3 a 5 frases/);
});
