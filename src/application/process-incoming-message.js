import { dispatchToAgent } from "./dispatch-to-agent.js";
import { deliverAgentResponse } from "./deliver-agent-response.js";
import { sendReviewHoldMessage } from "./send-review-hold-message.js";
import { routeMessageWithFallback } from "./route-message-with-fallback.js";
import { extractLeadContact } from "./extract-lead-contact.js";
import { deriveLeadInsight, mergeLeadSummary } from "../domain/conversations/derive-lead-insight.js";

export async function processIncomingMessage(normalized, { campaigns, repository, idFactory, agentRunner, emergencyResponder, messageSender, conversationSummarizer, transcriber, reviewNotifier, semanticResolver }) {
  if (await repository.hasMessage(normalized.idempotency_key)) {
    return { status: "duplicate", event_id: normalized.event_id };
  }

  if (normalized.message.kind === "voice" && transcriber?.transcribe) {
    normalized = { ...normalized, message: { ...normalized.message, text: await transcriber.transcribe({ media_id: normalized.message.media_id, sender_phone: normalized.sender_phone }) } };
  }
  const lead = await repository.saveLead({
    id: idFactory(),
    phone: normalized.sender_phone,
    first_name: normalized.sender_name?.trim().split(/\s+/)[0] ?? null,
  });
  const contact = extractLeadContact(normalized.message.text ?? "");
  if (contact.email && repository.updateLead) {
    const updated = await repository.updateLead(lead.id, contact);
    if (updated) Object.assign(lead, updated);
  }
  const storedConversations = await repository.listConversationsForLead(lead.id);
  const existingConversations = storedConversations.map((conversation) => ({
    ...conversation, sender_phone: normalized.sender_phone,
  }));
  const availableCampaigns = campaigns ?? await repository.listCampaigns();
  const route = await routeMessageWithFallback(
    { sender_phone: normalized.sender_phone, text: normalized.message.text ?? "" },
    availableCampaigns,
    existingConversations,
    semanticResolver,
  );

  if (route.status === "manual_review") {
    const review = await repository.saveManualReview({
      id: idFactory(), lead_id: lead.id, status: "open", reason: route.reason,
      inbound_idempotency_key: normalized.idempotency_key,
    });
    if (reviewNotifier?.notify) {
      await reviewNotifier.notify({
        review,
        lead: { phone: lead.phone, first_name: lead.first_name, email: lead.email ?? null },
        inbound: normalized,
        reason: route.reason,
      }).catch(() => null);
    }
  }

  let conversation = null;
  if (route.status === "routed") {
    conversation = await repository.findConversation(lead.id, route.campaign_id);
    if (!conversation) {
      conversation = await repository.saveConversation({
        id: idFactory(), lead_id: lead.id, campaign_id: route.campaign_id, status: "active",
      });
    }
  }

  await repository.saveMessage({
    provider_message_id: normalized.idempotency_key,
    conversation_id: conversation?.id ?? null,
    direction: "inbound",
    kind: normalized.message.kind,
    body: normalized.message.text ?? null,
    media_id: normalized.message.media_id ?? null,
    occurred_at: normalized.occurred_at,
  });
  if (conversation && repository.updateConversation) {
    let summary = null;
    if (conversationSummarizer?.update) {
      try {
        summary = await conversationSummarizer.update({
          current_summary: conversation.summary ?? "",
          note: normalized.message.text ?? "",
          message: normalized.message,
          lead: { phone: normalized.sender_phone, first_name: normalized.sender_name?.trim().split(/\s+/)[0] ?? null },
        });
      } catch {
        summary = null;
      }
    }
    if (typeof summary === "string" && summary.trim()) {
      conversation = await repository.updateConversation(conversation.id, { summary: summary.trim(), last_message_at: normalized.occurred_at });
    } else {
    const campaign = availableCampaigns.find((item) => item.id === conversation.campaign_id);
    const history = repository.listMessagesForConversation ? await repository.listMessagesForConversation(conversation.id) : [];
    const observedText = history.filter((message) => message.direction === "inbound" && message.body).map((message) => message.body).join(" ");
    const previousLabels = conversation.qualification_state?.intent?.labels ?? [];
    const campaignContext = campaign?.name ?? campaign?.message ?? "";
    const insight = deriveLeadInsight({ text: observedText || normalized.message.text, previousLabels, campaignContext });
    conversation = await repository.updateConversation(conversation.id, {
      summary: mergeLeadSummary({ previousSummary: conversation.summary, previousLabels, text: observedText || normalized.message.text, campaignContext }),
      qualification_state: { ...(conversation.qualification_state ?? {}), intent: insight.intent },
      last_message_at: normalized.occurred_at,
    });
    }
  }
  let dispatch = { status: route.status === "routed" ? "pending_agent" : "not_dispatched" };
  if (route.status === "routed" && agentRunner) {
    try {
      dispatch = await dispatchToAgent({ ...route, conversation_id: conversation.id, conversation_summary: conversation.summary ?? "", qualification_state: conversation.qualification_state ?? {}, custom_field_values: conversation.custom_field_values ?? {}, lead_email: lead.email ?? null }, normalized, { agentRunner });
    } catch {
      const review = await repository.saveManualReview({
        id: idFactory(), lead_id: lead.id, status: "open", reason: "agent_execution_failed",
        inbound_idempotency_key: normalized.idempotency_key,
      });
      if (reviewNotifier?.notify) {
        await reviewNotifier.notify({ review, lead: { phone: lead.phone, first_name: lead.first_name }, inbound: normalized, reason: "agent_execution_failed" }).catch(() => null);
      }
      dispatch = { status: "failed", reason: "agent_execution_failed" };
    }
  }
  if (conversation && (dispatch.response?.qualification_state || dispatch.response?.custom_field_values) && repository.updateConversation) {
    conversation = await repository.updateConversation(conversation.id, {
      qualification_state: { ...(conversation.qualification_state ?? {}), ...dispatch.response.qualification_state },
      custom_field_values: { ...(conversation.custom_field_values ?? {}), ...(dispatch.response.custom_field_values ?? {}) },
      last_message_at: normalized.occurred_at,
    });
  }
  let emergency = null;
  if (route.status === "manual_review" && emergencyResponder?.respond) {
    try {
      emergency = await emergencyResponder.respond({ lead: { phone: lead.phone, first_name: lead.first_name }, inbound: normalized, reason: route.reason });
    } catch {
      emergency = null;
    }
  }
  const delivery = dispatch.status === "dispatched" && messageSender
    ? await deliverAgentResponse({ response: dispatch.response, normalized, conversation, messageSender, repository, idFactory })
      : route.status === "manual_review"
      ? emergency && messageSender
        ? await deliverAgentResponse({ response: { text: emergency }, normalized, conversation: null, messageSender, repository, idFactory })
        : await sendReviewHoldMessage({ normalized, messageSender, repository, idFactory })
      : dispatch.status === "failed"
        ? await sendReviewHoldMessage({ normalized, conversation, messageSender, repository, idFactory })
      : { status: "not_sent", reason: dispatch.status === "dispatched" ? "message_sender_unconfigured" : "agent_not_dispatched" };
  return { ...route, event_id: normalized.event_id, conversation_id: conversation?.id ?? null, dispatch, delivery, events: dispatch.response?.events ?? [] };
}
