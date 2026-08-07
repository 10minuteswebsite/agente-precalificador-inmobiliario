import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createKnowledgeSourcesHandler } from "../api/knowledge-sources.js";

function responseDouble() { return { statusCode: null, body: null, setHeader() {}, end(body) { this.body = JSON.parse(body); } }; }
function clientDouble({ count = 0, inserted = {}, source = null } = {}) {
  return { from(table) {
    const q = { select() { return this; }, eq() { return this; }, order() { return this; }, delete() { return this; }, maybeSingle: async () => ({ data: table === "agents" ? { id: "agent-1", tenant_id: "tenant-1" } : source, error: null }), single: async () => ({ data: inserted, error: null }) };
    if (table === "agent_knowledge_sources") q.select = (_fields, options) => options?.head ? { eq: async () => ({ count, error: null }) } : q;
    return { ...q, insert() { return this; } };
  }, storage: { from() { return { remove: async () => ({ error: null }) }; } } };
}

test("registers an isolated source and returns its private upload path", async () => {
  const response = responseDouble();
  const handler = createKnowledgeSourcesHandler({ createClient: () => clientDouble({ inserted: { id: "source-1" } }), requireAuthenticated: async () => ({ id: "user-1" }) });
  await handler({ method: "POST", body: { tenant_id: "tenant-1", agent_id: "agent-1", file_name: "guide.pdf", mime_type: "application/pdf", byte_size: 123, sha256: "a".repeat(64) } }, response);
  assert.equal(response.statusCode, 201);
  assert.equal(response.body.upload.bucket, "agent-knowledge");
  assert.match(response.body.upload.path, /^tenant-1\/agent-1\/[0-9a-f-]+\.pdf$/);
});

test("rejects a source when the per-agent limit is reached", async () => {
  const response = responseDouble();
  const handler = createKnowledgeSourcesHandler({ createClient: () => clientDouble({ count: 20 }), requireAuthenticated: async () => ({ id: "user-1" }) });
  await handler({ method: "POST", body: { tenant_id: "tenant-1", agent_id: "agent-1", file_name: "guide.pdf", mime_type: "application/pdf", byte_size: 123, sha256: "a".repeat(64) } }, response);
  assert.equal(response.statusCode, 422);
  assert.equal(response.body.error, "knowledge_source_limit_reached");
});

test("rejects a source without a valid content hash", async () => {
  const response = responseDouble();
  const handler = createKnowledgeSourcesHandler({ createClient: () => clientDouble(), requireAuthenticated: async () => ({ id: "user-1" }) });
  await handler({ method: "POST", body: { tenant_id: "tenant-1", agent_id: "agent-1", file_name: "guide.pdf", mime_type: "application/pdf", byte_size: 123, sha256: "not-a-hash" } }, response);
  assert.equal(response.statusCode, 422);
  assert.equal(response.body.error, "file_hash_invalid");
});

test("lists only the authenticated agent sources", async () => {
  const response = responseDouble();
  const handler = createKnowledgeSourcesHandler({ createClient: () => clientDouble(), requireAuthenticated: async () => ({ id: "user-1" }) });
  await handler({ method: "GET", url: "/api/knowledge-sources?agent_id=agent-1" }, response);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body.sources, []);
});

test("deletes the private object and its metadata together", async () => {
  const response = responseDouble();
  const handler = createKnowledgeSourcesHandler({ createClient: () => clientDouble({ source: { id: "source-1", storage_path: "tenant-1/agent-1/source.pdf" } }), requireAuthenticated: async () => ({ id: "user-1" }) });
  await handler({ method: "DELETE", body: { source_id: "source-1" } }, response);
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.deleted, true);
});

test("rejects a downloaded object whose bytes do not match its registered integrity metadata", async () => {
  const bytes = new TextEncoder().encode("contenido cambiado");
  const originalBytes = new TextEncoder().encode("contenido original");
  const source = {
    id: "source-1",
    storage_path: "tenant-1/agent-1/source.txt",
    mime_type: "text/plain",
    byte_size: originalBytes.byteLength,
    sha256: createHash("sha256").update(originalBytes).digest("hex"),
  };
  const updates = [];
  const client = {
    from(table) {
      const query = {
        select() { return this; },
        eq() { return this; },
        update(values) { updates.push({ table, values }); return this; },
        maybeSingle: async () => ({ data: source, error: null }),
      };
      return query;
    },
    storage: { from() { return { download: async () => ({ data: new Blob([bytes]), error: null }) }; } },
  };
  const response = responseDouble();
  const handler = createKnowledgeSourcesHandler({ createClient: () => client, requireAuthenticated: async () => ({ id: "user-1" }) });
  await handler({ method: "POST", body: { source_id: source.id } }, response);
  assert.equal(response.statusCode, 422);
  assert.equal(response.body.error, "knowledge_file_integrity_failed");
  assert.equal(updates[0].values.failure_reason, "knowledge_file_integrity_failed");
});
