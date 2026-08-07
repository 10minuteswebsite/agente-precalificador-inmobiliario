import { routeMessage } from "../domain/routing/route-message.js";

export async function routeMessageWithFallback(input, campaigns, conversations, semanticResolver) {
  const deterministic = routeMessage(input, campaigns, conversations);
  if (deterministic.status !== "manual_review" || typeof semanticResolver?.resolve !== "function") return deterministic;
  let candidate;
  try {
    candidate = await semanticResolver.resolve({ input, campaigns, conversations });
  } catch {
    return deterministic;
  }
  const confidence = Number(candidate?.confidence ?? 0);
  const campaign = campaigns.find((item) => item.id === candidate?.campaign_id);
  if (!campaign || confidence < 0.85) return deterministic;
  return {
    status: "routed",
    method: "semantic",
    campaign_id: campaign.id,
    agent_id: campaign.agent_id,
    campaign_identifier: campaign.code,
    conversation_action: conversations.some((item) => item.campaign_id === campaign.id) ? "continue" : "start",
  };
}
