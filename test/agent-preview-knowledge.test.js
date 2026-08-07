import test from "node:test";
import assert from "node:assert/strict";
import { withProcessedKnowledge } from "../api/agent-preview.js";

test("preview runtime includes processed knowledge sources", () => {
  const runtime = withProcessedKnowledge({ identity: "Asistente" }, [{ file_name: "poster.png", processed_knowledge: "Taller en Atlanta: 13 de septiembre" }]);
  assert.equal(runtime.identity, "Asistente");
  assert.match(runtime.processed_knowledge, /Taller en Atlanta/);
});
