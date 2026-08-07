export async function dispatchToAgent(route, message, { agentRunner }) {
  if (route.status !== "routed") {
    return { status: "not_dispatched", reason: route.reason ?? "manual_review" };
  }
  if (!agentRunner?.respond) throw new Error("agent_runner_required");
  const inbound = message?.message ?? {};
  const response = await agentRunner.respond({
    agent_id: route.agent_id,
    campaign_id: route.campaign_id,
    conversation_id: route.conversation_id,
    conversation_action: route.conversation_action ?? "continue",
    conversation_summary: route.conversation_summary ?? null,
    qualification_state: route.qualification_state ?? {},
    custom_field_values: route.custom_field_values ?? {},
    lead: { phone: message.sender_phone, first_name: message.sender_name?.trim().split(/\s+/)[0] ?? null, email: route.lead_email ?? null },
    inbound: { kind: inbound.kind ?? null, text: inbound.text ?? null, media_id: inbound.media_id ?? null },
    message,
  });
  return { status: "dispatched", agent_id: route.agent_id, response };
}
