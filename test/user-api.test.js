import test from "node:test";
import assert from "node:assert/strict";
import { createUserApiClient, requireUser } from "../src/application/create-user-api-client.js";
import { parseBody } from "../src/application/http.js";

test("user API refuses missing bearer token", () => {
  assert.equal(createUserApiClient({ headers: {} }, { SUPABASE_URL: "x", SUPABASE_ANON_KEY: "y" }), null);
});

test("user API validates the authenticated user", async () => {
  await assert.rejects(() => requireUser(null), /authentication_required/);
  const user = await requireUser({ auth: { getUser: async () => ({ data: { user: { id: "u1" } }, error: null }) } });
  assert.equal(user.id, "u1");
});

test("user API refuses an explicitly unverified email", async () => {
  await assert.rejects(() => requireUser({ auth: { getUser: async () => ({ data: { user: { id: "u1", email: "lead@example.com", email_confirmed_at: null } }, error: null }) } }), /email_not_verified/);
});

test("HTTP body parser accepts object and JSON string", () => {
  assert.deepEqual(parseBody({ body: { name: "A" } }), { name: "A" });
  assert.deepEqual(parseBody({ body: '{"name":"A"}' }), { name: "A" });
  assert.throws(() => parseBody({ body: "{" }), /invalid_json/);
});
