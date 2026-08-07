import test from "node:test";
import assert from "node:assert/strict";
import { createMetaWhatsAppSender } from "../src/adapters/meta/send-whatsapp-text.js";

test("Meta sender posts a provider-neutral text message", async () => {
  const calls = [];
  const sender = createMetaWhatsAppSender({ accessToken: "secret", phoneNumberId: "123", fetchImpl: async (...args) => {
    calls.push(args);
    return { ok: true, json: async () => ({ messages: [{ id: "wamid.sent" }] }) };
  } });
  const result = await sender.sendText({ to: "+13214503999", text: "Hola" });
  assert.equal(result.id, "wamid.sent");
  assert.equal(calls[0][0], "https://graph.facebook.com/v23.0/123/messages");
  assert.deepEqual(JSON.parse(calls[0][1].body).text, { preview_url: false, body: "Hola" });
});
