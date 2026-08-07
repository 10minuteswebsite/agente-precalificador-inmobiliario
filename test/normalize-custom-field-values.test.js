import test from "node:test";
import assert from "node:assert/strict";
import { normalizeCustomFieldValues } from "../src/domain/leads/normalize-custom-field-values.js";

const fields = [
  { id: "profession", type: "text", options: [], consent_required: false },
  { id: "budget", type: "currency", options: [], consent_required: false },
  { id: "client_type", type: "choice", options: ["local", "international"], consent_required: false },
  { id: "salary", type: "currency", options: [], consent_required: true },
  { id: "email", type: "email", options: [], consent_required: false },
  { id: "phone", type: "phone", options: [], consent_required: false },
];

test("normalizes explicit custom lead values and preserves previous values", () => {
  const result = normalizeCustomFieldValues({ fields, previous: { profession: { value: "Docente", confidence: 1 } }, values: [
    { field_id: "budget", value: 250000, confidence: 0.9, consent_given: false },
    { field_id: "client_type", value: "local", confidence: 1, consent_given: false },
  ] });
  assert.equal(result.profession.value, "Docente");
  assert.equal(result.budget.value, 250000);
  assert.equal(result.client_type.value, "local");
});

test("stores email and phone values as text", () => {
  const result = normalizeCustomFieldValues({ fields, values: [
    { field_id: "email", value: "lead@example.com", confidence: 1 },
    { field_id: "phone", value: "+1 305 555 0199", confidence: 1 },
  ] });
  assert.equal(result.email.value, "lead@example.com");
  assert.equal(result.phone.value, "+1 305 555 0199");
});

test("requires consent before storing sensitive custom values", () => {
  assert.throws(() => normalizeCustomFieldValues({ fields, values: [{ field_id: "salary", value: 80000, confidence: 1, consent_given: false }] }), /consent_required/);
});

test("rejects values outside a configured choice list", () => {
  assert.throws(() => normalizeCustomFieldValues({ fields, values: [{ field_id: "client_type", value: "unknown", confidence: 1, consent_given: false }] }), /choice_invalid/);
});
