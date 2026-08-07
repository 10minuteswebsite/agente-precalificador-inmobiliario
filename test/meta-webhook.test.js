import test from "node:test";
import assert from "node:assert/strict";
import { handleIncomingMessage } from "../src/application/handle-incoming-message.js";
import metaWebhook from "../api/webhooks/meta.js";
import { createHmac } from "node:crypto";

function responseDouble() {
  return {
    statusCode: null,
    headers: {},
    body: null,
    setHeader(name, value) { this.headers[name] = value; },
    end(body = "") { this.body = body; },
  };
}

test("answers Meta webhook verification challenge", () => {
  process.env.META_WEBHOOK_VERIFY_TOKEN = "synthetic-token";
  const response = responseDouble();
  metaWebhook({ method: "GET", query: {
    "hub.mode": "subscribe", "hub.verify_token": "synthetic-token", "hub.challenge": "12345",
  } }, response);
  assert.equal(response.statusCode, 200);
  assert.equal(response.body, "12345");
});

test("accepts and acknowledges a normalized webhook", async () => {
  const response = responseDouble();
  await metaWebhook({ method: "POST", body: { entry: [{ changes: [{ value: {
    messages: [{ id: "wamid.synthetic.endpoint", from: "10000000000", type: "text", text: { body: "Hola — 4F7K" } }],
  } }] }] } }, response);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(JSON.parse(response.body), { accepted: true, event_id: "wamid.synthetic.endpoint" });
});

test("allows the application processor to be injected", () => {
  let received;
  const result = handleIncomingMessage({ entry: [{ changes: [{ value: {
    messages: [{ id: "wamid.synthetic.processor", from: "10000000000", type: "text", text: { body: "Hola" } }],
  } }] }] }, { process: (message) => { received = message; return "queued"; } });
  assert.equal(result.processing, "queued");
  assert.equal(received.event_id, result.normalized.event_id);
});

test("acknowledges non-message Meta webhook events without processing", async () => {
  const response = responseDouble();
  await metaWebhook({ method: "POST", body: { entry: [{ changes: [{ value: { statuses: [{ id: "status-1", status: "sent" }] } }] }] } }, response);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(JSON.parse(response.body), { accepted: true, processing: "ignored_non_message_event" });
});

test("ignores messages addressed to another WhatsApp phone number", async () => {
  process.env.META_PHONE_NUMBER_ID = "shared-phone";
  const response = responseDouble();
  await metaWebhook({ method: "POST", body: { entry: [{ changes: [{ value: {
    metadata: { phone_number_id: "other-phone" },
    messages: [{ id: "wamid.other.phone", from: "12393635351", type: "text", text: { body: "Mensaje del otro número" } }],
  } }] }] } }, response);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(JSON.parse(response.body), { accepted: true, processing: "ignored_other_phone_number" });
  delete process.env.META_PHONE_NUMBER_ID;
});

test("rejects an invalid verification token", () => {
  process.env.META_WEBHOOK_VERIFY_TOKEN = "synthetic-token";
  const response = responseDouble();
  metaWebhook({ method: "GET", query: { "hub.mode": "subscribe", "hub.verify_token": "wrong" } }, response);
  assert.equal(response.statusCode, 403);
});

test("rejects a POST with an invalid Meta signature", async () => {
  process.env.META_APP_SECRET = "synthetic-secret";
  const body = { entry: [] };
  const response = responseDouble();
  await metaWebhook({ method: "POST", body, headers: { "x-hub-signature-256": "sha256=wrong" } }, response);
  assert.equal(response.statusCode, 401);
  delete process.env.META_APP_SECRET;
});

test("audits invalid Meta signatures without exposing payload contents", async () => {
  process.env.META_APP_SECRET = "synthetic-secret";
  const originalWarn = console.warn;
  let auditLine;
  console.warn = (line) => { auditLine = line; };
  try {
    const body = { entry: [{ changes: [{ value: { messages: [{ id: "private-message-id", from: "13057780990", type: "text", text: { body: "Mensaje privado" } }] } }] }] };
    const response = responseDouble();
    await metaWebhook({ method: "POST", body, headers: { "x-hub-signature-256": "sha256=wrong" } }, response);
    assert.equal(response.statusCode, 401);
    const audit = JSON.parse(auditLine);
    assert.equal(audit.event, "meta_webhook_signature_rejected");
    assert.equal(audit.reason, "signature_mismatch");
    assert.equal(audit.has_signature_header, true);
    assert.equal(typeof audit.body_hash, "string");
    assert.ok(!auditLine.includes("Mensaje privado"));
    assert.ok(!auditLine.includes("13057780990"));
    assert.ok(!auditLine.includes("synthetic-secret"));
  } finally {
    console.warn = originalWarn;
    delete process.env.META_APP_SECRET;
  }
});

test("accepts a POST with a valid Meta signature", async () => {
  process.env.META_APP_SECRET = "synthetic-secret";
  const body = { entry: [{ changes: [{ value: { messages: [{ id: "signed-message", from: "10000000000", type: "text", text: { body: "Hola" } }] } }] }] };
  const signature = `sha256=${createHmac("sha256", process.env.META_APP_SECRET).update(JSON.stringify(body)).digest("hex")}`;
  const response = responseDouble();
  await metaWebhook({ method: "POST", body, headers: { "x-hub-signature-256": signature } }, response);
  assert.equal(response.statusCode, 200);
  delete process.env.META_APP_SECRET;
});

test("verifies the original bytes when Vercel provides a Buffer body", async () => {
  process.env.META_APP_SECRET = "synthetic-secret";
  const payload = { entry: [{ changes: [{ value: { messages: [{ id: "buffer-message", from: "10000000000", type: "text", text: { body: "Hola" } }] } }] }] };
  const body = Buffer.from(JSON.stringify(payload));
  const signature = `sha256=${createHmac("sha256", process.env.META_APP_SECRET).update(body).digest("hex")}`;
  const response = responseDouble();
  const request = { method: "POST", body };
  Object.defineProperty(request, "headers", {
    enumerable: false,
    value: { "x-hub-signature-256": signature },
  });
  await metaWebhook(request, response);
  assert.equal(response.statusCode, 200);
  delete process.env.META_APP_SECRET;
});

test("verifies streamed webhook bytes without reserializing unicode text", async () => {
  process.env.META_APP_SECRET = "synthetic-secret";
  const body = Buffer.from(JSON.stringify({ entry: [{ changes: [{ value: { messages: [{ id: "stream-message", from: "10000000000", type: "text", text: { body: "Hola, cómo estás?" } }] } }] }] }), "utf8");
  const signature = `sha256=${createHmac("sha256", process.env.META_APP_SECRET).update(body).digest("hex")}`;
  const response = responseDouble();
  const request = {
    method: "POST",
    headers: { "x-hub-signature-256": signature },
    async *[Symbol.asyncIterator]() {
      yield body.subarray(0, 20);
      yield body.subarray(20);
    },
  };
  await metaWebhook(request, response);
  assert.equal(response.statusCode, 200);
  delete process.env.META_APP_SECRET;
});

test("prefers raw stream bytes over a parsed body fallback", async () => {
  process.env.META_APP_SECRET = "synthetic-secret";
  const parsedBody = { entry: [{ changes: [{ value: { messages: [{ id: "stream-priority", from: "10000000000", type: "text", text: { body: "Hola" } }] } }] }] };
  const body = Buffer.from(JSON.stringify(parsedBody, null, 2), "utf8");
  const signature = `sha256=${createHmac("sha256", process.env.META_APP_SECRET).update(body).digest("hex")}`;
  const response = responseDouble();
  const request = {
    method: "POST",
    body: parsedBody,
    headers: { "x-hub-signature-256": signature },
    async *[Symbol.asyncIterator]() { yield body; },
  };
  await metaWebhook(request, response);
  assert.equal(response.statusCode, 200);
  delete process.env.META_APP_SECRET;
});

test("rejects an oversized streamed webhook before processing", async () => {
  const response = responseDouble();
  const request = {
    method: "POST",
    headers: {},
    async *[Symbol.asyncIterator]() { yield Buffer.alloc(1024 * 1024 + 1, "x"); },
  };
  await metaWebhook(request, response);
  assert.equal(response.statusCode, 413);
  assert.deepEqual(JSON.parse(response.body), { error: "webhook_payload_too_large" });
});
