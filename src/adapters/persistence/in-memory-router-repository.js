/**
 * Deterministic repository used by local tests and development.
 * The application depends on these small operations, not on Supabase.
 */
export function createInMemoryRouterRepository(seed = {}) {
  const state = {
    agents: [...(seed.agents ?? [])],
    leads: [...(seed.leads ?? [])],
    conversations: [...(seed.conversations ?? [])],
    messages: [...(seed.messages ?? [])],
    manualReviews: [...(seed.manualReviews ?? [])],
  };

  return {
    async findLeadByPhone(phone) {
      return state.leads.find((lead) => lead.phone === phone) ?? null;
    },
    async findAgent(id) {
      return state.agents.find((agent) => agent.id === id) ?? null;
    },
    async saveLead(lead) {
      const existing = state.leads.find((item) => item.phone === lead.phone);
      if (existing) return existing;
      state.leads.push(lead);
      return lead;
    },
    async updateLead(id, changes) {
      const lead = state.leads.find((item) => item.id === id);
      if (!lead) return null;
      Object.assign(lead, changes);
      return lead;
    },
    async findConversation(leadId, campaignId) {
      return state.conversations.find(
        (item) => item.lead_id === leadId && item.campaign_id === campaignId,
      ) ?? null;
    },
    async listConversationsForLead(leadId) {
      return state.conversations.filter((item) => item.lead_id === leadId);
    },
    async saveConversation(conversation) {
      state.conversations.push(conversation);
      return conversation;
    },
    async updateConversation(id, changes) {
      const conversation = state.conversations.find((item) => item.id === id);
      if (!conversation) return null;
      Object.assign(conversation, changes);
      return conversation;
    },
    async hasMessage(providerMessageId) {
      return state.messages.some((item) => item.provider_message_id === providerMessageId);
    },
    async saveMessage(message) {
      if (!(await this.hasMessage(message.provider_message_id))) state.messages.push(message);
      return message;
    },
    async listMessagesForConversation(conversationId) {
      return state.messages.filter((message) => message.conversation_id === conversationId);
    },
    async saveManualReview(review) {
      state.manualReviews.push(review);
      return review;
    },
    snapshot() {
      return structuredClone(state);
    },
  };
}
