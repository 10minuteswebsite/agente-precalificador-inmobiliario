import test from "node:test";
import assert from "node:assert/strict";
import { canProcessKnowledgeType, processKnowledgeContent } from "../src/domain/agents/process-knowledge-content.js";

test("processes bounded text knowledge without binary dependencies", () => {
  assert.equal(canProcessKnowledgeType("text/markdown"), true);
  assert.equal(processKnowledgeContent({ mimeType: "text/markdown", bytes: new TextEncoder().encode("  Horario: lunes  ") }), "Horario: lunes");
});

test("rejects unsupported binary extraction until an adapter is configured", () => {
  assert.equal(canProcessKnowledgeType("application/pdf"), false);
  assert.throws(() => processKnowledgeContent({ mimeType: "application/pdf", bytes: new Uint8Array([1]) }), /knowledge_processor_unavailable/);
});

