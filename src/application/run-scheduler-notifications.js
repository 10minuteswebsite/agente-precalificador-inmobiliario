const EVENT_TO_ENV = Object.freeze({
  "booking.confirmed": "META_TEMPLATE_BOOKING_CONFIRMED",
  "booking.rescheduled": "META_TEMPLATE_BOOKING_RESCHEDULED",
  "booking.cancelled": "META_TEMPLATE_BOOKING_CANCELLED",
  "booking.reminder": "META_TEMPLATE_BOOKING_REMINDER",
});

export function createSchedulerNotificationWorker({ repository, templateSender, emailSender = null, templates = {}, language = "es", now = () => new Date() }) {
  if (!repository?.claimDue || !repository?.markSent || !repository?.markFailed) throw new Error("scheduler_notification_repository_required");
  if (!templateSender?.sendTemplate) throw new Error("scheduler_template_sender_required");
  return {
    async run({ limit = 25 } = {}) {
      const claimed = await repository.claimDue({ limit, now: now().toISOString() });
      const results = [];
      for (const notification of claimed) {
        try {
          const template = templates[notification.event_type];
          if (!template) throw new Error("scheduler_template_not_configured");
          const payload = notification.payload ?? {};
          const to = notification.audience === "business"
            ? notification.admin_whatsapp
            : payload.lead?.phone;
          if (!to) throw new Error("scheduler_notification_recipient_missing");
          const delivery = await templateSender.sendTemplate({
            to,
            name: template,
            language,
            parameters: [payload.lead?.first_name ?? "", payload.service_name ?? "", payload.starts_at ?? "", payload.meeting_url || payload.management_url || ""],
          });
          if (notification.audience === "lead" && emailSender?.send && payload.lead?.email) {
            await emailSender.send({
              to: payload.lead.email,
              subject: emailSubject(notification.event_type),
              text: emailText(notification.event_type, payload),
              idempotency_key: `${notification.id}:email`,
            });
          }
          await repository.markSent(notification.id, { provider_message_id: delivery?.id ?? null, sent_at: now().toISOString() });
          results.push({ id: notification.id, status: "sent" });
        } catch (error) {
          await repository.markFailed(notification.id, String(error?.message ?? "scheduler_notification_failed"));
          results.push({ id: notification.id, status: "failed", error: String(error?.message ?? "scheduler_notification_failed") });
        }
      }
      return results;
    },
  };
}

function emailSubject(eventType) {
  return { "booking.confirmed": "Tu cita está confirmada", "booking.rescheduled": "Tu cita fue reprogramada", "booking.cancelled": "Tu cita fue cancelada", "booking.reminder": "Recordatorio de tu cita" }[eventType] ?? "Actualización de tu cita";
}

function emailText(eventType, payload) {
  const action = eventType === "booking.cancelled" ? "fue cancelada" : eventType === "booking.rescheduled" ? "fue reprogramada" : eventType === "booking.reminder" ? "se aproxima" : "está confirmada";
  return `Hola ${payload.lead?.first_name ?? ""},\n\nTu cita ${action}.\nServicio: ${payload.service_name ?? ""}\nInicio: ${payload.starts_at ?? ""}\n\nUsa este enlace para cambiar o cancelar la cita: ${payload.management_url ?? ""}\n${payload.meeting_url ? `Videollamada: ${payload.meeting_url}\n` : ""}\nEn la página de gestión también puedes agregar la cita a Google Calendar, Outlook u otro calendario.\n`;
}

export function schedulerTemplatesFromEnv(env = process.env) {
  return {
    "booking.confirmed": env.META_TEMPLATE_BOOKING_CONFIRMED,
    "booking.rescheduled": env.META_TEMPLATE_BOOKING_RESCHEDULED,
    "booking.cancelled": env.META_TEMPLATE_BOOKING_CANCELLED,
    "booking.reminder": env.META_TEMPLATE_BOOKING_REMINDER,
  };
}
