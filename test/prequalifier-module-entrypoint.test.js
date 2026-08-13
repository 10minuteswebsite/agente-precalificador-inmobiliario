import test from "node:test";
import assert from "node:assert/strict";
import { createPrequalifierModule, manifest, ROUTER_INTEGRATION_V1 } from "../src/prequalifier/index.js";

test("exposes a stable public facade", () => {
  const module = createPrequalifierModule({ generator: async () => ({}) });
  assert.deepEqual(Object.keys(module).sort(), ["integration", "manifest", "qualifyTurn"]);
  assert.equal(module.manifest, manifest);
  assert.equal(module.integration, ROUTER_INTEGRATION_V1);
  assert.equal(typeof module.qualifyTurn, "function");
  assert.equal(Object.isFrozen(module), true);
});

test("publishes only the facade and manifest package exports", async () => {
  const packageJson = await import("node:fs/promises").then(({ readFile }) => readFile(new URL("../package.json", import.meta.url), "utf8")).then(JSON.parse);
  assert.deepEqual(packageJson.exports, { ".": "./src/prequalifier/index.js", "./manifest": "./module-manifest.json" });
});

test("is prepared for public package publication without bundling operational data", async () => {
  const packageJson = await import("node:fs/promises").then(({ readFile }) => readFile(new URL("../package.json", import.meta.url), "utf8")).then(JSON.parse);
  assert.equal(packageJson.private, undefined);
  assert.equal(packageJson.publishConfig.access, "public");
  assert.ok(packageJson.files.includes("src/"));
  assert.ok(!packageJson.files.includes("data/"));
});

test("delegates qualification through Router v1", async () => {
  const module = createPrequalifierModule({ generator: async () => ({
    text: "¿Qué presupuesto manejas?",
    qualification_state: { schema_version: 1, active_profile_id: "buyer", answers: {}, missing_question_ids: ["budget"], assessment: { status: "collecting", urgency: "low", reasons: [], limitations: [] }, next_action: "continue_qualification" },
  }) });
  const result = await module.qualifyTurn({ schema_version: 1, tenant_id: "tenant-1", agent_id: "agent-1", campaign_id: "campaign-1", conversation_id: "conversation-1", idempotency_key: "qualification:conversation-1:1", agent_dna: { kind: "real_estate_prequalifier", common_questions: [], profiles: [{ id: "buyer", questions: [{ id: "budget" }], qualification: { criteria: [] } }] }, qualification_state: {}, custom_field_values: {}, lead: { first_name: "Ana", phone: "+10000000000" }, inbound: { text: "Busco comprar" } });
  assert.equal(result.text, "¿Qué presupuesto manejas?");
  assert.equal(result.events[0].tenant_id, "tenant-1");
});
