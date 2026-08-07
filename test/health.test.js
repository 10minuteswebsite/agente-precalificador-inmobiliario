import test from "node:test";
import assert from "node:assert/strict";
import health from "../api/health.js";

test("health reports service without exposing secrets", () => {
  const result = { headers: {}, body: "" };
  health({}, {
    setHeader(name, value) { result.headers[name] = value; },
    end(body) { result.body = body; },
  });
  assert.equal(JSON.parse(result.body).ok, true);
  assert.equal(JSON.parse(result.body).service, "agente-enrutador");
  assert.equal(typeof JSON.parse(result.body).agent_builder, "boolean");
  assert.equal(typeof JSON.parse(result.body).daily_email_reports, "boolean");
  assert.equal(result.body.includes("SERVICE_ROLE"), false);
});
