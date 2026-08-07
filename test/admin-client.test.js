import test from "node:test";
import assert from "node:assert/strict";
import { createAdminClient, requireAdmin, requireSuperAdmin } from "../src/application/create-admin-client.js";

test("admin client stays disabled without service credentials", () => {
  assert.equal(createAdminClient({ SUPABASE_URL: "x" }), null);
});

test("admin authorization checks configured email", async () => {
  const client = { auth: { getUser: async () => ({ data: { user: { email: "admin@example.com" } }, error: null }) } };
  await requireAdmin({}, client, { ADMIN_EMAILS: "admin@example.com" });
  await assert.rejects(() => requireAdmin({}, client, { ADMIN_EMAILS: "other@example.com" }), /admin_required/);
});

test("super administrator access is explicit and falls back to existing admin allowlist", async () => {
  const client = { auth: { getUser: async () => ({ data: { user: { email: "owner@example.com" } }, error: null }) } };
  await requireSuperAdmin({}, client, { ADMIN_EMAILS: "owner@example.com" });
  await assert.rejects(() => requireSuperAdmin({}, client, { ADMIN_EMAILS: "owner@example.com", SUPER_ADMIN_EMAILS: "other@example.com" }), /super_admin_required/);
});

test("super administrators remain visible to existing admin modules", async () => {
  const client = { auth: { getUser: async () => ({ data: { user: { email: "owner@example.com" } }, error: null }) } };
  await requireAdmin({}, client, { SUPER_ADMIN_EMAILS: "owner@example.com" });
});
