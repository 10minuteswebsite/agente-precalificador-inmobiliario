import test from "node:test";
import assert from "node:assert/strict";
import { deriveLeadInsight, mergeLeadSummary } from "../src/domain/conversations/derive-lead-insight.js";

test("derives multiple explicit intents without inventing facts", () => {
  const result = deriveLeadInsight({ text: "¿Cuándo es el taller, dónde se realiza y cuánto cuesta?" });
  assert.deepEqual(result.intent.labels, ["Consultar precio", "Consultar fecha u horario", "Consultar ubicación"]);
  assert.match(result.summary, /ha ido explorando sus detalles/);
  assert.doesNotMatch(result.summary, /Cuándo es el taller/);
  assert.match(result.summary, /cuál es el precio/);
});

test("uses a neutral information intent for an unclassified message", () => {
  const result = deriveLeadInsight({ text: "Quiero conocer más" });
  assert.deepEqual(result.intent.labels, ["Solicitar información"]);
});

test("appends the next observed message without exceeding the summary bound", () => {
  const result = mergeLeadSummary({ previousSummary: "Busca una casa frente al mar.", text: "¿Hay disponibilidad?" });
  assert.match(result, /Busca una casa frente al mar/);
  assert.match(result, /Busca una casa frente al mar/);
  assert.doesNotMatch(result, /¿Hay disponibilidad/);
});

test("turns reservation intent into a next-step narrative", () => {
  const result = deriveLeadInsight({ text: "Quiero reservar mi lugar" });
  assert.match(result.summary, /intención de reservar/);
});

test("includes campaign context without copying the observed text", () => {
  const result = deriveLeadInsight({ text: "Quiero información", campaignContext: "Taller de constelaciones" });
  assert.match(result.summary, /Taller de constelaciones/);
  assert.doesNotMatch(result.summary, /Quiero información/);
});
