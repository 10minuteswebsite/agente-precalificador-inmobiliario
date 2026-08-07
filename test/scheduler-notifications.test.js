import test from "node:test";
import assert from "node:assert/strict";
import { createSchedulerNotificationWorker } from "../src/application/run-scheduler-notifications.js";

test("claims and delivers a neutral scheduler notification idempotently", async () => {
  const calls = [];
  const repository = {
    async claimDue() { return [{ id: "n1", event_type: "booking.confirmed", audience: "lead", payload: { service_name: "Demo", starts_at: "2026-08-07T14:00:00Z", lead: { first_name: "Ana", phone: "+10000000000" } } }]; },
    async markSent(id, changes) { calls.push(["sent", id, changes.provider_message_id]); },
    async markFailed() { throw new Error("unexpected_failure"); },
  };
  const sender = { async sendTemplate(input) { calls.push(["send", input.to, input.name, input.parameters]); return { id: "wamid.1" }; } };
  const worker = createSchedulerNotificationWorker({ repository, templateSender: sender, templates: { "booking.confirmed": "agendador_booking_confirmed_v1" }, now: () => new Date("2026-08-06T00:00:00Z") });
  assert.deepEqual(await worker.run(), [{ id: "n1", status: "sent" }]);
  assert.deepEqual(calls, [["send", "+10000000000", "agendador_booking_confirmed_v1", ["Ana", "Demo", "2026-08-07T14:00:00Z", ""]], ["sent", "n1", "wamid.1"]]);
});

test("marks a notification failed when its template is not configured", async () => {
  let failure;
  const repository = { async claimDue() { return [{ id: "n2", event_type: "booking.cancelled", audience: "lead", payload: { lead: { phone: "+1" } } }]; }, async markSent() {}, async markFailed(id, message) { failure = [id, message]; } };
  const worker = createSchedulerNotificationWorker({ repository, templateSender: { sendTemplate() {} }, templates: {} });
  assert.deepEqual(await worker.run(), [{ id: "n2", status: "failed", error: "scheduler_template_not_configured" }]);
  assert.deepEqual(failure, ["n2", "scheduler_template_not_configured"]);
});

test("sends the lead a separate email with the management link", async () => {
  let email;
  const repository = { async claimDue() { return [{ id: "n3", event_type: "booking.confirmed", audience: "lead", payload: { service_name: "Demo", starts_at: "2026-08-07T14:00:00Z", management_url: "https://agente-agendador.vercel.app/manage?token=x", lead: { first_name: "Ana", phone: "+1", email: "ana@example.test" } } }]; }, async markSent() {}, async markFailed() {} };
  const worker = createSchedulerNotificationWorker({ repository, templateSender: { async sendTemplate() { return { id: "w1" }; } }, emailSender: { async send(payload) { email = payload; } }, templates: { "booking.confirmed": "confirmed" } });
  await worker.run();
  assert.equal(email.to, "ana@example.test");
  assert.match(email.text, /cambiar o cancelar/);
  assert.match(email.text, /manage\?token=x/);
});
