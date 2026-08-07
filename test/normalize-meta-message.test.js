import test from "node:test";
import assert from "node:assert/strict";
import { normalizeMetaMessage } from "../src/adapters/meta/normalize-meta-message.js";

const receivedAt = new Date("2026-01-01T12:00:00.000Z");

test("normalizes a text message and preserves idempotency data", () => {
  const result = normalizeMetaMessage({
    entry: [{ changes: [{ value: {
      contacts: [{ profile: { name: "Ana Pérez" } }],
      messages: [{ id: "wamid.synthetic.1", from: "10000000000", type: "text", text: { body: "Hola — 4F7K" } }],
    } }] }],
  }, receivedAt);

  assert.deepEqual(result, {
    event_id: "wamid.synthetic.1",
    schema_version: 1,
    occurred_at: "2026-01-01T12:00:00.000Z",
    tenant_id: "shared_whatsapp",
    correlation_id: "wamid.synthetic.1",
    idempotency_key: "meta:wamid.synthetic.1",
    channel: "whatsapp",
    recipient_phone_number_id: null,
    sender_phone: "10000000000",
    sender_name: "Ana Pérez",
    message: { id: "wamid.synthetic.1", kind: "text", text: "Hola — 4F7K" },
  });
});

test("accepts voice, image, and document without analyzing them", () => {
  for (const [type, key] of [["audio", "audio"], ["image", "image"], ["document", "document"]]) {
    const result = normalizeMetaMessage({ entry: [{ changes: [{ value: {
      messages: [{ id: `wamid.${type}`, from: "10000000000", type, [key]: { id: `media.${type}` } }],
    } }] }] }, receivedAt);
    assert.equal(result.message.kind, type === "audio" ? "voice" : type);
    assert.equal(result.message.media_id, `media.${type}`);
  }
});

test("rejects a webhook without a message", () => {
  assert.throws(() => normalizeMetaMessage({ entry: [] }, receivedAt), /meta_webhook_missing_message/);
});
