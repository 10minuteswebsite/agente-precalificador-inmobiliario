import test from "node:test";
import assert from "node:assert/strict";
import { normalizeKnowledgeSources, formatKnowledgeSources } from "../src/domain/agents/normalize-knowledge-sources.js";

test("normalizes text and http(s) knowledge sources", () => {
  const sources = normalizeKnowledgeSources("Información del taller\nhttps://example.test/info\nhttps://example.test/info");
  assert.deepEqual(sources, [
    { type: "text", value: "Información del taller" },
    { type: "url", value: "https://example.test/info" },
  ]);
  assert.equal(formatKnowledgeSources(sources), "Información del taller\nhttps://example.test/info");
});

test("bounds knowledge source count and length", () => {
  const sources = normalizeKnowledgeSources(Array.from({ length: 25 }, (_, index) => `${index}-${"x".repeat(2100)}`));
  assert.equal(sources.length, 20);
  assert.equal(sources[0].value.length, 2_000);
});
