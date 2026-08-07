import test from "node:test";
import assert from "node:assert/strict";
import { normalizeCustomFields } from "../src/domain/leads/normalize-custom-fields.js";

test("normalizes a small set of client-defined lead fields", () => {
  const fields = normalizeCustomFields([{ id: "Profession", label: "Profesión", type: "text", purpose: "Entender el contexto del lead" }]);
  assert.deepEqual(fields[0], { id: "profession", label: "Profesión", type: "text", purpose: "Entender el contexto del lead", sensitivity: "standard", ask_policy: "relevant", consent_required: false });
});

test("requires explicit consent for sensitive custom fields", () => {
  assert.throws(() => normalizeCustomFields([{ id: "salary", label: "Salario", type: "currency", purpose: "Evaluar capacidad", sensitivity: "sensitive" }]), /sensitive_consent_required/);
  const [field] = normalizeCustomFields([{ id: "salary", label: "Salario", type: "currency", purpose: "Evaluar capacidad", sensitivity: "sensitive", consent_required: true }]);
  assert.equal(field.consent_required, true);
});

test("validates choice options and prevents duplicate field ids", () => {
  assert.throws(() => normalizeCustomFields([{ id: "stage", label: "Etapa", type: "choice", purpose: "Clasificar", options: ["A", "a"] }]), /options_must_be_unique/);
  assert.throws(() => normalizeCustomFields([{ id: "x", label: "X", type: "text", purpose: "Uno" }, { id: "x", label: "X2", type: "text", purpose: "Dos" }]), /ids_must_be_unique/);
});

test("accepts contact, scheduling and link capture types", () => {
  const fields = normalizeCustomFields([
    { id: "email", label: "Correo", type: "email", purpose: "Enviar confirmación" },
    { id: "phone", label: "Teléfono", type: "phone", purpose: "Contactar al lead" },
    { id: "date", label: "Fecha", type: "date", purpose: "Agendar" },
    { id: "time", label: "Fecha y hora", type: "datetime", purpose: "Agendar" },
    { id: "website", label: "Sitio web", type: "url", purpose: "Consultar referencia" },
  ]);
  assert.deepEqual(fields.map((field) => field.type), ["email", "phone", "date", "datetime", "url"]);
});

test("does not require a client-written purpose", () => {
  const [field] = normalizeCustomFields([{ id: "email", label: "Correo electrónico", type: "email" }]);
  assert.equal(field.purpose, "");
});
