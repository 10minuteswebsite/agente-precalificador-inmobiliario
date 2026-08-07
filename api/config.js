export default function config(_request, response) {
  response.statusCode = 200;
  response.setHeader?.("Content-Type", "application/json");
  response.end(JSON.stringify({
    supabaseUrl: process.env.SUPABASE_URL ?? null,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY ?? null,
    features: {
      outboundMessaging: Boolean(process.env.META_ACCESS_TOKEN && process.env.META_PHONE_NUMBER_ID),
      agentRunner: Boolean(process.env.OPENAI_API_KEY || process.env.AGENT_RUNNER_URL),
      voiceTranscription: Boolean(process.env.AUDIO_TRANSCRIBER_URL || (process.env.OPENAI_API_KEY && process.env.META_ACCESS_TOKEN)),
      reviewNotifications: Boolean(process.env.REVIEW_NOTIFIER_URL),
      liveSummaries: Boolean(process.env.SUMMARY_SERVICE_URL || process.env.OPENAI_API_KEY),
      semanticRouting: Boolean(process.env.CAMPAIGN_RESOLVER_URL),
      agentBuilder: Boolean(process.env.OPENAI_API_KEY || process.env.AGENT_BUILDER_URL),
      dailyEmailReports: Boolean((process.env.RESEND_API_KEY && process.env.REPORT_FROM_EMAIL || process.env.EMAIL_SENDER_URL) && process.env.CRON_SECRET),
    },
  }));
}
