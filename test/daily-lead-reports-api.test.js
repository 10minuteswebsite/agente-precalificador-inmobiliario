import test from "node:test";
import assert from "node:assert/strict";
import dailyLeadReports from "../api/jobs/daily-lead-reports.js";

test("daily report job rejects requests without the protected cron secret", async () => {
  const previous = process.env.CRON_SECRET;
  process.env.CRON_SECRET = "synthetic-secret";
  const response = { statusCode: null, body: null, setHeader() {}, end(body) { this.body = JSON.parse(body); } };
  await dailyLeadReports({ method: "GET", headers: { authorization: "Bearer wrong" } }, response);
  assert.equal(response.statusCode, 401);
  assert.deepEqual(response.body, { error: "unauthorized" });
  if (previous === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = previous;
});
