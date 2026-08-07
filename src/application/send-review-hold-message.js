const HOLD_MESSAGE = "Gracias por escribirnos. Estoy revisando un detalle para dirigirte con la persona correcta. Dame un momento, por favor.";

export async function sendReviewHoldMessage({ normalized, conversation, messageSender, repository, idFactory }) {
  if (!messageSender?.sendText) return { status: "not_sent", reason: "message_sender_unconfigured" };
  const sent = await messageSender.sendText({ to: normalized.sender_phone, text: HOLD_MESSAGE });
  await repository.saveMessage({
    provider_message_id: sent?.id ?? `outbound:review:${idFactory()}`,
    conversation_id: conversation?.id ?? null,
    direction: "outbound",
    kind: "text",
    body: HOLD_MESSAGE,
    media_id: null,
    occurred_at: new Date().toISOString(),
  });
  return { status: "sent", body: HOLD_MESSAGE, provider_message_id: sent?.id ?? null };
}
