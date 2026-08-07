import { createAdminClient } from "../../src/application/create-admin-client.js";
import { sendJson } from "../../src/application/http.js";
import { createMetaWhatsAppTemplateSender } from "../../src/adapters/meta/send-whatsapp-template.js";
import { createSchedulerNotificationWorker, schedulerTemplatesFromEnv } from "../../src/application/run-scheduler-notifications.js";
import { createHttpEmailSender } from "../../src/adapters/notifications/http-email-sender.js";
import { createResendEmailSender } from "../../src/adapters/notifications/resend-email-sender.js";

function repositoryFor(admin, now) {
  return {
    async claimDue({ limit = 25, now: dueBefore }) {
      const { data, error } = await admin.from("scheduler_notifications").select("*").eq("status", "pending").lte("due_at", dueBefore).order("due_at", { ascending: true }).limit(limit);
      if (error) throw error;
      const claimed = [];
      for (const row of data ?? []) {
        const { data: updated, error: claimError } = await admin.from("scheduler_notifications").update({ status: "sending", attempts: Number(row.attempts ?? 0) + 1 }).eq("id", row.id).eq("status", "pending").select("*").maybeSingle();
        if (claimError) throw claimError;
        if (!updated) continue;
        const { data: config, error: configError } = await admin.from("scheduler_configurations").select("admin_whatsapp").eq("tenant_id", row.tenant_id).maybeSingle();
        if (configError) throw configError;
        claimed.push({ ...updated, admin_whatsapp: config?.admin_whatsapp ?? null });
      }
      return claimed;
    },
    async markSent(id, changes) {
      const { error } = await admin.from("scheduler_notifications").update({ status: "sent", sent_at: changes.sent_at, last_error: null }).eq("id", id).eq("status", "sending");
      if (error) throw error;
    },
    async markFailed(id, message) {
      const { error } = await admin.from("scheduler_notifications").update({ status: "failed", last_error: message }).eq("id", id).eq("status", "sending");
      if (error) throw error;
    },
  };
}

export default async function schedulerNotifications(request, response) {
  if (request.method !== "GET") return sendJson(response, 405, { error: "method_not_allowed" });
  if (!process.env.CRON_SECRET || request.headers?.authorization !== `Bearer ${process.env.CRON_SECRET}`) return sendJson(response, 401, { error: "unauthorized" });
  if (process.env.SCHEDULER_NOTIFICATIONS_ENABLED !== "true") return sendJson(response, 200, { enabled: false, processed: 0 });
  try {
    const admin = createAdminClient();
    if (!admin) throw new Error("persistence_not_configured");
    const sender = createMetaWhatsAppTemplateSender({ accessToken: process.env.META_ACCESS_TOKEN, phoneNumberId: process.env.META_PHONE_NUMBER_ID });
    const emailSender = process.env.RESEND_API_KEY && process.env.NOTIFICATION_FROM_EMAIL
      ? createResendEmailSender({ apiKey: process.env.RESEND_API_KEY, from: process.env.NOTIFICATION_FROM_EMAIL })
      : process.env.EMAIL_SENDER_URL
        ? createHttpEmailSender({ endpoint: process.env.EMAIL_SENDER_URL, token: process.env.EMAIL_SENDER_TOKEN })
        : null;
    const worker = createSchedulerNotificationWorker({ repository: repositoryFor(admin), templateSender: sender, emailSender, templates: schedulerTemplatesFromEnv(), language: process.env.META_TEMPLATE_LANGUAGE || "es" });
    const results = await worker.run({ limit: Math.min(Number(process.env.SCHEDULER_NOTIFICATION_BATCH_SIZE || 25), 100) });
    return sendJson(response, 200, { enabled: true, processed: results.length, results });
  } catch (error) {
    const message = String(error?.message ?? "scheduler_notifications_failed");
    return sendJson(response, ["persistence_not_configured"].includes(message) ? 503 : 500, { error: message });
  }
}
