import { dailyReportWindow } from "../domain/reporting/daily-report-schedule.js";
import { createDailyLeadReport } from "../domain/reporting/create-daily-lead-report.js";

export async function runDailyLeadReports({ repository, emailSender, now = new Date() } = {}) {
  if (!repository || typeof repository.listPrequalifierAgents !== "function") throw new Error("daily_report_repository_required");
  if (!emailSender || typeof emailSender.send !== "function") throw new Error("daily_report_email_sender_required");
  const results = [];
  for (const agent of await repository.listPrequalifierAgents()) {
    const reporting = agent.configuration?.reporting;
    if (!reporting) continue;
    const window = dailyReportWindow(reporting, now);
    if (!window.due) { results.push({ agent_id: agent.id, status: "not_due" }); continue; }
    const existing = await repository.findReport(agent.id, window.report_date);
    if (existing && ["processing", "sent", "skipped"].includes(existing.status)) { results.push({ agent_id: agent.id, status: "already_handled" }); continue; }
    const previous = await repository.findLatestCompletedReport(agent.id);
    const periodStart = previous?.period_end ? new Date(previous.period_end) : new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const claim = await repository.claimReport({ agent_id: agent.id, tenant_id: agent.tenant_id, report_date: window.report_date, period_start: periodStart.toISOString(), period_end: now.toISOString() }, existing);
    if (!claim) { results.push({ agent_id: agent.id, status: "already_claimed" }); continue; }
    try {
      const conversations = await repository.listLeadConversations(agent.id, periodStart.toISOString(), now.toISOString());
      if (!conversations.length && reporting.skip_empty) {
        await repository.completeReport(claim.id, { status: "skipped", lead_count: 0 });
        results.push({ agent_id: agent.id, status: "skipped", lead_count: 0 });
        continue;
      }
      const email = createDailyLeadReport({ agent, conversations, periodStart, periodEnd: now });
      const delivery = await emailSender.send({ ...email, idempotency_key: `daily-report:${agent.id}:${window.report_date}` });
      await repository.completeReport(claim.id, { status: "sent", lead_count: conversations.length, provider_message_id: delivery?.id ?? null, sent_at: now.toISOString() });
      results.push({ agent_id: agent.id, status: "sent", lead_count: conversations.length });
    } catch (error) {
      await repository.failReport(claim.id, String(error?.message ?? "daily_report_failed"));
      results.push({ agent_id: agent.id, status: "failed" });
    }
  }
  return results;
}
