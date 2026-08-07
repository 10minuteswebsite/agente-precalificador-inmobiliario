import test from "node:test";
import assert from "node:assert/strict";
import { resolveCampaign } from "../src/domain/routing/resolve-campaign.js";

const campaigns = [
  { id: "camp-a", code: "4F7K", message: "Quiero información de la casa frente al mar" },
  { id: "camp-b", code: "9P2M", message: "Quiero información del apartamento" },
];

test("resolves by generated code first", () => {
  const result = resolveCampaign("Quiero otra cosa — 4f7k", campaigns);
  assert.equal(result.method, "code");
  assert.equal(result.campaign.id, "camp-a");
});

test("archived campaigns still resolve known links", () => {
  const result = resolveCampaign("Casa frente al mar — 4F7K", [
    { id: "camp-archived", code: "4F7K", message: "Casa frente al mar", status: "archived" },
  ]);
  assert.equal(result.status, "resolved");
  assert.equal(result.campaign.id, "camp-archived");
});

test("resolves an exact prefilled message", () => {
  const result = resolveCampaign("  QUIERO información del apartamento ", campaigns);
  assert.equal(result.method, "exact_message");
  assert.equal(result.campaign.id, "camp-b");
});

test("sends unknown messages to manual review", () => {
  assert.deepEqual(resolveCampaign("Hola, necesito ayuda", campaigns), {
    status: "manual_review", reason: "campaign_not_resolved",
  });
});
