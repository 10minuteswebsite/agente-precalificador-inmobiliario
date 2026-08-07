import { createAdminClient } from "../../src/application/create-admin-client.js";
import { runDailyLeadReports } from "../../src/application/run-daily-lead-reports.js";
import { createHttpEmailSender } from "../../src/adapters/notifications/http-email-sender.js";
import { createSupabaseDailyReportRepository } from "../../src/adapters/persistence/supabase-daily-report-repository.js";
import { sendJson } from "../../src/application/http.js";
import { createResendEmailSender } from "../../src/adapters/notifications/resend-email-sender.js";

function createEmailSender(env = process.env) {
  if (env.RESEND_API_KEY) return createResendEmailSender({ apiKey: env.RESEND_API_KEY, from: env.REPORT_FROM_EMAIL });
  return createHttpEmailSender({ endpoint: env.EMAIL_SENDER_URL, token: env.EMAIL_SENDER_TOKEN });
}

export default async function dailyLeadReports(request, response) {
  if (request.method !== "GET") return sendJson(response, 405, { error: "method_not_allowed" });
  if (!process.env.CRON_SECRET || request.headers?.authorization !== `Bearer ${process.env.CRON_SECRET}`) return sendJson(response, 401, { error: "unauthorized" });
  try {
    const admin = createAdminClient();
    if (!admin) throw new Error("persistence_not_configured");
    const repository = createSupabaseDailyReportRepository(admin);
    const emailSender = createEmailSender();
    const results = await runDailyLeadReports({ repository, emailSender });
    return sendJson(response, 200, { processed: results.length, results });
  } catch (error) {
    const message = String(error?.message ?? "request_failed");
    const status = ["persistence_not_configured", "email_sender_not_configured"].includes(message) ? 503 : 500;
    return sendJson(response, status, { error: status === 500 ? "request_failed" : message });
  }
}
