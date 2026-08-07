import test from "node:test";
import assert from "node:assert/strict";
import { generateCampaignCode } from "../src/application/generate-campaign-code.js";

test("generates a four-character campaign identifier", () => {
  const code = generateCampaignCode(() => 0);
  assert.equal(code, "AAAA");
  assert.match(code, /^[A-Z0-9]{4}$/);
});
