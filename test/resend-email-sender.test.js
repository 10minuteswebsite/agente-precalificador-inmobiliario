import test from "node:test";
import assert from "node:assert/strict";
import { createResendEmailSender } from "../src/adapters/notifications/resend-email-sender.js";

test("sends a text report through Resend with provider idempotency", async () => {
  let call;
  const sender = createResendEmailSender({ apiKey: "synthetic", from: "Reports <reports@example.test>", fetchImpl: async (...args) => { call = args; return { ok: true, async json() { return { id: "email-1" }; } }; } });
  const result = await sender.send({ to: ["realtor@example.test"], subject: "Informe", text: "Contenido", idempotency_key: "daily-report:a1:2026-08-01" });
  assert.equal(result.id, "email-1");
  assert.equal(call[0], "https://api.resend.com/emails");
  assert.equal(call[1].headers["idempotency-key"], "daily-report:a1:2026-08-01");
  assert.deepEqual(JSON.parse(call[1].body), { from: "Reports <reports@example.test>", to: ["realtor@example.test"], subject: "Informe", text: "Contenido" });
  assert.equal(call[1].body.includes("synthetic"), false);
});

test("requires both provider key and approved sender", () => {
  assert.throws(() => createResendEmailSender({ apiKey: "x" }), /email_sender_not_configured/);
});

