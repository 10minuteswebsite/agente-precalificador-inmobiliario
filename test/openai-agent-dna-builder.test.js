import test from "node:test";
import assert from "node:assert/strict";
import { createOpenAiAgentDnaBuilder } from "../src/adapters/ai/openai-agent-dna-builder.js";

test("returns one question without attempting to parse an absent draft", async () => {
  const builder = createOpenAiAgentDnaBuilder({ apiKey: "x", fetchImpl: async () => ({ ok: true, async json() { return { output: [{ content: [{ type: "output_text", text: JSON.stringify({ status: "needs_input", message: "¿A qué correo envío el informe diario?", configuration_json: "" }) }] }] }; } }) });
  assert.deepEqual(await builder({ message: "Hola" }), { status: "needs_input", message: "¿A qué correo envío el informe diario?" });
});

test("parses a completed Agent DNA proposal for application validation", async () => {
  const configuration = { schema_version: 1, kind: "real_estate_prequalifier" };
  const builder = createOpenAiAgentDnaBuilder({ apiKey: "x", fetchImpl: async () => ({ ok: true, async json() { return { output: [{ content: [{ type: "output_text", text: JSON.stringify({ status: "draft_ready", message: "Lista.", configuration_json: JSON.stringify(configuration) }) }] }] }; } }) });
  assert.deepEqual((await builder({ message: "Listo" })).configuration, configuration);
});

