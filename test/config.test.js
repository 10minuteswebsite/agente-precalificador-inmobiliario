import test from "node:test";
import assert from "node:assert/strict";
import config from "../api/config.js";

test("config exposes only safe feature readiness flags", () => {
  const result = { body: "" };
  config({}, { setHeader() {}, end(body) { result.body = body; } });
  const body = JSON.parse(result.body);
  assert.equal(typeof body.features.outboundMessaging, "boolean");
  assert.equal(typeof body.features.agentBuilder, "boolean");
  assert.equal(typeof body.features.dailyEmailReports, "boolean");
  assert.equal(result.body.includes("ACCESS_TOKEN"), false);
});
