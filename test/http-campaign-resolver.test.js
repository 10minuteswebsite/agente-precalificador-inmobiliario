import test from "node:test";
import assert from "node:assert/strict";
import { createHttpCampaignResolver } from "../src/adapters/ai/http-campaign-resolver.js";

test("campaign resolver stays behind an HTTP adapter", async () => {
  let body;
  const resolver = createHttpCampaignResolver({ endpoint: "https://internal.example/resolve", fetchImpl: async (_url, options) => { body = JSON.parse(options.body); return { ok: true, json: async () => ({ campaign_id: "a", confidence: 0.9 }) }; } });
  assert.deepEqual(await resolver.resolve({ text: "Hola" }), { campaign_id: "a", confidence: 0.9 });
  assert.equal(body.text, "Hola");
});
