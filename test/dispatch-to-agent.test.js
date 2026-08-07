import test from "node:test";
import assert from "node:assert/strict";
import { dispatchToAgent } from "../src/application/dispatch-to-agent.js";

test("dispatches routed messages to the assigned agent", async () => {
  const calls = [];
  const result = await dispatchToAgent(
    { status: "routed", agent_id: "agent-1", campaign_id: "camp-1", conversation_id: "conv-1" },
    { text: "Hola" },
    { agentRunner: { respond: async (input) => { calls.push(input); return "respuesta"; } } },
  );
  assert.equal(result.status, "dispatched");
  assert.equal(calls[0].agent_id, "agent-1");
  assert.equal(result.response, "respuesta");
});

test("does not dispatch unresolved messages", async () => {
  const result = await dispatchToAgent({ status: "manual_review", reason: "campaign_not_resolved" }, {}, { agentRunner: null });
  assert.deepEqual(result, { status: "not_dispatched", reason: "campaign_not_resolved" });
});
