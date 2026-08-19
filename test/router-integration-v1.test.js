import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRouterIntegrationV1, ROUTER_INTEGRATION_V1 } from "../src/application/router-integration-v1.js";
import { deriveRequestId } from "../src/domain/contracts/router-integration-events.js";

const agentDna = {
  kind: "real_estate_prequalifier",
  common_questions: [{ id: "timeline", requirement: "required" }],
  profiles: [{ id: "local_buyer", questions: [{ id: "budget", requirement: "required" }], qualification: { criteria: [] } }],
  max_questions: 7,
};

function baseInput(overrides = {}) {
  return {
    schema_version: 1,
    tenant_id: "tenant-1",
    agent_id: "agent-1",
    campaign_id: "campaign-1",
    conversation_id: "conversation-1",
    idempotency_key: "qualification:conversation-1:1",
    agent_dna: agentDna,
    conversation_summary: "Compra de vivienda en marcha.",
    qualification_state: {},
    custom_field_values: {},
    lead: { first_name: "Ana", phone: "+5215500000000" },
    inbound: { text: "Estoy buscando una casa." },
    ...overrides,
  };
}

function collectingOutput(overrides = {}) {
  return {
    text: "¿Qué presupuesto aproximado manejas?",
    qualification_state: {
      schema_version: 1,
      active_profile_id: "local_buyer",
      answers: { timeline: { value: "0-3 meses", confidence: 0.9 } },
      missing_question_ids: ["budget"],
      assessment: { status: "collecting", urgency: "medium", reasons: ["El plazo es cercano"], limitations: [] },
      next_action: "continue_qualification",
      ...overrides,
    },
  };
}

function adapterWith(response) {
  return createRouterIntegrationV1({ generator: async () => response });
}

test("produces contract-shaped output bound to the input scopes", async () => {
  const result = await adapterWith(collectingOutput())(baseInput());
  assert.deepEqual(Object.keys(result).sort(), ["custom_fields", "events", "qualification_state", "text"]);
  assert.equal(result.text, "¿Qué presupuesto aproximado manejas?");
  assert.equal(result.qualification_state.schema_version, 1);
  assert.equal(result.qualification_state.revision, 1);
  assert.deepEqual(result.custom_fields, []);
  assert.equal(result.events[0].type, "qualification.updated");
  assert.equal(result.events[0].conversation_id, "conversation-1");
  assert.equal(result.events[0].tenant_id, "tenant-1");
  assert.equal(result.events[0].agent_id, "agent-1");
  assert.equal(result.events[0].campaign_id, "campaign-1");
  assert.equal(result.events[0].request_id, deriveRequestId("qualification:conversation-1:1"));
});

test("preserves an additive scheduler action from the shared conversational turn", async () => {
  let orchestration;
  const qualify = createRouterIntegrationV1({
    generator: async (input) => {
      orchestration = input.orchestration;
      return {
        ...collectingOutput(),
        scheduling: { action: "propose_slots", service_id: "intro", range_start: "2030-09-01T00:00:00-04:00", range_end: "2030-09-02T00:00:00-04:00", timezone: "America/New_York", city: "Miami", booking_id: "", modality: "video", confirmed: false, answers: {} },
      };
    },
  });
  const result = await qualify(baseInput({ scheduler_available: true }));
  assert.deepEqual(orchestration.superpowers, ["real_estate_prequalifier", "scheduler"]);
  assert.equal(result.scheduling.action, "propose_slots");
});

test("rejects scheduler output when the additive capability is unavailable", async () => {
  const qualify = createRouterIntegrationV1({
    generator: async () => ({
      ...collectingOutput(),
      scheduling: { action: "none", service_id: "", range_start: "", range_end: "", timezone: "", city: "", booking_id: "", modality: "phone", confirmed: false, answers: {} },
    }),
  });
  await assert.rejects(() => qualify(baseInput()), /scheduling_not_enabled/);
});

test("rejects unsupported schema versions and missing scopes", async () => {
  const qualify = adapterWith(collectingOutput());
  await assert.rejects(() => qualify(baseInput({ schema_version: 2 })), /schema_version_unsupported/);
  await assert.rejects(() => qualify(baseInput({ tenant_id: undefined })), /tenant_id_required/);
  await assert.rejects(() => qualify(baseInput({ agent_id: undefined })), /agent_id_required/);
  await assert.rejects(() => qualify(baseInput({ campaign_id: undefined })), /campaign_id_required/);
  await assert.rejects(() => qualify(baseInput({ conversation_id: undefined })), /conversation_id_required/);
});

test("binds the idempotency key to the same conversation", async () => {
  const qualify = adapterWith(collectingOutput());
  await assert.rejects(
    () => qualify(baseInput({ idempotency_key: "qualification:conversation-other:1" })),
    /idempotency_key_mismatch/,
  );
  await assert.rejects(() => qualify(baseInput({ idempotency_key: "" })), /idempotency_key_required/);
});

test("keeps the lead minimal and rejects fields outside the contract", async () => {
  const qualify = adapterWith(collectingOutput());
  await assert.rejects(
    () => qualify(baseInput({ lead: { first_name: "Ana", phone: "+5215500000000", email: "ana@example.com" } })),
    /lead_unsupported_fields/,
  );
  await assert.rejects(() => qualify(baseInput({ lead: undefined })), /lead_required/);
});

test("requires inbound text for the last message", async () => {
  const qualify = adapterWith(collectingOutput());
  await assert.rejects(() => qualify(baseInput({ inbound: {} })), /inbound_text_required/);
  await assert.rejects(() => qualify(baseInput({ inbound: undefined })), /inbound_required/);
});

test("refuses a qualification state scoped to another organization", async () => {
  const qualify = adapterWith(collectingOutput());
  const foreign = baseInput({
    qualification_state: {
      schema_version: 1,
      active_profile_id: "local_buyer",
      _scope: { tenant_id: "tenant-2", conversation_id: "conversation-2" },
    },
  });
  await assert.rejects(() => qualify(foreign), /scope_mismatch/);
  const same = baseInput({
    qualification_state: {
      schema_version: 1,
      active_profile_id: "local_buyer",
      _scope: { tenant_id: "tenant-1", conversation_id: "conversation-1" },
    },
  });
  await qualify(same);
});

test("refuses a generic agent that did not declare the capability", async () => {
  const qualify = adapterWith({ text: "Hola" });
  await assert.rejects(
    () => qualify(baseInput({ agent_dna: { kind: "generic", personality: "friendly" } })),
    /capability_not_declared/,
  );
});

test("is idempotent across retries with the same key", async () => {
  const qualify = adapterWith(collectingOutput());
  const input = baseInput();
  const first = await qualify(input);
  const second = await qualify(input);
  assert.deepEqual(second, first);
  assert.equal(second.qualification_state.revision, 1);
  assert.deepEqual(second.events, first.events);
});

test("emits lead.prequalified and appointment.requested only on the transition", async () => {
  const prequalified = collectingOutput({
    answers: { timeline: { value: "0-3 meses", confidence: 1 }, budget: { value: 500000, confidence: 1 } },
    missing_question_ids: [],
    assessment: { status: "prequalified", urgency: "high", reasons: ["Preparación suficiente"], limitations: [] },
    next_action: "request_appointment",
  });
  const qualify = adapterWith(prequalified);
  const input = baseInput();
  const first = await qualify(input);
  assert.deepEqual(first.events.map((event) => event.type), ["qualification.updated", "lead.prequalified", "appointment.requested"]);
  const retry = await qualify(input);
  assert.deepEqual(retry.events.map((event) => event.type), ["qualification.updated", "lead.prequalified", "appointment.requested"]);
});

test("does not duplicate events when replaying the state from the previous turn", async () => {
  const qualify = createRouterIntegrationV1({ generator: async () => collectingOutput() });
  const first = await qualify(baseInput());
  const next = await qualify(baseInput({ qualification_state: first.qualification_state, idempotency_key: "qualification:conversation-1:2" }));
  assert.equal(next.qualification_state.revision, 2);
  assert.deepEqual(next.events.map((event) => event.type), ["qualification.updated"]);
  assert.equal(next.events[0].request_id, deriveRequestId("qualification:conversation-1:2"));
});

test("wraps provider failures with a stable error", async () => {
  const qualify = createRouterIntegrationV1({ generator: async () => { throw new Error("upstream down"); } });
  await assert.rejects(() => qualify(baseInput()), /router_integration:provider_unavailable:upstream down/);
});

test("wraps invalid AI output with a stable error", async () => {
  const qualify = adapterWith({ text: "Hola" });
  await assert.rejects(() => qualify(baseInput()), /router_integration:invalid_ai_response:invalid_prequalifier_response:state_required/);
});

test("maps captured custom fields into the contract array", async () => {
  const dna = {
    ...agentDna,
    custom_fields: [
      { id: "move_in_date", label: "Fecha de mudanza", type: "date" },
      { id: "budget_range", label: "Presupuesto", type: "number" },
    ],
  };
  const qualify = createRouterIntegrationV1({
    generator: async () => ({
      ...collectingOutput(),
      custom_fields: [
        { field_id: "move_in_date", value: "2026-12-01", confidence: 0.9, consent_given: false },
        { field_id: "budget_range", value: 400000, confidence: 1, consent_given: false },
      ],
    }),
  });
  const result = await qualify(baseInput({ agent_dna: dna, custom_field_values: {} }));
  assert.deepEqual(result.custom_fields, [
    { field_id: "move_in_date", value: "2026-12-01", confidence: 0.9, consent_given: false },
    { field_id: "budget_range", value: 400000, confidence: 1, consent_given: false },
  ]);
});

test("keeps outputs isolated between two organizations", async () => {
  const qualify = adapterWith(collectingOutput());
  const orgA = await qualify(baseInput());
  const orgB = await qualify(baseInput({ tenant_id: "tenant-2", conversation_id: "conversation-2", idempotency_key: "qualification:conversation-2:1" }));
  for (const event of orgA.events) {
    assert.equal(event.tenant_id, "tenant-1");
    assert.equal(event.conversation_id, "conversation-1");
  }
  for (const event of orgB.events) {
    assert.equal(event.tenant_id, "tenant-2");
    assert.equal(event.conversation_id, "conversation-2");
  }
  assert.notEqual(deriveRequestId("qualification:conversation-1:1"), deriveRequestId("qualification:conversation-2:1"));
});

test("declares the versioned capability contract", () => {
  assert.equal(ROUTER_INTEGRATION_V1.schemaVersion, 1);
  assert.equal(ROUTER_INTEGRATION_V1.capability, "real_estate_prequalifier");
  assert.equal(ROUTER_INTEGRATION_V1.controller, "conversational");
  assert.equal(ROUTER_INTEGRATION_V1.strategy, "handoff");
  assert.equal(ROUTER_INTEGRATION_V1.handoff_contract_version, "superpower.handoff.v1");
});

test("publishes a manifest and the referenced contract documents", async () => {
  const manifest = JSON.parse(await readFile(new URL("../module-manifest.json", import.meta.url), "utf8"));
  assert.equal(manifest.schema_version, 1);
  assert.equal(manifest.module, "real_estate_prequalifier");
  assert.equal(manifest.contracts.integration.entrypoint, "createRouterIntegrationV1");
  assert.equal(manifest.contracts.public_entrypoint, "createPrequalifierModule");
  assert.equal(manifest.role, "additive-superpower");
  assert.equal(manifest.controller, "conversational");
  assert.equal(manifest.strategy, "handoff");
  assert.equal(manifest.handoff_contract_version, "superpower.handoff.v1");
  const manifestDoc = await readFile(new URL("../docs/contracts/module-manifest-v1.md", import.meta.url), "utf8");
  assert.match(manifestDoc, /createRouterIntegrationV1/);
  const errorDoc = await readFile(new URL("../docs/contracts/error-contract.md", import.meta.url), "utf8");
  assert.match(errorDoc, /invalid_router_input/);
  assert.match(errorDoc, /provider_unavailable/);
});
