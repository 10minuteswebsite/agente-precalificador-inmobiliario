import { normalizeAgentResponse } from "../domain/qualification/normalize-prequalifier-response.js";
import { deriveAgentOrchestration } from "../domain/agents/normalize-agent-capabilities.js";

/**
 * Builds an agent runner around a provider-neutral text generation function.
 * The provider receives Agent DNA plus campaign and live lead context.
 */
export function createConfiguredAgentRunner({ agentResolver, generate } = {}) {
  if (typeof agentResolver !== "function") throw new Error("agent_resolver_required");
  if (typeof generate !== "function") throw new Error("agent_generator_required");
  return {
    async respond(input) {
      const agent = await agentResolver(input.agent_id);
      if (!agent) throw new Error("agent_not_found");
      const agentDna = agent.configuration ?? {};
      const output = await generate({
        agent_dna: agentDna,
        orchestration: deriveAgentOrchestration(agentDna.capabilities ?? []),
        agent_name: agent.name,
        campaign_id: input.campaign_id,
        conversation_id: input.conversation_id,
        conversation_action: input.conversation_action ?? "continue",
        conversation_summary: input.conversation_summary ?? "",
        qualification_state: input.qualification_state ?? {},
        custom_field_values: input.custom_field_values ?? {},
        lead: input.lead,
        inbound: input.inbound,
      });
      return normalizeAgentResponse({ agentDna, output, currentState: input.qualification_state ?? {}, conversationId: input.conversation_id });
    },
  };
}
