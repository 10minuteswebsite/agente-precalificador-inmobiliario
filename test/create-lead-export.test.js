import test from "node:test";
import assert from "node:assert/strict";
import { createLeadExport, createLeadCsv, toLeadExportRows } from "../src/domain/leads/create-lead-export.js";

const conversations = [{
  created_at: "2026-08-06T12:00:00Z",
  last_message_at: "2026-08-06T12:05:00Z",
  status: "active",
  summary: "Evalúa comprar su primera vivienda.",
  leads: { first_name: "Ana", phone: "+13055550199", email: "ana@example.test" },
  campaigns: { name: "Compradores", code: "AB12" },
  qualification_state: { active_profile_id: "first_time_buyer", intent: { labels: ["Comprar"] }, assessment: { urgency: "medium" }, next_action: "request_appointment" },
  custom_field_values: { budget: { label: "Presupuesto", value: 450000, confidence: 0.9, consent_given: true } },
}];

test("creates stable organization rows with qualification data and no transcript", () => {
  const [row] = toLeadExportRows(conversations);
  assert.equal(row.profile, "first_time_buyer");
  assert.equal(row.intent, "Comprar");
  assert.equal(row.custom_fields.budget.value, 450000);
  assert.equal(Object.hasOwn(row, "messages"), false);
});

test("serializes CSV with safe quoting and JSON custom fields", () => {
  const csv = createLeadCsv(toLeadExportRows([{ ...conversations[0], summary: 'Dice "sí", luego decide' }]));
  assert.match(csv, /campaña/);
  assert.match(csv, /"Dice ""sí"", luego decide"/);
  assert.match(csv, /Presupuesto/);
});

test("creates JSON export and tolerates empty input", () => {
  const exported = createLeadExport({ conversations: [], format: "json" });
  assert.equal(exported.extension, "json");
  assert.deepEqual(JSON.parse(exported.body).leads, []);
  assert.throws(() => createLeadExport({ format: "xml" }), /lead_export_format_invalid/);
});
