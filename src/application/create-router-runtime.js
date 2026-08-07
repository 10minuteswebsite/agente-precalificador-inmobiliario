import { createClient } from "@supabase/supabase-js";
import { normalizeMetaMessage } from "../adapters/meta/normalize-meta-message.js";
import { createSupabaseRouterRepository } from "../adapters/persistence/supabase-router-repository.js";
import { createMetaWhatsAppSender } from "../adapters/meta/send-whatsapp-text.js";
import { processIncomingMessage } from "./process-incoming-message.js";
import { createConfiguredAgentRunner } from "./create-configured-agent-runner.js";
import { createHttpTextGenerator } from "../adapters/ai/http-text-generator.js";
import { createHttpAudioTranscriber } from "../adapters/ai/http-audio-transcriber.js";
import { createOpenAiAudioTranscriber } from "../adapters/ai/openai-audio-transcriber.js";
import { createHttpReviewNotifier } from "../adapters/notifications/http-review-notifier.js";
import { createHttpConversationSummarizer } from "../adapters/ai/http-conversation-summarizer.js";
import { createOpenAiConversationSummarizer } from "../adapters/ai/openai-conversation-summarizer.js";
import { createHttpCampaignResolver } from "../adapters/ai/http-campaign-resolver.js";
import { createHttpEmergencyResponder } from "../adapters/ai/http-emergency-responder.js";
import { createOpenAiPrequalifierGenerator } from "../adapters/ai/openai-prequalifier-generator.js";
import { createDefaultEmergencyResponder } from "./create-default-emergency-responder.js";

export function createRouterRuntime(env = process.env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const repository = createSupabaseRouterRepository(supabase);
  const messageSender = env.META_ACCESS_TOKEN && env.META_PHONE_NUMBER_ID
    ? createMetaWhatsAppSender({ accessToken: env.META_ACCESS_TOKEN, phoneNumberId: env.META_PHONE_NUMBER_ID })
    : null;
  const agentGenerator = env.OPENAI_API_KEY
    ? createOpenAiPrequalifierGenerator({ apiKey: env.OPENAI_API_KEY, model: env.OPENAI_MODEL || "gpt-5.6" })
    : env.AGENT_RUNNER_URL
      ? createHttpTextGenerator({ endpoint: env.AGENT_RUNNER_URL, token: env.AGENT_RUNNER_TOKEN })
      : null;
  const agentRunner = agentGenerator && repository.findAgent
    ? createConfiguredAgentRunner({ agentResolver: (id) => repository.findAgent(id), generate: agentGenerator })
    : null;
  const transcriber = env.AUDIO_TRANSCRIBER_URL
    ? createHttpAudioTranscriber({ endpoint: env.AUDIO_TRANSCRIBER_URL, token: env.AUDIO_TRANSCRIBER_TOKEN })
    : env.OPENAI_API_KEY && env.META_ACCESS_TOKEN
      ? createOpenAiAudioTranscriber({
        apiKey: env.OPENAI_API_KEY,
        metaAccessToken: env.META_ACCESS_TOKEN,
        model: env.OPENAI_AUDIO_MODEL || "gpt-transcribe",
      })
    : null;
  const reviewNotifier = env.REVIEW_NOTIFIER_URL
    ? createHttpReviewNotifier({ endpoint: env.REVIEW_NOTIFIER_URL, token: env.REVIEW_NOTIFIER_TOKEN })
    : null;
  const conversationSummarizer = env.SUMMARY_SERVICE_URL
    ? createHttpConversationSummarizer({ endpoint: env.SUMMARY_SERVICE_URL, token: env.SUMMARY_SERVICE_TOKEN })
    : env.OPENAI_API_KEY
      ? createOpenAiConversationSummarizer({ apiKey: env.OPENAI_API_KEY, model: env.OPENAI_MODEL || "gpt-5.6" })
      : null;
  const semanticResolver = env.CAMPAIGN_RESOLVER_URL
    ? createHttpCampaignResolver({ endpoint: env.CAMPAIGN_RESOLVER_URL, token: env.CAMPAIGN_RESOLVER_TOKEN })
    : null;
  const emergencyResponder = env.EMERGENCY_RESPONDER_URL
    ? createHttpEmergencyResponder({ endpoint: env.EMERGENCY_RESPONDER_URL, token: env.EMERGENCY_RESPONDER_TOKEN })
    : createDefaultEmergencyResponder();
  return {
    async process(payload) {
      const normalized = normalizeMetaMessage(payload);
      return processIncomingMessage(normalized, { repository, agentRunner, emergencyResponder, messageSender, transcriber, reviewNotifier, conversationSummarizer, semanticResolver, idFactory: () => crypto.randomUUID() });
    },
  };
}
