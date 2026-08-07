import test from "node:test";
import assert from "node:assert/strict";
import { createHttpEmailSender } from "../src/adapters/notifications/http-email-sender.js";

test("email sender keeps provider details behind an HTTP adapter", async () => {
  let call;
  const sender = createHttpEmailSender({ endpoint: "https://email.example.test/send", token: "synthetic", fetchImpl: async (...args) => { call = args; return { ok: true, json: async () => ({ id: "email-1" }) }; } });
  const result = await sender.send({ to: ["realtor@example.test"], subject: "Informe", text: "Contenido" });
  assert.equal(result.id, "email-1");
  assert.equal(call[1].headers.authorization, "Bearer synthetic");
  assert.equal(call[1].signal instanceof AbortSignal, true);
});
