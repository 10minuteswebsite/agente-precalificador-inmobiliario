export function createHttpAudioTranscriber({ endpoint, token, fetchImpl = fetch } = {}) {
  return {
    async transcribe({ media_id, sender_phone }) {
      if (!endpoint) throw new Error("audio_transcriber_endpoint_required");
      const response = await fetchImpl(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ media_id, sender_phone }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(`audio_transcriber_failed:${body?.error?.code ?? response.status}`);
      if (typeof body?.text !== "string" || !body.text.trim()) throw new Error("audio_transcriber_empty_response");
      return body.text.trim();
    },
  };
}
