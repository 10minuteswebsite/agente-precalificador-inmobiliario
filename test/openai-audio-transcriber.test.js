import test from "node:test";
import assert from "node:assert/strict";
import { createOpenAiAudioTranscriber } from "../src/adapters/ai/openai-audio-transcriber.js";

test("downloads WhatsApp media with Meta credentials and transcribes it with OpenAI", async () => {
  const calls = [];
  const transcriber = createOpenAiAudioTranscriber({
    apiKey: "openai-secret",
    metaAccessToken: "meta-secret",
    fetchImpl: async (url, options = {}) => {
      calls.push({ url, options });
      if (calls.length === 1) return { ok: true, json: async () => ({ url: "https://media.example.test/audio", mime_type: "audio/ogg" }) };
      if (calls.length === 2) return { ok: true, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer };
      assert.equal(options.headers.Authorization, "Bearer openai-secret");
      assert.equal(options.body.get("model"), "gpt-transcribe");
      assert.equal(options.body.get("response_format"), "json");
      assert.equal(options.body.get("file").name, "audio.ogg");
      return { ok: true, json: async () => ({ text: "  Quiero información por voz. " }) };
    },
  });

  assert.equal(await transcriber.transcribe({ media_id: "audio/1" }), "Quiero información por voz.");
  assert.equal(calls[0].url, "https://graph.facebook.com/v23.0/audio%2F1");
  assert.equal(calls[0].options.headers.Authorization, "Bearer meta-secret");
  assert.equal(calls[1].options.headers.Authorization, "Bearer meta-secret");
  assert.equal(calls.length, 3);
});

test("rejects media metadata without exposing provider credentials", async () => {
  const transcriber = createOpenAiAudioTranscriber({
    apiKey: "openai-secret",
    metaAccessToken: "meta-secret",
    fetchImpl: async () => ({ ok: false, status: 403, json: async () => ({ error: { code: "forbidden" } }) }),
  });
  await assert.rejects(() => transcriber.transcribe({ media_id: "audio-1" }), /meta_media_metadata_failed:forbidden/);
});

test("rejects an empty transcription response", async () => {
  let call = 0;
  const transcriber = createOpenAiAudioTranscriber({
    apiKey: "openai-secret",
    metaAccessToken: "meta-secret",
    fetchImpl: async (_url, options = {}) => {
      call += 1;
      if (call === 1) return { ok: true, json: async () => ({ url: "https://media.example.test/audio" }) };
      if (call === 2) return { ok: true, arrayBuffer: async () => new Uint8Array([1]).buffer };
      assert.ok(options.body instanceof FormData);
      return { ok: true, json: async () => ({ text: " " }) };
    },
  });
  await assert.rejects(() => transcriber.transcribe({ media_id: "audio-1" }), /openai_audio_transcription_empty_response/);
});
