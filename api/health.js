export default function health(_request, response) {
  response.statusCode = 200;
  response.setHeader?.("Content-Type", "application/json");
  response.end(JSON.stringify({
    ok: true,
      service: "agente-enrutador",
      persistence: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
      authentication: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY),
      signature_verification: Boolean(process.env.META_APP_SECRET),
      outbound_messaging: Boolean(process.env.META_ACCESS_TOKEN && process.env.META_PHONE_NUMBER_ID),
      review_notifications: Boolean(process.env.REVIEW_NOTIFIER_URL),
      live_summaries: Boolean(process.env.SUMMARY_SERVICE_URL || process.env.OPENAI_API_KEY),
      semantic_routing: Boolean(process.env.CAMPAIGN_RESOLVER_URL),
      agent_runner: Boolean(process.env.OPENAI_API_KEY || process.env.AGENT_RUNNER_URL),
      agent_builder: Boolean(process.env.OPENAI_API_KEY || process.env.AGENT_BUILDER_URL),
      daily_email_reports: Boolean((process.env.RESEND_API_KEY && process.env.REPORT_FROM_EMAIL || process.env.EMAIL_SENDER_URL) && process.env.CRON_SECRET),
  }));
}
