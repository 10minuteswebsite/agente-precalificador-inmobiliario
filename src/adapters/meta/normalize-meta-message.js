function requireValue(value, name) {
  if (!value) throw new Error(`meta_webhook_missing_${name}`);
  return value;
}

function mapMessage(message, contact) {
  if (message.type === "text") {
    return { id: requireValue(message.id, "message_id"), kind: "text", text: requireValue(message.text?.body, "text") };
  }
  if (message.type === "audio") {
    return { id: requireValue(message.id, "message_id"), kind: "voice", media_id: requireValue(message.audio?.id, "audio_id") };
  }
  if (message.type === "image" || message.type === "document") {
    return { id: requireValue(message.id, "message_id"), kind: message.type, media_id: requireValue(message[message.type]?.id, `${message.type}_id`) };
  }
  if (message.type === "interactive") {
    const reply = message.interactive?.button_reply ?? message.interactive?.list_reply;
    if (!reply?.id) throw new Error("meta_webhook_missing_interactive_reply");
    return { id: requireValue(message.id, "message_id"), kind: "interactive", text: reply.title ?? reply.description ?? reply.id, interactive_id: reply.id };
  }
  throw new Error(`meta_webhook_unsupported_message_type_${message.type ?? "unknown"}`);
}

export function normalizeMetaMessage(payload, now = new Date()) {
  const value = payload?.entry?.[0]?.changes?.[0]?.value;
  const message = value?.messages?.[0];
  const contact = value?.contacts?.[0];
  requireValue(message, "message");
  const messageData = mapMessage(message, contact);
  const eventId = requireValue(message.id, "message_id");

  return {
    event_id: eventId,
    schema_version: 1,
    occurred_at: now.toISOString(),
    tenant_id: "shared_whatsapp",
    correlation_id: eventId,
    idempotency_key: `meta:${eventId}`,
    channel: "whatsapp",
    recipient_phone_number_id: value?.metadata?.phone_number_id ?? null,
    sender_phone: requireValue(message.from, "sender_phone"),
    sender_name: contact?.profile?.name ?? null,
    message: messageData,
  };
}
