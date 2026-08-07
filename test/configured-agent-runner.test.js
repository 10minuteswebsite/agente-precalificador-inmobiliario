import test from "node:test";
import assert from "node:assert/strict";
import { createConfiguredAgentRunner } from "../src/application/create-configured-agent-runner.js";

test("configured agent runner composes Agent DNA and live lead context", async () => {
  let request;
  const runner = createConfiguredAgentRunner({
    agentResolver: async () => ({ name: "Asistente", configuration: { personality: "cercana", capabilities: ["scheduler"] } }),
    generate: async (input) => { request = input; return { text: "Claro, te ayudo." }; },
  });
  const result = await runner.respond({ agent_id: "a1", campaign_id: "c1", conversation_id: "v1", conversation_summary: "Busca playa", lead: { first_name: "Ana" }, inbound: { kind: "text", text: "Hola" } });
  assert.equal(result.text, "Claro, te ayudo.");
  assert.deepEqual(request.agent_dna, { personality: "cercana", capabilities: ["scheduler"] });
  assert.deepEqual(request.orchestration, { controller: "conversational", strategy: "additive", superpowers: ["scheduler"] });
  assert.equal(request.conversation_summary, "Busca playa");
  assert.equal(request.lead.first_name, "Ana");
});

test("configured prequalifier returns validated state and derived events", async () => {
  const configuration = {
    kind: "real_estate_prequalifier",
    common_questions: [{ id: "timeline" }],
    profiles: [{ id: "buyer", questions: [] }],
  };
  const runner = createConfiguredAgentRunner({
    agentResolver: async () => ({ name: "Precalificador", configuration }),
    generate: async (input) => {
      assert.deepEqual(input.qualification_state, {});
      return { text: "¿Cuándo deseas comprar?", qualification_state: { schema_version: 1, active_profile_id: "buyer", answers: {}, missing_question_ids: ["timeline"], assessment: { status: "collecting", urgency: "low", reasons: [], limitations: [] }, next_action: "continue_qualification" } };
    },
  });
  const result = await runner.respond({ agent_id: "a1", campaign_id: "c1", conversation_id: "v1", qualification_state: {}, lead: {}, inbound: { text: "Hola" } });
  assert.equal(result.qualification_state.assessment.status, "collecting");
  assert.equal(result.events[0].type, "qualification.updated");
});

test("configured generic agent returns normalized custom lead values", async () => {
  const configuration = { custom_fields: [{ id: "profession", type: "text", options: [], consent_required: false }] };
  const runner = createConfiguredAgentRunner({
    agentResolver: async () => ({ name: "Asistente", configuration }),
    generate: async () => ({ text: "Gracias, lo tendré en cuenta.", custom_fields: [{ field_id: "profession", value: "Arquitecta", confidence: 0.95, consent_given: false }] }),
  });
  const result = await runner.respond({ agent_id: "a1", campaign_id: "c1", conversation_id: "v1", custom_field_values: {}, lead: {}, inbound: { text: "Soy arquitecta" } });
  assert.equal(result.custom_field_values.profession.value, "Arquitecta");
});
