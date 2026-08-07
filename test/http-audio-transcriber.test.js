import test from "node:test";
import assert from "node:assert/strict";
import { createHttpAudioTranscriber } from "../src/adapters/ai/http-audio-transcriber.js";

test("HTTP audio transcriber isolates the configured transcription service", async () => {
  const transcriber = createHttpAudioTranscriber({ endpoint: "https://audio.example.test/transcribe", fetchImpl: async (_url, options) => {
    assert.equal(JSON.parse(options.body).media_id, "audio-1");
    return { ok: true, json: async () => ({ text: "Texto de voz" }) };
  } });
  assert.equal(await transcriber.transcribe({ media_id: "audio-1", sender_phone: "+1" }), "Texto de voz");
});
