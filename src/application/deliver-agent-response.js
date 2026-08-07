import { responseText } from "../ports/message-sender.js";

export async function deliverAgentResponse({ response, normalized, conversation, messageSender, repository, idFactory }) {
  const body = responseText(response);
  const interactive = response?.interactive ?? normalized?.interactive ?? null;
  if (!body && !interactive) return { status: "not_sent", reason: "empty_agent_response" };
  if (interactive && messageSender?.sendInteractive) {
    const sent = await messageSender.sendInteractive({ to: normalized.sender_phone, interactive });
    await repository.saveMessage({ provider_message_id: sent?.id ?? `outbound:${idFactory()}`, conversation_id: conversation?.id ?? null, direction: "outbound", kind: "interactive", body: body || JSON.stringify(interactive), media_id: null, occurred_at: new Date().toISOString() });
    return { status: "sent", body, interactive, provider_message_id: sent?.id ?? null };
  }
  if (!messageSender?.sendText) throw new Error("message_sender_required");
  const sent = await messageSender.sendText({ to: normalized.sender_phone, text: body });
  await repository.saveMessage({
    provider_message_id: sent?.id ?? `outbound:${idFactory()}`,
    conversation_id: conversation?.id ?? null,
    direction: "outbound",
    kind: "text",
    body,
    media_id: null,
    occurred_at: new Date().toISOString(),
  });
  return { status: "sent", body, provider_message_id: sent?.id ?? null };
}
