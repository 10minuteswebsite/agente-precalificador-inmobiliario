function errorCode(body, status) {
  return body?.error?.code ?? body?.error?.type ?? status;
}

async function readJson(response) {
  return response.json().catch(() => ({}));
}

/**
 * Provider adapter for WhatsApp voice notes.
 * Meta owns the media URL; OpenAI only receives the downloaded audio bytes.
 */
export function createOpenAiAudioTranscriber({
  apiKey,
  metaAccessToken,
  model = "gpt-transcribe",
  apiVersion = "v23.0",
  graphBaseUrl = "https://graph.facebook.com",
  endpoint = "https://api.openai.com/v1/audio/transcriptions",
  fetchImpl = fetch,
  timeoutMs = 30_000,
} = {}) {
  if (!apiKey) throw new Error("openai_audio_transcriber_not_configured");
  if (!metaAccessToken) throw new Error("meta_media_access_not_configured");

  return {
    async transcribe({ media_id }) {
      if (!media_id) throw new Error("audio_media_id_required");
      const signal = typeof AbortSignal?.timeout === "function" ? AbortSignal.timeout(timeoutMs) : undefined;
      const metadataResponse = await fetchImpl(`${graphBaseUrl}/${apiVersion}/${encodeURIComponent(media_id)}`, {
        headers: { Authorization: `Bearer ${metaAccessToken}` },
        ...(signal ? { signal } : {}),
      });
      const metadata = await readJson(metadataResponse);
      if (!metadataResponse.ok || typeof metadata?.url !== "string" || !metadata.url) {
        throw new Error(`meta_media_metadata_failed:${errorCode(metadata, metadataResponse.status)}`);
      }

      const mediaResponse = await fetchImpl(metadata.url, {
        headers: { Authorization: `Bearer ${metaAccessToken}` },
        ...(signal ? { signal } : {}),
      });
      if (!mediaResponse.ok) throw new Error(`meta_media_download_failed:${mediaResponse.status}`);
      const audioBytes = await mediaResponse.arrayBuffer();
      const form = new FormData();
      form.append("model", model);
      form.append("response_format", "json");
      form.append("file", new Blob([audioBytes], { type: metadata.mime_type || "audio/ogg" }), "audio.ogg");

      const transcriptionResponse = await fetchImpl(endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
        ...(signal ? { signal } : {}),
      });
      const transcription = await readJson(transcriptionResponse);
      if (!transcriptionResponse.ok) {
        throw new Error(`openai_audio_transcription_failed:${errorCode(transcription, transcriptionResponse.status)}`);
      }
      if (typeof transcription?.text !== "string" || !transcription.text.trim()) {
        throw new Error("openai_audio_transcription_empty_response");
      }
      return transcription.text.trim();
    },
  };
}
