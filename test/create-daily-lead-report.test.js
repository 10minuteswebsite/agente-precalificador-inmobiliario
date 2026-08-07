import test from "node:test";
import assert from "node:assert/strict";
import { createDailyLeadReport } from "../src/domain/reporting/create-daily-lead-report.js";

test("creates an actionable report and prioritizes urgent leads", () => {
  const agent = { id: "a1", tenant_id: "t1", name: "Precalificador", configuration: { reporting: { recipients: ["realtor@example.test"] } } };
  const conversations = [
    { leads: { first_name: "Lead bajo", phone: "+10000000001" }, qualification_state: { active_profile_id: "buyer", assessment: { status: "collecting", urgency: "low", reasons: [], limitations: [] }, next_action: "continue_qualification" } },
    { leads: { first_name: "Lead urgente", phone: "+10000000002" }, qualification_state: { active_profile_id: "investor", assessment: { status: "prequalified", urgency: "high", reasons: ["Plazo cercano"], limitations: [] }, next_action: "request_appointment" } },
  ];
  const report = createDailyLeadReport({ agent, conversations, periodStart: new Date("2026-07-31T12:00:00Z"), periodEnd: new Date("2026-08-01T12:00:00Z") });
  assert.deepEqual(report.to, ["realtor@example.test"]);
  assert.match(report.text, /Total: 2 · Precalificados: 1/);
  assert.equal(report.text.indexOf("Lead urgente") < report.text.indexOf("Lead bajo"), true);
  assert.equal(report.metadata.lead_count, 2);
});

test("includes structured fields without copying an originating message", () => {
  const agent = { id: "a1", tenant_id: "t1", name: "Precalificador", configuration: { reporting: { recipients: ["realtor@example.test"] } } };
  const report = createDailyLeadReport({
    agent,
    conversations: [{
      leads: { first_name: "Lead", phone: "+10000000003" },
      custom_field_values: {
        budget: { label: "Presupuesto", value: 450000, confidence: 0.95, consent_given: true, origin: "conversación" },
        timeline: { label: "Plazo", value: "3 meses", confidence: 0.8, consent_given: false },
      },
      qualification_state: { assessment: { status: "collecting", urgency: "low", reasons: [], limitations: [] } },
    }],
    periodStart: new Date("2026-07-31T12:00:00Z"),
    periodEnd: new Date("2026-08-01T12:00:00Z"),
  });
  assert.match(report.text, /Presupuesto: 450000 · Origen: conversación · Consentimiento: sí · Confianza: 95%/);
  assert.match(report.text, /Plazo: 3 meses · Origen: capturado en conversación · Consentimiento: no requerido\/no confirmado · Confianza: 80%/);
  assert.doesNotMatch(report.text, /mensaje original|transcript/i);
});

test("includes structured qualification answers in the daily report", () => {
  const agent = { id: "a1", tenant_id: "t1", name: "Precalificador", configuration: { reporting: { recipients: ["realtor@example.test"] } } };
  const report = createDailyLeadReport({ agent, conversations: [{ leads: { first_name: "Lead", phone: "+1" }, qualification_state: { answers: { budget: { value: 400000, confidence: 0.9 } }, assessment: { status: "prequalified", urgency: "high", reasons: [], limitations: [] } } }], periodStart: new Date("2026-07-31"), periodEnd: new Date("2026-08-01") });
  assert.match(report.text, /Respuestas de precalificación: budget: 400000 · Confianza: 90%/);
});

test("tolerates missing or legacy custom field values", () => {
  const agent = { id: "a1", tenant_id: "t1", name: "Precalificador", configuration: { reporting: { recipients: ["realtor@example.test"] } } };
  const report = createDailyLeadReport({ agent, conversations: [{ leads: {}, qualification_state: {} }], periodStart: new Date("2026-07-31T12:00:00Z"), periodEnd: new Date("2026-08-01T12:00:00Z") });
  assert.match(report.text, /Ningún campo personalizado registrado/);
});
