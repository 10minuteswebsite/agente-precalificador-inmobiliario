import assert from "node:assert/strict";
import test from "node:test";
import {
  accessTokenFromRequest,
  createProductSession,
  createSupportSessionCookie,
  exchangeHubSupportGrant,
  exchangeHubLaunchCode,
  parseCookies,
  readSupportSessionCookie,
  serializeSessionCookies,
} from "../src/application/hub-session.js";

test("reads the Hub session token from the authorization header before cookies", () => {
  assert.deepEqual(parseCookies("sb-access-token=from-cookie; theme=light"), {
    "sb-access-token": "from-cookie",
    theme: "light",
  });
  assert.equal(accessTokenFromRequest({ headers: { authorization: "Bearer from-header", cookie: "sb-access-token=from-cookie" } }), "from-header");
  assert.equal(accessTokenFromRequest({ headers: { cookie: "sb-access-token=from-cookie" } }), "from-cookie");
});

test("exchanges a launch code only for the fixed product slug", async () => {
  let request;
  const context = { app: "super-formularios", platform_user_id: "user-1", auth0_sub: "auth0|user-1", email: "user@example.com" };
  const result = await exchangeHubLaunchCode({
    code: "a".repeat(48),
    env: { HUB_BASE_URL: "https://hub.lasolucionweb.net", SUPER_FORMULARIOS_HUB_CLIENT_ID: "id", SUPER_FORMULARIOS_HUB_CLIENT_SECRET: "secret" },
    fetchImpl: async (url, options) => {
      request = { url, options };
      return { ok: true, status: 200, json: async () => context };
    },
  });

  assert.deepEqual(result, context);
  assert.equal(request.url, "https://hub.lasolucionweb.net/api/product-launch");
  assert.equal(request.options.headers["x-platform-client-id"], "id");
  assert.match(request.options.headers.authorization, /^Bearer secret$/);
  assert.deepEqual(JSON.parse(request.options.body), { app: "super-formularios", code: "a".repeat(48) });
});

test("creates a local Supabase session without changing product business data", async () => {
  const calls = [];
  const admin = {
    auth: {
      admin: {
        listUsers: async () => ({ data: { users: [{ id: "local-1", email: "user@example.com", user_metadata: {} }] } }),
        updateUserById: async (id, input) => { calls.push(["update", id, input]); return { data: { user: { id } }, error: null }; },
        generateLink: async (input) => { calls.push(["link", input]); return { data: { properties: { hashed_token: "hash" } }, error: null }; },
      },
    },
  };
  const session = await createProductSession(
    { platform_user_id: "hub-1", auth0_sub: "auth0|1", email: "user@example.com", platform_role: "customer", entitlement_status: "active" },
    {
      env: { SUPABASE_URL: "https://db.example", SUPABASE_ANON_KEY: "anon", PRODUCT_BASE_URL: "https://formularios.lasolucionweb.net" },
      admin,
      clientFactory: () => ({ auth: { verifyOtp: async (input) => ({ data: { session: { access_token: "access-token" } }, error: null, input }) } }),
    },
  );

  assert.equal(session.access_token, "access-token");
  assert.equal(calls[0][0], "update");
  assert.equal(calls[0][2].user_metadata.hub_user_id, "hub-1");
  assert.equal(calls[1][0], "link");
});

test("session cookies are HttpOnly, Secure, SameSite=Lax and short-lived", () => {
  const cookies = serializeSessionCookies({ access_token: "opaque-access-token" });
  assert.equal(cookies.length, 2);
  assert.match(cookies[0], /^sb-access-token=opaque-access-token;/);
  assert.match(cookies[0], /HttpOnly/);
  assert.match(cookies[0], /Secure/);
  assert.match(cookies[0], /SameSite=Lax/);
  assert.match(cookies[0], /Max-Age=3600/);
  assert.match(cookies[1], /Max-Age=0/);
});

test("accepts only a read-only support grant for the fixed product", async () => {
  let body;
  const result = await exchangeHubSupportGrant({
    code: "b".repeat(48),
    env: { HUB_BASE_URL: "https://hub.lasolucionweb.net", SUPER_FORMULARIOS_HUB_CLIENT_ID: "id", SUPER_FORMULARIOS_HUB_CLIENT_SECRET: "secret" },
    fetchImpl: async (_url, options) => {
      body = JSON.parse(options.body);
      return { ok: true, status: 200, json: async () => ({ app: "super-formularios", scope: "read", grant_id: "grant-1", expires_at: new Date(Date.now() + 60_000).toISOString(), target: { platform_user_id: "user-1", email: "user@example.com" } }) };
    },
  });
  assert.equal(result.scope, "read");
  assert.deepEqual(body, { app: "super-formularios", code: "b".repeat(48) });
});

test("signs and validates a five-minute read-only support session", () => {
  const expiresAt = new Date(Date.now() + 60_000).toISOString();
  const value = createSupportSessionCookie({ targetUserId: "local-1", tenantId: "tenant-1", grantId: "grant-1", expiresAt }, "test-secret");
  assert.deepEqual(readSupportSessionCookie(value, "test-secret"), { target_user_id: "local-1", tenant_id: "tenant-1", grant_id: "grant-1", expires_at: expiresAt });
  assert.equal(readSupportSessionCookie(`${value}x`, "test-secret"), null);
  assert.equal(readSupportSessionCookie(value, "wrong-secret"), null);
});
