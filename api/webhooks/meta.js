import { handleIncomingMessage } from "../../src/application/handle-incoming-message.js";
import { createRouterRuntime } from "../../src/application/create-router-runtime.js";
import { hasMessageForPhoneNumber, scopeMetaPayloadToPhoneNumber } from "../../src/adapters/meta/scope-meta-webhook.js";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const config = { api: { bodyParser: false } };
const MAX_WEBHOOK_BYTES = 1024 * 1024;

function send(response, status, body) {
  response.statusCode = status;
  response.setHeader?.("Content-Type", "application/json");
  response.end(JSON.stringify(body));
}

function hashPrefix(value) {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

function auditSignatureFailure(details) {
  console.warn(JSON.stringify({ event: "meta_webhook_signature_rejected", ...details }));
}

function auditProcessingFailure(error) {
  console.warn(JSON.stringify({
    event: "meta_webhook_processing_failed",
    error: error?.message ?? "unknown_error",
    name: error?.name ?? "Error",
  }));
}

function hasIncomingMessage(payload) {
  return Boolean(payload?.entry?.some((entry) =>
    entry?.changes?.some((change) => Array.isArray(change?.value?.messages) && change.value.messages.length > 0),
  ));
}

function verifySignature(request, rawBody) {
  if (!process.env.META_APP_SECRET) return { ok: true, reason: "signature_verification_disabled" };
  const signature = request.headers?.["x-hub-signature-256"] ?? request.headers?.["X-Hub-Signature-256"];
  if (!signature?.startsWith("sha256=")) {
    return {
      ok: false,
      reason: "missing_or_malformed_signature",
      has_signature_header: Boolean(signature),
    };
  }
  const bodyBuffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody), "utf8");
  const expected = createHmac("sha256", process.env.META_APP_SECRET).update(bodyBuffer).digest("hex");
  const supplied = signature.slice(7);
  const lengthMatches = supplied.length === expected.length;
  const matches = lengthMatches && timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
  return {
    ok: matches,
    reason: matches ? "signature_match" : "signature_mismatch",
    has_signature_header: true,
    supplied_length: supplied.length,
    expected_length: expected.length,
    supplied_hash: hashPrefix(supplied),
    expected_hash: hashPrefix(expected),
    body_bytes: bodyBuffer.length,
    body_hash: hashPrefix(bodyBuffer),
    app_secret_length: process.env.META_APP_SECRET.length,
    app_secret_hash: hashPrefix(process.env.META_APP_SECRET),
  };
}

async function rawPayloadBuffer(request) {
  if (Buffer.isBuffer(request.rawBody)) return request.rawBody;
  if (typeof request.rawBody === "string") return Buffer.from(request.rawBody, "utf8");
  if (typeof request.on === "function" || typeof request[Symbol.asyncIterator] === "function") {
    const chunks = [];
    let total = 0;
    for await (const chunk of request) {
      const buffer = Buffer.from(chunk);
      total += buffer.length;
      if (total > MAX_WEBHOOK_BYTES) throw new Error("webhook_payload_too_large");
      chunks.push(buffer);
    }
    if (chunks.length > 0) return Buffer.concat(chunks);
  }
  if (Buffer.isBuffer(request.body)) return request.body;
  if (typeof request.body === "string") return Buffer.from(request.body, "utf8");
  if (request.body && typeof request.body === "object") return Buffer.from(JSON.stringify(request.body), "utf8");
  return Buffer.from("{}", "utf8");
}

export default async function metaWebhook(request, response) {
  if (request.method === "GET") {
    const mode = request.query?.["hub.mode"];
    const token = request.query?.["hub.verify_token"];
    const challenge = request.query?.["hub.challenge"];
    if (mode === "subscribe" && token && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
      response.statusCode = 200;
      return response.end(String(challenge ?? ""));
    }
    return send(response, 403, { error: "webhook_verification_failed" });
  }

  if (request.method !== "POST") return send(response, 405, { error: "method_not_allowed" });
  let rawBodyBuffer;
  try {
    rawBodyBuffer = await rawPayloadBuffer(request);
  } catch (error) {
    return send(response, error.message === "webhook_payload_too_large" ? 413 : 400, { error: error.message });
  }
  if (rawBodyBuffer.length > MAX_WEBHOOK_BYTES) return send(response, 413, { error: "webhook_payload_too_large" });
  const signature = verifySignature(request, rawBodyBuffer);
  if (!signature.ok) {
    auditSignatureFailure(signature);
    return send(response, 401, { error: "invalid_webhook_signature" });
  }

  try {
    const rawBody = rawBodyBuffer.toString("utf8");
    const payload = JSON.parse(rawBody || "{}");
    if (!hasIncomingMessage(payload)) {
      return send(response, 200, { accepted: true, processing: "ignored_non_message_event" });
    }
    const configuredPhoneNumberId = process.env.META_PHONE_NUMBER_ID;
    if (configuredPhoneNumberId && !hasMessageForPhoneNumber(payload, configuredPhoneNumberId)) {
      return send(response, 200, { accepted: true, processing: "ignored_other_phone_number" });
    }
    const scopedPayload = scopeMetaPayloadToPhoneNumber(payload, configuredPhoneNumberId);
    const runtime = createRouterRuntime();
    if (!runtime) {
      const result = handleIncomingMessage(scopedPayload);
      return send(response, 200, { accepted: result.accepted, event_id: result.normalized.event_id });
    }
    const normalized = handleIncomingMessage(scopedPayload).normalized;
    const processing = await runtime.process(scopedPayload);
    return send(response, 200, { accepted: true, event_id: normalized.event_id, processing: processing.status });
  } catch (error) {
    auditProcessingFailure(error);
    return send(response, 400, { error: error.message });
  }
}
