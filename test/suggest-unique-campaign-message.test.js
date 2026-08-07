import test from "node:test";
import assert from "node:assert/strict";
import { normalizeCampaignMessage, suggestUniqueCampaignMessage } from "../src/application/suggest-unique-campaign-message.js";

test("normalizes campaign messages for duplicate detection", () => {
  assert.equal(normalizeCampaignMessage("  Quiero   información "), "quiero información");
});

test("suggests an unused conversational campaign message", () => {
  const suggestion = suggestUniqueCampaignMessage("Quiero información sobre el taller de constelaciones familiares", ["quiero información sobre el taller de constelaciones familiares"], () => 0);
  assert.equal(suggestion, "Quiero información sobre el taller de constelaciones familiares y conocer las opciones disponibles");
  assert.notEqual(suggestion, "Quiero información sobre el taller de constelaciones familiares");
});

test("uses campaign context when the original message is generic", () => {
  const suggestion = suggestUniqueCampaignMessage("Quiero más información", ["quiero más información"], () => 0, "Taller de constelaciones familiares");
  assert.equal(suggestion, "Quiero información sobre Taller de constelaciones familiares");
});

test("combines the original intent with useful campaign details", () => {
  const suggestion = suggestUniqueCampaignMessage(
    "Quiero información sobre el taller de constelaciones familiares",
    ["quiero información sobre el taller de constelaciones familiares"],
    () => 0,
    "Vender entradas para el taller en Atlanta del 30 de octubre",
  );
  assert.equal(suggestion, "Quiero información sobre el taller de constelaciones familiares en Atlanta del 30 de octubre");
});
