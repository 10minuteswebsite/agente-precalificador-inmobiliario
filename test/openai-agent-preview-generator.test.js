import test from "node:test";
import assert from "node:assert/strict";
import { createOpenAiAgentPreviewGenerator } from "../src/adapters/ai/openai-agent-preview-generator.js";

test("agent preview requests stateless text and feedback without exposing secrets", async () => {
  const requests = [];
  const preview = createOpenAiAgentPreviewGenerator({ apiKey: "synthetic-secret", fetchImpl: async (_url, options) => {
    requests.push(JSON.parse(options.body));
    const text = requests.length === 1 ? '{"text":"Respuesta de prueba"}' : '{"summary":"Correcto","solution":"Responder con claridad","application":"Añadir una regla de respuesta breve","rules_addition":"Responde con frases breves."}';
    return { ok: true, async json() { return { output: [{ content: [{ type: "output_text", text }] }] }; } };
  } });
  const first = await preview.reply({ agent_dna: { context: "Taller" }, agent_name: "Demo", conversation_action: "start", inbound: { text: "Hola" } });
  const feedback = await preview.feedback({ agent_dna: { context: "Taller" }, feedback: "No saludes de nuevo" });
  assert.equal(first.text, "Respuesta de prueba");
  assert.equal(feedback.rules_addition, "Responde con frases breves.");
  assert.equal(feedback.solution, "Responder con claridad");
  assert.equal(requests[0].store, false);
  assert.equal(JSON.stringify(requests).includes("synthetic-secret"), false);
});
