import test from "node:test";
import assert from "node:assert/strict";
import { createAgentBuilderHandler } from "../api/agent-builder.js";

function responseDouble() {
  return { statusCode: null, body: null, setHeader() {}, end(body) { this.body = JSON.parse(body); } };
}

function membershipClient(membership) {
  const query = { select() { return this; }, eq() { return this; }, async maybeSingle() { return { data: membership, error: null }; } };
  return { from(table) { assert.equal(table, "tenant_members"); return query; } };
}

test("agent builder requires membership in the requested organization", async () => {
  const handler = createAgentBuilderHandler({
    createClient: () => membershipClient(null),
    requireAuthenticated: async () => ({ id: "user-1" }),
    createBuilder: () => async () => ({ status: "needs_input", message: "unused" }),
    env: { AGENT_BUILDER_URL: "https://builder.example.test" },
  });
  const response = responseDouble();
  await handler({ method: "POST", body: { tenant_id: "tenant-2", message: "Hola" } }, response);
  assert.equal(response.statusCode, 403);
  assert.equal(response.body.error, "tenant_access_denied");
});

test("agent builder returns the next safe conversational question", async () => {
  let builderOptions;
  const handler = createAgentBuilderHandler({
    createClient: () => membershipClient({ tenant_id: "tenant-1" }),
    requireAuthenticated: async () => ({ id: "user-1" }),
    createBuilder: (options) => { builderOptions = options; return async () => ({ status: "needs_input", message: "¿Qué zonas atiendes?" }); },
    env: { AGENT_BUILDER_URL: "https://builder.example.test", AGENT_BUILDER_TOKEN: "synthetic" },
  });
  const response = responseDouble();
  await handler({ method: "POST", body: { tenant_id: "tenant-1", message: "Trabajo con compradores" } }, response);
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.message, "¿Qué zonas atiendes?");
  assert.equal(builderOptions.endpoint, "https://builder.example.test");
});

test("agent builder reports unavailable configuration without exposing credentials", async () => {
  const handler = createAgentBuilderHandler({
    createClient: () => membershipClient({ tenant_id: "tenant-1" }),
    requireAuthenticated: async () => ({ id: "user-1" }),
    createBuilder: () => { throw new Error("agent_builder_not_configured"); },
    env: {},
  });
  const response = responseDouble();
  await handler({ method: "POST", body: { tenant_id: "tenant-1", message: "Hola" } }, response);
  assert.equal(response.statusCode, 503);
  assert.deepEqual(response.body, { error: "agent_builder_not_configured" });
});
