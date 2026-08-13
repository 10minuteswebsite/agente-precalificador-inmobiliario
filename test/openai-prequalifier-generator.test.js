import test from "node:test";
import assert from "node:assert/strict";
import { createOpenAiPrequalifierGenerator } from "../src/adapters/ai/openai-prequalifier-generator.js";

test("builds the runtime schema from configured profiles and questions", async () => {
  let body;
  const generate = createOpenAiPrequalifierGenerator({
    apiKey: "synthetic",
    fetchImpl: async (_url, options) => {
      body = JSON.parse(options.body);
      return { ok: true, async json() { return { output: [{ content: [{ type: "output_text", text: JSON.stringify({ text: "¿Cuándo deseas comprar?", qualification_state: { schema_version: 1, active_profile_id: "buyer", answers: [{ question_id: "timeline", value: "0-3 meses", confidence: 0.9 }], missing_question_ids: [], assessment: { status: "collecting", urgency: "low", reasons: [], limitations: [] }, next_action: "continue_qualification" } }) }] }] }; } };
    },
  });
  const result = await generate({ agent_dna: { kind: "real_estate_prequalifier", common_questions: [{ id: "timeline" }], profiles: [{ id: "buyer", questions: [] }] }, inbound: { text: "Hola" } });
  const stateSchema = body.text.format.schema.properties.qualification_state;
  assert.equal(result.qualification_state.active_profile_id, "buyer");
  assert.deepEqual(stateSchema.properties.active_profile_id.anyOf[0].enum, ["buyer"]);
  assert.deepEqual(stateSchema.properties.answers.items.properties.question_id.enum, ["timeline"]);
  assert.deepEqual(result.qualification_state.answers.timeline, { value: "0-3 meses", confidence: 0.9 });
  assert.match(body.instructions, /at most one natural question/i);
});

test("keeps generic router agents on a text-only response contract", async () => {
  let body;
  const generate = createOpenAiPrequalifierGenerator({ apiKey: "synthetic", fetchImpl: async (_url, options) => {
    body = JSON.parse(options.body);
    return { ok: true, async json() { return { output: [{ content: [{ type: "output_text", text: '{"text":"Hola"}' }] }] }; } };
  } });
  assert.deepEqual(await generate({ agent_dna: { tone: "friendly" }, inbound: { text: "Hola" } }), { text: "Hola" });
  assert.deepEqual(body.text.format.schema.required, ["text"]);
});

test("adds the scheduler contract when the additive superpower is enabled", async () => {
  let body;
  const generate = createOpenAiPrequalifierGenerator({ apiKey: "synthetic", fetchImpl: async (_url, options) => {
    body = JSON.parse(options.body);
    return { ok: true, async json() { return { output: [{ content: [{ type: "output_text", text: JSON.stringify({
      text: "Encontré un horario.",
      scheduling: { action: "propose_slots", service_id: "intro", range_start: "2030-09-01T00:00:00-04:00", range_end: "2030-09-02T00:00:00-04:00", timezone: "America/New_York", city: "Miami", booking_id: "", modality: "video", confirmed: false, answers: {} },
      qualification_state: { schema_version: 1, active_profile_id: "buyer", answers: [], missing_question_ids: [], assessment: { status: "collecting", urgency: "low", reasons: [], limitations: [] }, next_action: "continue_qualification" },
    }) }] }] }; } };
  } });
  const result = await generate({
    agent_dna: { kind: "real_estate_prequalifier", common_questions: [], profiles: [{ id: "buyer", questions: [] }] },
    scheduler_available: true,
    orchestration: { controller: "conversational", strategy: "additive", superpowers: ["real_estate_prequalifier", "scheduler"] },
    inbound: { text: "Quiero agendar" },
  });
  assert.equal(result.scheduling.action, "propose_slots");
  assert.equal(body.text.format.schema.properties.scheduling.properties.action.enum.includes("confirm_booking"), true);
  assert.match(body.instructions, /scheduler superpower is enabled/i);
});

test("instructs generic agents to greet only at conversation start", async () => {
  let body;
  const generate = createOpenAiPrequalifierGenerator({ apiKey: "synthetic", fetchImpl: async (_url, options) => {
    body = JSON.parse(options.body);
    return { ok: true, async json() { return { output: [{ content: [{ type: "output_text", text: '{\"text\":\"Entendido\"}' }] }] }; } };
  } });
  await generate({ agent_dna: { tone: "friendly" }, conversation_action: "continue", inbound: { text: "¿Cuándo es?" } });
  assert.match(body.instructions, /ongoing conversation/i);
  assert.match(body.instructions, /Do not greet again/i);
});

test("instructs generic agents to collect configured fields subtly", async () => {
  let body;
  const generate = createOpenAiPrequalifierGenerator({ apiKey: "synthetic", fetchImpl: async (_url, options) => {
    body = JSON.parse(options.body);
    return { ok: true, async json() { return { output: [{ content: [{ type: "output_text", text: '{"text":"¿Te gustaría que te envíe la confirmación por correo?"}' }] }] }; } };
  } });
  await generate({ agent_dna: { custom_fields: [{ id: "email", type: "email" }] }, conversation_action: "continue", inbound: { text: "Quiero reservar" } });
  assert.match(body.instructions, /conversation objective/i);
  assert.match(body.instructions, /before finalizing a reservation or handoff/i);
  assert.match(body.instructions, /never present a checklist/i);
  assert.match(body.instructions, /one short, relevant follow-up/i);
  assert.match(body.instructions, /never say formal phrases like '¿me autoriza\?' for ordinary fields/i);
  assert.match(body.instructions, /normalized ISO value/i);
  assert.match(body.instructions, /latest message confirms reservation intent|If reservation intent appears/i);
});

test("passes the first missing capture target when reservation is confirmed", async () => {
  let body;
  const generate = createOpenAiPrequalifierGenerator({ apiKey: "synthetic", fetchImpl: async (_url, options) => {
    body = JSON.parse(options.body);
    return { ok: true, async json() { return { output: [{ content: [{ type: "output_text", text: '{"text":"¿Me compartes tu profesión?"}' }] }] }; } };
  } });
  await generate({ agent_dna: { custom_fields: [{ id: "profession", label: "Profesión", type: "text" }, { id: "email", label: "Correo", type: "email" }] }, custom_field_values: {}, lead: {}, inbound: { text: "sí por favor" } });
  assert.match(body.instructions, /Configured fields still missing: profession \(Profesión\), email \(Correo\)/i);
  assert.match(body.instructions, /ask naturally for the first missing field, Profesión/i);
});

test("rejects duplicate facts for the same configured question", async () => {
  const generate = createOpenAiPrequalifierGenerator({ apiKey: "synthetic", fetchImpl: async () => ({ ok: true, async json() { return { output: [{ content: [{ type: "output_text", text: JSON.stringify({ text: "Gracias", qualification_state: { schema_version: 1, active_profile_id: "buyer", answers: [{ question_id: "timeline", value: "soon", confidence: 0.8 }, { question_id: "timeline", value: "later", confidence: 0.7 }], missing_question_ids: [], assessment: { status: "collecting", urgency: "medium", reasons: [], limitations: [] }, next_action: "continue_qualification" } }) }] }] }; } }) });
  await assert.rejects(() => generate({ agent_dna: { kind: "real_estate_prequalifier", common_questions: [{ id: "timeline" }], profiles: [{ id: "buyer", questions: [] }] } }), /openai_response_duplicate_answer/);
});
