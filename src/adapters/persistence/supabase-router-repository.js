/** Create the router repository using an injected Supabase client. */
export function createSupabaseRouterRepository(supabase) {
  if (!supabase?.from) throw new Error("supabase_client_required");
  const one = async (query) => {
    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return data ?? null;
  };
  const insert = async (table, value) => {
    const { data, error } = await supabase.from(table).insert(value).select().single();
    if (error) throw error;
    return data;
  };
  return {
    listCampaigns: async () => {
      const { data, error } = await supabase.from("campaigns").select("*").order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((campaign) => ({ ...campaign, message: campaign.prefilled_message }));
    },
    findLeadByPhone: (phone) => one(supabase.from("leads").select("*").eq("phone", phone)),
    findAgent: async (id) => {
      const agent = await one(supabase.from("agents").select("*").eq("id", id));
      if (!agent) return null;
      const { data: sources, error } = await supabase.from("agent_knowledge_sources").select("file_name, processed_knowledge").eq("agent_id", id).eq("status", "processed").order("created_at", { ascending: true });
      if (error) throw error;
      const processedKnowledge = (sources ?? []).map((source) => `Fuente: ${source.file_name}\n${source.processed_knowledge}`).join("\n\n");
      return processedKnowledge ? { ...agent, configuration: { ...(agent.configuration ?? {}), processed_knowledge: processedKnowledge } } : agent;
    },
    saveLead: async (lead) => {
      const { data, error } = await supabase.from("leads").upsert(lead, { onConflict: "phone", ignoreDuplicates: true }).select().single();
      if (!error) return data;
      // Some Supabase versions do not return a row when ignoreDuplicates is used.
      if (error.code !== "PGRST116") throw error;
      return one(supabase.from("leads").select("*").eq("phone", lead.phone));
    },
    updateLead: async (id, changes) => {
      const { data, error } = await supabase.from("leads").update(changes).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    findConversation: (leadId, campaignId) => one(
      supabase.from("conversations").select("*").eq("lead_id", leadId).eq("campaign_id", campaignId),
    ),
    listConversationsForLead: async (leadId) => {
      const { data, error } = await supabase.from("conversations").select("*").eq("lead_id", leadId);
      if (error) throw error;
      return data ?? [];
    },
    saveConversation: (conversation) => insert("conversations", conversation),
    updateConversation: async (id, changes) => {
      const { data, error } = await supabase.from("conversations").update(changes).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    hasMessage: async (providerMessageId) => {
      const message = await one(supabase.from("messages").select("id").eq("provider_message_id", providerMessageId));
      return Boolean(message);
    },
    saveMessage: (message) => insert("messages", message),
    listMessagesForConversation: async (conversationId) => {
      const { data, error } = await supabase.from("messages").select("body,direction,occurred_at").eq("conversation_id", conversationId).order("occurred_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    saveManualReview: async (review) => {
      if (!review.inbound_idempotency_key) return insert("manual_reviews", review);
      const { data, error } = await supabase.from("manual_reviews").upsert(review, { onConflict: "inbound_idempotency_key", ignoreDuplicates: true }).select().single();
      if (!error) return data;
      if (error.code !== "PGRST116") throw error;
      return one(supabase.from("manual_reviews").select("*").eq("inbound_idempotency_key", review.inbound_idempotency_key));
    },
  };
}
