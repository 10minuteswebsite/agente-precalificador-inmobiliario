import test from "node:test";
import assert from "node:assert/strict";
import { hasMessageForPhoneNumber, scopeMetaPayloadToPhoneNumber } from "../src/adapters/meta/scope-meta-webhook.js";

const message = (id) => ({ id, from: "10000000000", type: "text", text: { body: "Hola" } });

test("scopes webhook changes to the configured WhatsApp phone number", () => {
  const payload = { entry: [{ changes: [
    { value: { metadata: { phone_number_id: "other-phone" }, messages: [message("other")] } },
    { value: { metadata: { phone_number_id: "shared-phone" }, messages: [message("shared")] } },
  ] }] };
  assert.equal(hasMessageForPhoneNumber(payload, "shared-phone"), true);
  assert.deepEqual(scopeMetaPayloadToPhoneNumber(payload, "shared-phone").entry[0].changes[0].value.metadata, { phone_number_id: "shared-phone" });
  assert.equal(scopeMetaPayloadToPhoneNumber(payload, "shared-phone").entry[0].changes[0].value.messages[0].id, "shared");
});

test("does not treat another phone number as a message for the shared number", () => {
  const payload = { entry: [{ changes: [{ value: { metadata: { phone_number_id: "other-phone" }, messages: [message("other")] } }] }] };
  assert.equal(hasMessageForPhoneNumber(payload, "shared-phone"), false);
  assert.deepEqual(scopeMetaPayloadToPhoneNumber(payload, "shared-phone").entry, []);
});
