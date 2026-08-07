import test from "node:test";
import assert from "node:assert/strict";
import { runDailyLeadReports } from "../src/application/run-daily-lead-reports.js";

function agent(overrides = {}) {
  return { id: "agent-1", tenant_id: "tenant-1", name: "Precalificador", configuration: { reporting: { recipients: ["realtor@example.test"], timezone: "America/New_York", local_time: "08:00", skip_empty: true } }, ...overrides };
}

function repository({ conversations = [{}], existing = null } = {}) {
  const calls = [];
  return {
    calls,
    async listPrequalifierAgents() { return [agent()]; },
    async findReport() { return existing; },
    async findLatestCompletedReport() { return null; },
    async claimReport(input) { calls.push(["claim", input]); return { id: "report-1" }; },
    async listLeadConversations() { return conversations; },
    async completeReport(id, changes) { calls.push(["complete", id, changes]); },
    async failReport(id, message) { calls.push(["fail", id, message]); },
  };
}

test("sends one due daily report with an idempotency key", async () => {
  const repo = repository({ conversations: [{ leads: { first_name: "Ana", phone: "+1" }, qualification_state: { assessment: { status: "collecting", urgency: "medium", reasons: [], limitations: [] } } }] });
  const deliveries = [];
  const result = await runDailyLeadReports({ repository: repo, emailSender: { send: async (payload) => { deliveries.push(payload); return { id: "email-1" }; } }, now: new Date("2026-08-01T12:00:00Z") });
  assert.equal(result[0].status, "sent");
  assert.equal(deliveries[0].idempotency_key, "daily-report:agent-1:2026-08-01");
  assert.equal(repo.calls.at(-1)[2].provider_message_id, "email-1");
});

test("skips an empty report and does not call the email provider", async () => {
  const repo = repository({ conversations: [] });
  let sent = false;
  const result = await runDailyLeadReports({ repository: repo, emailSender: { send: async () => { sent = true; } }, now: new Date("2026-08-01T12:00:00Z") });
  assert.equal(result[0].status, "skipped");
  assert.equal(sent, false);
});

test("does not duplicate a report already handled", async () => {
  const repo = repository({ existing: { status: "sent" } });
  const result = await runDailyLeadReports({ repository: repo, emailSender: { send: async () => { throw new Error("must not send"); } }, now: new Date("2026-08-01T12:00:00Z") });
  assert.equal(result[0].status, "already_handled");
  assert.equal(repo.calls.length, 0);
});

test("records provider failure for a safe later retry", async () => {
  const repo = repository();
  const result = await runDailyLeadReports({ repository: repo, emailSender: { send: async () => { throw new Error("provider_down"); } }, now: new Date("2026-08-01T12:00:00Z") });
  assert.equal(result[0].status, "failed");
  assert.equal(repo.calls.at(-1)[0], "fail");
});

test("retries a report previously marked as failed", async () => {
  const repo = repository({ existing: { id: "report-1", status: "failed" } });
  let receivedExisting;
  repo.claimReport = async (input, existing) => { receivedExisting = existing; return { id: "report-1" }; };
  const result = await runDailyLeadReports({ repository: repo, emailSender: { send: async () => ({ id: "email-retry" }) }, now: new Date("2026-08-01T12:00:00Z") });
  assert.equal(receivedExisting.status, "failed");
  assert.equal(result[0].status, "sent");
});
