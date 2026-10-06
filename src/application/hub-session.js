import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createAdminClient } from "./create-admin-client.js";

export const HUB_PRODUCT_SLUG = "super-formularios";
export const ACCESS_TOKEN_COOKIE = "sb-access-token";
export const REFRESH_TOKEN_COOKIE = "sb-refresh-token";
export const SUPPORT_SESSION_COOKIE = "super-formularios-support";
const ACCESS_TOKEN_MAX_AGE = 60 * 60;
const SUPPORT_SESSION_MAX_AGE = 5 * 60;

function headerValue(request, name) {
  return request?.headers?.[name] ?? request?.headers?.[name.toLowerCase()] ?? request?.headers?.get?.(name) ?? null;
}

export function parseCookies(header = "") {
  return header.split(";").reduce((cookies, part) => {
    const separator = part.indexOf("=");
    if (separator < 1) return cookies;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (key) {
      try { cookies[key] = decodeURIComponent(value); } catch { /* Ignore malformed cookie values. */ }
    }
    return cookies;
  }, {});
}

export function accessTokenFromRequest(request) {
  const authorization = headerValue(request, "authorization");
  const bearer = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (bearer) return bearer;
  return parseCookies(headerValue(request, "cookie") ?? "")[ACCESS_TOKEN_COOKIE] ?? null;
}

export function readQuery(request, key) {
  if (request?.query && key in request.query) return String(request.query[key] ?? "");
  try {
    return new URL(request?.url ?? "http://localhost").searchParams.get(key) ?? "";
  } catch {
    return "";
  }
}

export async function exchangeHubLaunchCode({ code, fetchImpl = fetch, env = process.env }) {
  if (!/^[A-Za-z0-9_-]{40,80}$/.test(code)) throw new Error("invalid_launch_code");
  if (!env.HUB_BASE_URL || !env.SUPER_FORMULARIOS_HUB_CLIENT_ID || !env.SUPER_FORMULARIOS_HUB_CLIENT_SECRET) {
    throw new Error("hub_auth_not_configured");
  }

  const response = await fetchImpl(`${env.HUB_BASE_URL.replace(/\/$/, "")}/api/product-launch`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-platform-client-id": env.SUPER_FORMULARIOS_HUB_CLIENT_ID,
      authorization: `Bearer ${env.SUPER_FORMULARIOS_HUB_CLIENT_SECRET}`,
    },
    body: JSON.stringify({ app: HUB_PRODUCT_SLUG, code }),
  });

  if (!response.ok) throw new Error(response.status === 401 ? "launch_code_invalid_or_expired" : "hub_exchange_failed");
  const context = await response.json();
  if (
    context?.app !== HUB_PRODUCT_SLUG
    || typeof context.platform_user_id !== "string"
    || typeof context.auth0_sub !== "string"
    || typeof context.email !== "string"
  ) throw new Error("hub_context_invalid");
  return context;
}

export async function exchangeHubSupportGrant({ code, fetchImpl = fetch, env = process.env }) {
  if (!/^[A-Za-z0-9_-]{40,80}$/.test(code)) throw new Error("invalid_support_grant");
  if (!env.HUB_BASE_URL || !env.SUPER_FORMULARIOS_HUB_CLIENT_ID || !env.SUPER_FORMULARIOS_HUB_CLIENT_SECRET) {
    throw new Error("hub_auth_not_configured");
  }

  const response = await fetchImpl(`${env.HUB_BASE_URL.replace(/\/$/, "")}/api/admin/support-grants/exchange`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-platform-client-id": env.SUPER_FORMULARIOS_HUB_CLIENT_ID,
      authorization: `Bearer ${env.SUPER_FORMULARIOS_HUB_CLIENT_SECRET}`,
    },
    body: JSON.stringify({ app: HUB_PRODUCT_SLUG, code }),
  });
  if (!response.ok) throw new Error(response.status === 401 ? "support_grant_invalid_or_expired" : "hub_exchange_failed");
  const grant = await response.json();
  if (grant?.app !== HUB_PRODUCT_SLUG || grant.scope !== "read" || typeof grant.target?.platform_user_id !== "string") {
    throw new Error("support_grant_invalid");
  }
  return grant;
}

async function findProductUser(admin, context) {
  const result = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (result.error) throw result.error;
  const users = result.data?.users ?? [];
  const byHubId = users.find((user) => user.user_metadata?.hub_user_id === context.platform_user_id);
  const byEmail = users.find((user) => user.email?.toLowerCase() === context.email.toLowerCase());
  const user = byHubId ?? byEmail;

  if (user) {
    if (user.user_metadata?.hub_user_id && user.user_metadata.hub_user_id !== context.platform_user_id) {
      throw new Error("product_identity_conflict");
    }
    if (user.user_metadata?.auth0_sub && user.user_metadata.auth0_sub !== context.auth0_sub) {
      throw new Error("product_identity_conflict");
    }
    return user;
  }

  const created = await admin.auth.admin.createUser({
    email: context.email.toLowerCase(),
    email_confirm: true,
    user_metadata: {
      hub_user_id: context.platform_user_id,
      auth0_sub: context.auth0_sub,
      hub_role: context.platform_role,
      hub_entitlement_status: context.entitlement_status,
    },
  });
  if (created.error || !created.data.user) throw created.error ?? new Error("product_user_provision_failed");
  return created.data.user;
}

export async function createProductSession(context, { env = process.env, admin = createAdminClient(env), clientFactory = createClient } = {}) {
  if (!admin || !env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) throw new Error("product_auth_not_configured");
  const user = await findProductUser(admin, context);
  const sessionEmail = user.email?.toLowerCase() ?? context.email.toLowerCase();
  const metadata = {
    ...(user.user_metadata ?? {}),
    hub_user_id: context.platform_user_id,
    auth0_sub: context.auth0_sub,
    hub_role: context.platform_role,
    hub_entitlement_status: context.entitlement_status,
  };
  const updated = await admin.auth.admin.updateUserById(user.id, { user_metadata: metadata, email_confirm: true });
  if (updated.error) throw updated.error;

  const link = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: sessionEmail,
    options: { redirectTo: `${env.PRODUCT_BASE_URL ?? "https://formularios.lasolucionweb.net"}/` },
  });
  if (link.error || !link.data?.properties?.hashed_token) throw link.error ?? new Error("product_session_link_failed");

  const client = clientFactory(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const verified = await client.auth.verifyOtp({ type: "magiclink", token_hash: link.data.properties.hashed_token });
  if (verified.error || !verified.data.session) throw verified.error ?? new Error("product_session_failed");
  return verified.data.session;
}

export function serializeSessionCookies(session) {
  const common = `HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${ACCESS_TOKEN_MAX_AGE}`;
  return [
    `${ACCESS_TOKEN_COOKIE}=${encodeURIComponent(session.access_token)}; ${common}`,
    `${REFRESH_TOKEN_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`,
  ];
}

export function clearSessionCookies() {
  return [
    `${ACCESS_TOKEN_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`,
    `${REFRESH_TOKEN_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`,
  ];
}

function encodeJson(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function sign(value, secret) {
  return crypto.createHmac("sha256", secret).update(value).digest("base64url");
}

export function createSupportSessionCookie({ targetUserId, tenantId, grantId, expiresAt }, secret) {
  if (!secret) throw new Error("support_session_not_configured");
  const payload = encodeJson({ target_user_id: targetUserId, tenant_id: tenantId, grant_id: grantId, expires_at: expiresAt });
  return `${payload}.${sign(payload, secret)}`;
}

export function readSupportSessionCookie(value, secret) {
  if (!value || !secret) return null;
  const [payload, suppliedSignature] = String(value).split(".");
  if (!payload || !suppliedSignature) return null;
  const expectedSignature = sign(payload, secret);
  const expected = Buffer.from(expectedSignature);
  const supplied = Buffer.from(suppliedSignature);
  if (expected.length !== supplied.length || !crypto.timingSafeEqual(expected, supplied)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!session.expires_at || new Date(session.expires_at).getTime() <= Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

export function serializeSupportSessionCookie(value) {
  return `${SUPPORT_SESSION_COOKIE}=${encodeURIComponent(value)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SUPPORT_SESSION_MAX_AGE}`;
}

export function clearSupportSessionCookie() {
  return `${SUPPORT_SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}
