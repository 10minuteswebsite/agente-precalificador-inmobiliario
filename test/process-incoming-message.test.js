import test from "node:test";
import assert from "node:assert/strict";
import { createInMemoryRouterRepository } from "../src/adapters/persistence/in-memory-router-repository.js";
import { processIncomingMessage } from "../src/application/process-incoming-message.js";

test("processes a message once and creates its lead and conversation", async () => {
  const repository = createInMemoryRouterRepository();
  let sequence = 0;
  const normalized = {
    event_id: "wamid.1", idempotency_key: "meta:wamid.1", sender_phone: "+1",
    sender_name: "Ana Pérez", occurred_at: "2026-07-30T12:00:00.000Z",
    message: { kind: "text", text: "Casa frente al mar — 4F7K" },
  };
  const campaigns = [{ id: "camp-1", code: "4F7K", message: "Casa frente al mar", agent_id: "agent-1" }];
  const options = { campaigns, repository, idFactory: () => `id-${++sequence}` };

  const first = await processIncomingMessage(normalized, options);
  const second = await processIncomingMessage(normalized, options);

  assert.equal(first.status, "routed");
  assert.equal(first.conversation_action, "start");
  assert.equal(second.status, "duplicate");
  assert.equal(repository.snapshot().leads[0].first_name, "Ana");
  assert.equal(repository.snapshot().messages.length, 1);
});

test("passes the latest inbound text to every summary provider", async () => {
  const repository = createInMemoryRouterRepository();
  const calls = [];
  await processIncomingMessage({
    event_id: "m-summary", idempotency_key: "meta:m-summary", sender_phone: "+3", sender_name: "Ana",
    occurred_at: "2026-07-30T12:00:00.000Z", message: { kind: "text", text: "Necesito saber si pueden curar el cáncer — SUM1" },
  }, {
    campaigns: [{ id: "camp-summary", code: "SUM1", message: "Constelaciones", agent_id: "agent-1" }], repository,
    idFactory: (() => { let n = 0; return () => `summary-${++n}`; })(),
    conversationSummarizer: { update: async (payload) => { calls.push(payload); return "El lead consulta por cáncer."; } },
  });
  assert.equal(calls[0].message.text, "Necesito saber si pueden curar el cáncer — SUM1");
  assert.equal(calls[0].note, "Necesito saber si pueden curar el cáncer — SUM1");
});

test("records unresolved messages for manual review", async () => {
  const repository = createInMemoryRouterRepository();
  let sequence = 0;
  const result = await processIncomingMessage({
    event_id: "wamid.2", idempotency_key: "meta:wamid.2", sender_phone: "+2",
    sender_name: null, occurred_at: "2026-07-30T12:00:00.000Z",
    message: { kind: "text", text: "Hola" },
  }, { campaigns: [], repository, idFactory: () => `id-${++sequence}` });

  assert.equal(result.status, "manual_review");
  assert.equal(repository.snapshot().manualReviews.length, 1);
  assert.equal(repository.snapshot().messages.length, 1);
});

test("keeps an unresolved lead informed while manual review is pending", async () => {
  const repository = createInMemoryRouterRepository();
  const sent = [];
  const result = await processIncomingMessage({
    event_id: "m-hold", idempotency_key: "meta:m-hold", sender_phone: "+8", sender_name: null,
    occurred_at: "2026-07-30T12:00:00.000Z", message: { kind: "text", text: "Hola" },
  }, { campaigns: [], repository, idFactory: (() => { let n = 0; return () => `hold-${++n}`; })(), messageSender: { sendText: async (input) => { sent.push(input); return { id: "wamid.hold" }; } } });
  assert.equal(result.status, "manual_review");
  assert.equal(result.delivery.status, "sent");
  assert.match(sent[0].text, /revisando/);
});

test("uses the emergency responder when ownership is unknown", async () => {
  const repository = createInMemoryRouterRepository();
  const sent = [];
  const result = await processIncomingMessage({ event_id: "m-emergency", idempotency_key: "meta:m-emergency", sender_phone: "+82", sender_name: null, occurred_at: "2026-07-30T12:00:00.000Z", message: { kind: "text", text: "Hola" } }, {
    campaigns: [], repository, idFactory: (() => { let n = 0; return () => `emergency-${++n}`; })(),
    emergencyResponder: { respond: async () => "Hola, ¿en qué puedo ayudarte?" },
    messageSender: { sendText: async ({ text }) => { sent.push(text); return { id: "wamid.emergency" }; } },
  });
  assert.equal(result.status, "manual_review");
  assert.equal(sent[0], "Hola, ¿en qué puedo ayudarte?");
});

test("notifies the internal review queue with the unresolved lead context", async () => {
  const repository = createInMemoryRouterRepository();
  const notices = [];
  const result = await processIncomingMessage({
    event_id: "m-notice", idempotency_key: "meta:m-notice", sender_phone: "+81", sender_name: "Sara López",
    occurred_at: "2026-07-30T12:00:00.000Z", message: { kind: "text", text: "Hola" },
  }, {
    campaigns: [], repository, idFactory: (() => { let n = 0; return () => `notice-${++n}`; })(),
    reviewNotifier: { notify: async (notice) => notices.push(notice) },
  });
  assert.equal(result.status, "manual_review");
  assert.equal(notices.length, 1);
  assert.equal(notices[0].lead.first_name, "Sara");
  assert.equal(notices[0].inbound.message.text, "Hola");
});

test("transcribes a voice note before applying routing", async () => {
  const repository = createInMemoryRouterRepository();
  const result = await processIncomingMessage({
    event_id: "m-voice-route", idempotency_key: "meta:m-voice-route", sender_phone: "+9", sender_name: "Luz",
    occurred_at: "2026-07-30T12:00:00.000Z", message: { kind: "voice", media_id: "audio-1" },
  }, {
    campaigns: [{ id: "camp-voice", code: "GGGG", message: "Casa", agent_id: "agent-voice" }], repository,
    idFactory: (() => { let n = 0; return () => `voice-${++n}`; })(),
    transcriber: { transcribe: async ({ media_id }) => { assert.equal(media_id, "audio-1"); return "Casa — GGGG"; } },
  });
  assert.equal(result.status, "routed");
  assert.equal(repository.snapshot().messages[0].body, "Casa — GGGG");
});

test("continues the same campaign conversation and opens another for a new campaign", async () => {
  const repository = createInMemoryRouterRepository({
    leads: [{ id: "lead-1", phone: "+3" }],
    conversations: [{ id: "conv-1", lead_id: "lead-1", campaign_id: "camp-1" }],
  });
  let sequence = 0;
  const base = { sender_phone: "+3", sender_name: "Luis", occurred_at: "2026-07-30T12:00:00.000Z" };
  const options = {
    campaigns: [
      { id: "camp-1", code: "AAAA", message: "Casa", agent_id: "agent-1" },
      { id: "camp-2", code: "BBBB", message: "Apartamento", agent_id: "agent-2" },
    ], repository, idFactory: () => `new-${++sequence}`,
  };
  const same = await processIncomingMessage({ ...base, event_id: "m-3a", idempotency_key: "meta:m-3a", message: { kind: "text", text: "Casa — AAAA" } }, options);
  const other = await processIncomingMessage({ ...base, event_id: "m-3b", idempotency_key: "meta:m-3b", message: { kind: "text", text: "Apartamento — BBBB" } }, options);

  assert.equal(same.conversation_action, "continue");
  assert.equal(same.conversation_id, "conv-1");
  assert.equal(other.conversation_action, "start");
  assert.notEqual(other.conversation_id, "conv-1");
});

test("dispatches a routed message to the assigned agent runner", async () => {
  const repository = createInMemoryRouterRepository();
  const calls = [];
  const result = await processIncomingMessage({
    event_id: "m-dispatch", idempotency_key: "meta:m-dispatch", sender_phone: "+4",
    sender_name: "Marta", occurred_at: "2026-07-30T12:00:00.000Z",
    message: { kind: "text", text: "Casa — CCCC" },
  }, {
    campaigns: [{ id: "camp-1", code: "CCCC", message: "Casa", agent_id: "agent-1" }],
    repository, idFactory: (() => { let n = 0; return () => `id-${++n};`; })(),
    agentRunner: { respond: async (input) => { calls.push(input); return { accepted: true }; } },
  });
  assert.equal(result.dispatch.status, "dispatched");
  assert.equal(calls[0].agent_id, "agent-1");
  assert.equal(calls[0].campaign_id, "camp-1");
});

test("delivers and persists the assigned agent response through a sender port", async () => {
  const repository = createInMemoryRouterRepository();
  const sent = [];
  const result = await processIncomingMessage({
    event_id: "m-delivery", idempotency_key: "meta:m-delivery", sender_phone: "+5",
    sender_name: "Nora", occurred_at: "2026-07-30T12:00:00.000Z",
    message: { kind: "text", text: "Casa — DDDD" },
  }, {
    campaigns: [{ id: "camp-1", code: "DDDD", message: "Casa", agent_id: "agent-1" }],
    repository, idFactory: (() => { let n = 0; return () => `id-${++n}`; })(),
    agentRunner: { respond: async () => ({ text: "Claro, Nora. ¿Qué deseas saber?" }) },
    messageSender: { sendText: async (input) => { sent.push(input); return { id: "wamid.out-1" }; } },
  });
  assert.equal(result.delivery.status, "sent");
  assert.deepEqual(sent, [{ to: "+5", text: "Claro, Nora. ¿Qué deseas saber?" }]);
  assert.equal(repository.snapshot().messages.at(-1).direction, "outbound");
});

test("passes the live conversation summary to the assigned agent", async () => {
  const repository = createInMemoryRouterRepository({
    leads: [{ id: "lead-summary", phone: "+6", first_name: "Eva" }],
    conversations: [{ id: "conv-summary", lead_id: "lead-summary", campaign_id: "camp-summary", summary: "Busca una casa frente al mar" }],
  });
  let received;
  await processIncomingMessage({
    event_id: "m-summary", idempotency_key: "meta:m-summary", sender_phone: "+6", sender_name: "Eva",
    occurred_at: "2026-07-30T12:00:00.000Z", message: { kind: "text", text: "¿Hay disponibilidad?" },
  }, {
    campaigns: [{ id: "camp-summary", code: "EEEE", message: "Casa", agent_id: "agent-summary" }], repository,
    idFactory: (() => { let n = 0; return () => `sum-${++n}`; })(),
    agentRunner: { respond: async (input) => { received = input; return "Entendido"; } },
  });
  assert.match(received.conversation_summary, /Busca una casa frente al mar/);
});

test("updates only the live conversation summary through the summarizer port", async () => {
  const repository = createInMemoryRouterRepository();
  await processIncomingMessage({
    event_id: "m-summarize", idempotency_key: "meta:m-summarize", sender_phone: "+7", sender_name: "Omar Ruiz",
    occurred_at: "2026-07-30T12:00:00.000Z", message: { kind: "text", text: "Propiedad — FFFF" },
  }, {
    campaigns: [{ id: "camp-summarize", code: "FFFF", message: "Propiedad", agent_id: "agent-summarize" }], repository,
    idFactory: (() => { let n = 0; return () => `summary-${++n}`; })(),
    conversationSummarizer: { update: async ({ lead, message }) => `${lead.first_name}: ${message.text}` },
  });
  assert.equal(repository.snapshot().conversations[0].summary, "Omar: Propiedad — FFFF");
});

test("keeps a live fallback summary and explicit intents when no summarizer is configured", async () => {
  const repository = createInMemoryRouterRepository();
  await processIncomingMessage({
    event_id: "m-insight", idempotency_key: "meta:m-insight", sender_phone: "+70", sender_name: "Omar Ruiz",
    occurred_at: "2026-08-01T12:00:00.000Z", message: { kind: "text", text: "¿Cuándo es el taller y cuánto cuesta? — FFFF" },
  }, {
    campaigns: [{ id: "camp-insight", code: "FFFF", message: "Taller", agent_id: "agent-insight" }], repository,
    idFactory: (() => { let n = 0; return () => `insight-${++n}`; })(),
  });
  const conversation = repository.snapshot().conversations[0];
  assert.match(conversation.summary, /ha pedido confirmar la fecha y el precio/);
  assert.doesNotMatch(conversation.summary, /Cuándo es el taller/);
  assert.deepEqual(conversation.qualification_state.intent.labels, ["Consultar precio", "Consultar fecha u horario"]);
});

test("updates the fallback summary when a lead changes to an unclassified topic", async () => {
  const repository = createInMemoryRouterRepository({
    leads: [{ id: "lead-milton", phone: "+72", first_name: "Milton" }],
    conversations: [{ id: "conv-milton", lead_id: "lead-milton", campaign_id: "camp-milton", summary: "El lead está evaluando la oferta y necesita confirmar el precio.", qualification_state: { intent: { labels: ["Consultar precio"] } } }],
  });
  await processIncomingMessage({ event_id: "m-milton", idempotency_key: "meta:m-milton", sender_phone: "+72", sender_name: "Milton", occurred_at: "2026-08-05T18:00:00.000Z", message: { kind: "text", text: "Necesito un psicólogo para mi gato" } }, {
    campaigns: [{ id: "camp-milton", code: "MMMM", message: "Prueba Milton", agent_id: "agent-milton" }], repository,
    idFactory: (() => { let n = 0; return () => `milton-${++n}`; })(),
  });
  assert.match(repository.snapshot().conversations[0].summary, /consulta adicional/);
});

test("builds the fallback narrative from the full inbound history of one campaign", async () => {
  const repository = createInMemoryRouterRepository({
    leads: [{ id: "lead-history", phone: "+71" }],
    conversations: [{ id: "conv-history", lead_id: "lead-history", campaign_id: "camp-history", summary: "" }],
    messages: [
      { conversation_id: "conv-history", direction: "inbound", body: "Quiero información del taller — HHHH" },
      { conversation_id: "conv-history", direction: "inbound", body: "¿Cuándo es, dónde queda y cuánto cuesta?" },
    ],
  });
  await processIncomingMessage({
    event_id: "m-history", idempotency_key: "meta:m-history", sender_phone: "+71", sender_name: "Ana",
    occurred_at: "2026-08-01T12:00:00.000Z", message: { kind: "text", text: "Gracias" },
  }, {
    campaigns: [{ id: "camp-history", code: "HHHH", message: "Taller", name: "Taller de constelaciones", agent_id: "agent-history" }], repository,
    idFactory: (() => { let n = 0; return () => `history-${++n}`; })(),
  });
  const conversation = repository.snapshot().conversations[0];
  assert.match(conversation.summary, /Taller de constelaciones/);
  assert.match(conversation.summary, /cuándo se realiza, dónde es y cuál es el precio/);
});

test("persists structured qualification state and exposes derived events", async () => {
  const repository = createInMemoryRouterRepository();
  const qualificationState = { schema_version: 1, revision: 1, active_profile_id: "buyer", answers: { timeline: { value: "0-3 meses", confidence: 1 } }, missing_question_ids: [], assessment: { status: "prequalified", urgency: "high", reasons: ["Listo"], limitations: [] }, next_action: "request_appointment" };
  const events = [{ type: "qualification.updated" }, { type: "lead.prequalified" }, { type: "appointment.requested" }];
  const result = await processIncomingMessage({ event_id: "m-qualified", idempotency_key: "meta:m-qualified", sender_phone: "+10", sender_name: "Alex", occurred_at: "2026-08-01T12:00:00.000Z", message: { kind: "text", text: "Casa — HHHH" } }, {
    campaigns: [{ id: "camp-qualified", code: "HHHH", message: "Casa", agent_id: "agent-qualified" }], repository,
    idFactory: (() => { let n = 0; return () => `qualified-${++n}`; })(),
    agentRunner: { respond: async () => ({ text: "Perfecto, coordinemos una cita.", qualification_state: qualificationState, events }) },
  });
  assert.equal(repository.snapshot().conversations[0].qualification_state.assessment.status, "prequalified");
  assert.deepEqual(result.events, events);
});

test("persists custom lead values on the campaign conversation", async () => {
  const repository = createInMemoryRouterRepository({
    conversations: [{ id: "conv-fields", lead_id: "lead-fields", campaign_id: "camp-fields", summary: "", custom_field_values: {} }],
    leads: [{ id: "lead-fields", phone: "+101" }],
  });
  await processIncomingMessage({ event_id: "m-fields", idempotency_key: "meta:m-fields", sender_phone: "+101", sender_name: "Ana", occurred_at: "2026-08-01T12:00:00.000Z", message: { kind: "text", text: "Soy arquitecta — FFFF" } }, {
    campaigns: [{ id: "camp-fields", code: "FFFF", message: "Consulta", agent_id: "agent-fields" }], repository,
    idFactory: (() => { let n = 0; return () => `fields-${++n}`; })(),
    agentRunner: { respond: async () => ({ text: "Gracias.", custom_field_values: { profession: { value: "Arquitecta", confidence: 1, consent_given: false } } }) },
  });
  assert.equal(repository.snapshot().conversations[0].custom_field_values.profession.value, "Arquitecta");
});

test("keeps the lead informed and opens review when the assigned AI fails", async () => {
  const repository = createInMemoryRouterRepository();
  const sent = [];
  const notices = [];
  const result = await processIncomingMessage({ event_id: "m-agent-failed", idempotency_key: "meta:m-agent-failed", sender_phone: "+11", sender_name: "Iris", occurred_at: "2026-08-01T13:00:00.000Z", message: { kind: "text", text: "Casa — IIII" } }, {
    campaigns: [{ id: "camp-failed", code: "IIII", message: "Casa", agent_id: "agent-failed" }], repository,
    idFactory: (() => { let n = 0; return () => `failed-${++n}`; })(),
    agentRunner: { respond: async () => { throw new Error("invalid_prequalifier_response"); } },
    reviewNotifier: { notify: async (notice) => notices.push(notice) },
    messageSender: { sendText: async (input) => { sent.push(input); return { id: "wamid.hold-agent" }; } },
  });
  const snapshot = repository.snapshot();
  assert.equal(result.status, "routed");
  assert.deepEqual(result.dispatch, { status: "failed", reason: "agent_execution_failed" });
  assert.equal(result.delivery.status, "sent");
  assert.match(sent[0].text, /revisando/);
  assert.equal(snapshot.manualReviews[0].reason, "agent_execution_failed");
  assert.equal(snapshot.messages.at(-1).conversation_id, snapshot.conversations[0].id);
  assert.equal(notices.length, 1);
});

test("does not let an optional review notification failure interrupt the lead flow", async () => {
  const repository = createInMemoryRouterRepository();
  const result = await processIncomingMessage({ event_id: "m-notifier-failed", idempotency_key: "meta:m-notifier-failed", sender_phone: "+12", sender_name: null, occurred_at: "2026-08-01T14:00:00.000Z", message: { kind: "text", text: "Hola" } }, {
    campaigns: [], repository, idFactory: (() => { let n = 0; return () => `notifier-${++n}`; })(),
    reviewNotifier: { notify: async () => { throw new Error("notification_down"); } },
  });
  assert.equal(result.status, "manual_review");
  assert.equal(repository.snapshot().manualReviews.length, 1);
});
