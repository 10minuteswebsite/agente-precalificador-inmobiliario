import test from "node:test";
import assert from "node:assert/strict";
import { normalizeStoredCustomFieldValues } from "../src/domain/leads/normalize-stored-custom-field-values.js";

test("normalizes dashboard edits without exposing arbitrary fields", () => {
  const result = normalizeStoredCustomFieldValues({ profession: { label: "Profesión", value: "Arquitecta", confidence: 1.5, consent_given: true } });
  assert.deepEqual(result.profession, { label: "Profesión", value: "Arquitecta", confidence: 1, consent_given: true });
});

test("rejects invalid custom field values", () => {
  assert.throws(() => normalizeStoredCustomFieldValues({ "bad id": { value: "x" } }), /custom_field_values_invalid/);
  assert.throws(() => normalizeStoredCustomFieldValues({ age: { value: { nested: true } } }), /custom_field_value_invalid/);
});
