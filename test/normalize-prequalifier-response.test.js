import test from "node:test";
import assert from "node:assert/strict";
import { normalizeAgentResponse } from "../src/domain/qualification/normalize-prequalifier-response.js";

const agentDna = {
  kind: "real_estate_prequalifier",
  common_questions: [{ id: "timeline" }],
  profiles: [{ id: "local_buyer", questions: [{ id: "budget" }, { id: "credit_score" }] }],
};

function output(overrides = {}) {
  return {
    text: "Gracias. Para orientarte mejor, ¿qué presupuesto aproximado manejas?",
    qualification_state: {
      schema_version: 1,
      active_profile_id: "local_buyer",
      answers: { timeline: { value: "0-3 meses", confidence: 0.9 } },
      missing_question_ids: ["budget", "credit_score"],
      assessment: { status: "collecting", urgency: "medium", reasons: ["El plazo es cercano"], limitations: [] },
      next_action: "continue_qualification",
      ...overrides,
    },
  };
}

test("normalizes structured qualification state and derives an update event", () => {
  const result = normalizeAgentResponse({ agentDna, output: output(), conversationId: "conversation-1" });
  assert.equal(result.qualification_state.revision, 1);
  assert.equal(result.qualification_state.answers.timeline.value, "0-3 meses");
  assert.equal(result.events[0].type, "qualification.updated");
  assert.equal(result.events[0].idempotency_key, "qualification:conversation-1:1");
});

test("preserves previously known answers when the model adds a new answer", () => {
  const currentState = { revision: 2, active_profile_id: "local_buyer", answers: { timeline: { value: "0-3 meses", confidence: 0.9 } }, assessment: { status: "collecting" } };
  const result = normalizeAgentResponse({ agentDna, currentState, conversationId: "conversation-1", output: output({ answers: { budget: { value: 500000, confidence: 0.8 } }, missing_question_ids: ["credit_score"] }) });
  assert.equal(result.qualification_state.revision, 3);
  assert.equal(result.qualification_state.answers.timeline.value, "0-3 meses");
  assert.equal(result.qualification_state.answers.budget.value, 500000);
});

test("emits appointment request only on transition to prequalified", () => {
  const prequalified = output({ answers: { budget: { value: 500000 }, credit_score: { value: 720 } }, missing_question_ids: [], assessment: { status: "prequalified", urgency: "high", reasons: ["Preparación suficiente"], limitations: [] }, next_action: "request_appointment" });
  const first = normalizeAgentResponse({ agentDna, output: prequalified, conversationId: "conversation-2" });
  assert.deepEqual(first.events.map((event) => event.type), ["qualification.updated", "lead.prequalified", "appointment.requested"]);
  const repeated = normalizeAgentResponse({ agentDna, output: prequalified, currentState: first.qualification_state, conversationId: "conversation-2" });
  assert.deepEqual(repeated.events.map((event) => event.type), ["qualification.updated"]);
});

test("rejects unknown facts and inconsistent actions", () => {
  const unknown = output({ answers: { secret_field: { value: "x" } } });
  assert.throws(() => normalizeAgentResponse({ agentDna, output: unknown, conversationId: "c" }), /answer_question_unknown/);
  const inconsistent = output({ assessment: { status: "prequalified", urgency: "high", reasons: [], limitations: [] }, next_action: "continue_qualification" });
  assert.throws(() => normalizeAgentResponse({ agentDna, output: inconsistent, conversationId: "c" }), /next_action_invalid_for_status/);
});

test("keeps generic agents compatible with text-only responses", () => {
  assert.deepEqual(normalizeAgentResponse({ agentDna: { personality: "friendly" }, output: { text: "Hola" } }), { text: "Hola" });
});

test("derives missing required questions instead of trusting the model", () => {
  const dna = {
    kind: "real_estate_prequalifier",
    common_questions: [{ id: "timeline", requirement: "required" }],
    profiles: [{ id: "buyer", questions: [{ id: "budget", requirement: "required" }], qualification: { criteria: [] } }],
  };
  const collecting = output({ active_profile_id: "buyer", answers: {}, missing_question_ids: [], assessment: { status: "collecting", urgency: "low", reasons: [], limitations: [] }, next_action: "continue_qualification" });
  const result = normalizeAgentResponse({ agentDna: dna, output: collecting, conversationId: "conversation-required" });
  assert.deepEqual(result.qualification_state.missing_question_ids, ["timeline", "budget"]);
});

test("rejects prequalification when required answers or criteria are not satisfied", () => {
  const dna = {
    kind: "real_estate_prequalifier",
    common_questions: [{ id: "timeline", requirement: "required" }],
    profiles: [{ id: "buyer", questions: [{ id: "budget", requirement: "required" }], qualification: { criteria: [{ id: "budget_minimum", field: "budget", operator: "gte", value: 300000, required: true }] } }],
  };
  const missing = output({ active_profile_id: "buyer", answers: { budget: { value: 400000 } }, missing_question_ids: [], assessment: { status: "prequalified", urgency: "high", reasons: [], limitations: [] }, next_action: "request_appointment" });
  assert.throws(() => normalizeAgentResponse({ agentDna: dna, output: missing, conversationId: "conversation-missing" }), /prequalified_required_answers_missing/);
  const failed = output({ active_profile_id: "buyer", answers: { timeline: { value: "soon" }, budget: { value: 250000 } }, missing_question_ids: [], assessment: { status: "prequalified", urgency: "high", reasons: [], limitations: [] }, next_action: "request_appointment" });
  assert.throws(() => normalizeAgentResponse({ agentDna: dna, output: failed, conversationId: "conversation-failed" }), /prequalified_required_criteria_failed/);
});

test("ignores a conditional required question when its condition does not apply", () => {
  const dna = {
    kind: "real_estate_prequalifier",
    common_questions: [{ id: "payment_method", requirement: "required" }],
    profiles: [{ id: "buyer", questions: [{ id: "credit_score", requirement: "required", when: { field: "payment_method", operator: "equals", value: "financing" } }], qualification: { criteria: [] } }],
  };
  const ready = output({ active_profile_id: "buyer", answers: { payment_method: { value: "cash" } }, missing_question_ids: [], assessment: { status: "prequalified", urgency: "medium", reasons: ["Compra de contado"], limitations: [] }, next_action: "request_appointment" });
  const result = normalizeAgentResponse({ agentDna: dna, output: ready, conversationId: "conversation-cash" });
  assert.equal(result.qualification_state.assessment.status, "prequalified");
});

test("stops repeated clarification loops after two attempts", () => {
  const dna = { ...agentDna, max_questions: 12 };
  const first = normalizeAgentResponse({ agentDna: dna, output: output({ answers: {}, missing_question_ids: ["budget"], active_profile_id: "local_buyer" }), conversationId: "loop" });
  const second = normalizeAgentResponse({ agentDna: dna, currentState: first.qualification_state, output: output({ answers: {}, missing_question_ids: ["budget"], active_profile_id: "local_buyer" }), conversationId: "loop" });
  const third = normalizeAgentResponse({ agentDna: dna, currentState: second.qualification_state, output: output({ answers: {}, missing_question_ids: ["budget"], active_profile_id: "local_buyer" }), conversationId: "loop" });
  assert.equal(third.qualification_state.assessment.status, "human_review");
  assert.equal(third.qualification_state.next_action, "human_handoff");
  assert.match(third.text, /no hacerte repetir/i);
});

test("moves to human review when the configured question limit is reached", () => {
  const dna = { ...agentDna, max_questions: 1 };
  const result = normalizeAgentResponse({ agentDna: dna, output: output({ answers: { timeline: { value: "soon" } }, missing_question_ids: ["budget"], active_profile_id: "local_buyer" }), conversationId: "limit" });
  assert.equal(result.qualification_state.assessment.status, "human_review");
  assert.equal(result.qualification_state.question_count, 1);
  assert.match(result.qualification_state.assessment.limitations.join(" "), /máximo de 1 preguntas/);
});
