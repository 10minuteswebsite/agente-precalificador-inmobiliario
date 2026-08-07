export function createSupabaseDailyReportRepository(supabase) {
  if (!supabase?.from) throw new Error("supabase_client_required");
  return {
    async listPrequalifierAgents() {
      const { data, error } = await supabase.from("agents").select("*").eq("status", "active");
      if (error) throw error;
      return (data ?? []).filter((agent) => agent.configuration?.kind === "real_estate_prequalifier");
    },
    async findReport(agentId, reportDate) {
      const { data, error } = await supabase.from("daily_lead_reports").select("*").eq("agent_id", agentId).eq("report_date", reportDate).maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
    async findLatestCompletedReport(agentId) {
      const { data, error } = await supabase.from("daily_lead_reports").select("*").eq("agent_id", agentId).in("status", ["sent", "skipped"]).order("period_end", { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
    async claimReport(report, existing) {
      if (existing?.status === "failed") {
        const { data, error } = await supabase.from("daily_lead_reports").update({ ...report, status: "processing", error_code: null, updated_at: new Date().toISOString() }).eq("id", existing.id).eq("status", "failed").select().maybeSingle();
        if (error) throw error;
        return data ?? null;
      }
      const { data, error } = await supabase.from("daily_lead_reports").upsert({ ...report, status: "processing" }, { onConflict: "agent_id,report_date", ignoreDuplicates: true }).select().maybeSingle();
      if (error && error.code !== "PGRST116") throw error;
      return data ?? null;
    },
    async listLeadConversations(agentId, periodStart, periodEnd) {
      const { data, error } = await supabase.from("conversations").select("*, leads(*), campaigns!inner(*)").eq("campaigns.agent_id", agentId).gt("last_message_at", periodStart).lte("last_message_at", periodEnd);
      if (error) throw error;
      return data ?? [];
    },
    async completeReport(id, changes) {
      const { error } = await supabase.from("daily_lead_reports").update({ ...changes, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    async failReport(id, message) {
      const { error } = await supabase.from("daily_lead_reports").update({ status: "failed", error_code: message.slice(0, 200), updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
  };
}
