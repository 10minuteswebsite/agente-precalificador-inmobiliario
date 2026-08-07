import test from "node:test";
import assert from "node:assert/strict";
import { createMetaWhatsAppTemplateSender } from "../src/adapters/meta/send-whatsapp-template.js";

test("sends an approved WhatsApp template without exposing credentials to the payload", async () => {
  let request;
  const sender = createMetaWhatsAppTemplateSender({ accessToken: "secret", phoneNumberId: "123", fetchImpl: async (url, init) => {
    request = { url, init };
    return { ok: true, json: async () => ({ messages: [{ id: "wamid.1" }] }) };
  } });
  const result = await sender.sendTemplate({ to: "15551234567", name: "booking_reminder_24h", language: "es", parameters: ["Consulta", "mañana 10:00"] });
  assert.equal(result.id, "wamid.1");
  const body = JSON.parse(request.init.body);
  assert.equal(body.template.name, "booking_reminder_24h");
  assert.equal(body.template.components[0].parameters[1].text, "mañana 10:00");
  assert.equal(body.template.language.code, "es");
  assert.equal(body.template.parameters, undefined);
  assert.equal(request.init.headers.Authorization, "Bearer secret");
});
