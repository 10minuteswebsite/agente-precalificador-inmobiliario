import test from "node:test";
import assert from "node:assert/strict";
import { routeMessageWithFallback } from "../src/application/route-message-with-fallback.js";

test("uses semantic fallback only above the confidence threshold", async () => {
  const campaigns = [{ id: "a", code: "AAAA", message: "Casa", agent_id: "agent-a" }];
  const input = { sender_phone: "+1", text: "Busco una propiedad" };
  const routed = await routeMessageWithFallback(input, campaigns, [], { resolve: async () => ({ campaign_id: "a", confidence: 0.9 }) });
  const review = await routeMessageWithFallback(input, campaigns, [], { resolve: async () => ({ campaign_id: "a", confidence: 0.7 }) });
  assert.equal(routed.method, "semantic");
  assert.equal(review.status, "manual_review");
  const failed = await routeMessageWithFallback(input, campaigns, [], { resolve: async () => { throw new Error("offline"); } });
  assert.equal(failed.status, "manual_review");
});
