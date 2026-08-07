import { resolveCampaign } from "./resolve-campaign.js";

export function routeMessage(message, campaigns, conversations = []) {
  const resolution = resolveCampaign(message.text ?? "", campaigns);
  if (resolution.status !== "resolved") {
    // Once a lead has an unambiguous active conversation, subsequent natural
    // messages belong to it even when they no longer contain the campaign
    // code. Never guess when the phone has multiple active campaign threads.
    const active = conversations.filter((item) => item.sender_phone === message.sender_phone);
    const dated = active
      .map((item) => ({ item, time: Date.parse(item.last_message_at ?? item.created_at ?? "") }))
      .filter((entry) => Number.isFinite(entry.time))
      .sort((left, right) => right.time - left.time);
    const latest = active.length === 1
      ? active[0]
      : dated.length === active.length && dated[0]?.time > dated[1]?.time
        ? dated[0].item
        : null;
    if (latest) {
      const campaign = campaigns.find((item) => item.id === latest.campaign_id);
      if (campaign) {
        return {
          status: "routed",
          method: "existing_conversation",
          campaign_id: campaign.id,
          agent_id: campaign.agent_id,
          conversation_id: latest.id,
          conversation_action: "continue",
          campaign_identifier: campaign.code,
        };
      }
    }
    return {
      status: "manual_review",
      reason: resolution.reason,
      sender_phone: message.sender_phone,
    };
  }

  const campaign = resolution.campaign;
  const conversation = conversations.find(
    (item) => item.sender_phone === message.sender_phone && item.campaign_id === campaign.id,
  );

  return {
    status: "routed",
    method: resolution.method,
    campaign_id: campaign.id,
    agent_id: campaign.agent_id,
    conversation_id: conversation?.id ?? null,
    conversation_action: conversation ? "continue" : "start",
    campaign_identifier: campaign.code,
  };
}
