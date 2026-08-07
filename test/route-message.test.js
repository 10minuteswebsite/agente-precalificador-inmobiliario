import test from "node:test";
import assert from "node:assert/strict";
import { routeMessage } from "../src/domain/routing/route-message.js";

const campaigns = [
  { id: "camp-a", code: "4F7K", message: "Casa frente al mar", agent_id: "agent-a" },
  { id: "camp-b", code: "9P2M", message: "Apartamento", agent_id: "agent-b" },
];

test("routes to the campaign agent and continues its conversation", () => {
  const result = routeMessage(
    { sender_phone: "10000000000", text: "Necesito info — 4F7K" },
    campaigns,
    [{ id: "conv-a", sender_phone: "10000000000", campaign_id: "camp-a" }],
  );
  assert.deepEqual(result, {
    status: "routed", method: "code", campaign_id: "camp-a", agent_id: "agent-a",
    conversation_id: "conv-a", conversation_action: "continue", campaign_identifier: "4F7K",
  });
});

test("starts a new conversation for a new campaign", () => {
  const result = routeMessage({ sender_phone: "10000000000", text: "Apartamento — 9P2M" }, campaigns, []);
  assert.equal(result.conversation_action, "start");
  assert.equal(result.agent_id, "agent-b");
});

test("sends unresolved messages to manual review", () => {
  const result = routeMessage({ sender_phone: "10000000000", text: "Hola" }, campaigns);
  assert.deepEqual(result, { status: "manual_review", reason: "campaign_not_resolved", sender_phone: "10000000000" });
});

test("continues the only existing conversation from a natural message", () => {
  const result = routeMessage(
    { sender_phone: "10000000000", text: "¿Y tiene estacionamiento?" },
    campaigns,
    [{ id: "conv-a", sender_phone: "10000000000", campaign_id: "camp-a" }],
  );
  assert.equal(result.status, "routed");
  assert.equal(result.method, "existing_conversation");
  assert.equal(result.conversation_id, "conv-a");
});

test("does not guess when the phone has multiple campaign conversations", () => {
  const result = routeMessage(
    { sender_phone: "10000000000", text: "Quiero continuar" },
    campaigns,
    [
      { id: "conv-a", sender_phone: "10000000000", campaign_id: "camp-a" },
      { id: "conv-b", sender_phone: "10000000000", campaign_id: "camp-b" },
    ],
  );
  assert.equal(result.status, "manual_review");
});

test("continues the most recent campaign when older history also exists", () => {
  const result = routeMessage(
    { sender_phone: "10000000000", text: "¿Cuál es el horario?" },
    campaigns,
    [
      { id: "conv-a", sender_phone: "10000000000", campaign_id: "camp-a", created_at: "2026-08-04T13:00:00.000Z" },
      { id: "conv-b", sender_phone: "10000000000", campaign_id: "camp-b", created_at: "2026-08-04T14:00:00.000Z" },
    ],
  );
  assert.equal(result.status, "routed");
  assert.equal(result.conversation_id, "conv-b");
  assert.equal(result.campaign_id, "camp-b");
});
