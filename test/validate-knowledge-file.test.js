import test from "node:test";
import assert from "node:assert/strict";
import { buildKnowledgeStoragePath, hashKnowledgeFile, validateKnowledgeFile } from "../src/domain/agents/validate-knowledge-file.js";

test("validates supported knowledge files and returns safe metadata", () => {
  const file = validateKnowledgeFile({ organizationId: "org-1", agentId: "agent-1", name: "Guía.pdf", mimeType: "application/pdf", bytes: 1024 });
  assert.deepEqual(file, { tenantId: "org-1", agentId: "agent-1", fileName: "Guía.pdf", mimeType: "application/pdf", bytes: 1024, extension: "pdf" });
});

test("rejects unsupported, empty, and oversized files", () => {
  assert.throws(() => validateKnowledgeFile({ organizationId: "org", agentId: "agent", name: "x.exe", mimeType: "application/octet-stream", bytes: 1 }), /file_type_not_allowed/);
  assert.throws(() => validateKnowledgeFile({ organizationId: "org", agentId: "agent", name: "x.pdf", mimeType: "application/pdf", bytes: 0 }), /file_size_invalid/);
  assert.throws(() => validateKnowledgeFile({ organizationId: "org", agentId: "agent", name: "x.pdf", mimeType: "application/pdf", bytes: 10 * 1024 * 1024 + 1 }), /file_size_exceeded/);
});

test("hashes content and builds an organization-scoped path", () => {
  assert.equal(hashKnowledgeFile(Buffer.from("hola")), "b221d9dbb083a7f33428d7c2a3c3198ae925614d70210e28716ccaa7cd4ddb79");
  assert.equal(buildKnowledgeStoragePath({ tenantId: "org", agentId: "agent", sourceId: "source", extension: "pdf" }), "org/agent/source.pdf");
});
