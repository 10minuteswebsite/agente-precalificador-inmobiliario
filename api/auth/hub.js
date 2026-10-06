import { exchangeHubLaunchCode, createProductSession, HUB_PRODUCT_SLUG, readQuery, serializeSessionCookies } from "../../src/application/hub-session.js";
import { sendJson } from "../../src/application/http.js";

export default async function hubAuth(request, response) {
  if (request.method !== "GET") return sendJson(response, 405, { error: "method_not_allowed" });
  const app = readQuery(request, "app");
  const code = readQuery(request, "code");
  if (app !== HUB_PRODUCT_SLUG || !code) return sendJson(response, 400, { error: "invalid_hub_callback" });

  try {
    const context = await exchangeHubLaunchCode({ code });
    const session = await createProductSession(context);
    response.statusCode = 303;
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Referrer-Policy", "no-referrer");
    response.setHeader("Set-Cookie", serializeSessionCookies(session));
    response.setHeader("Location", "/");
    response.end();
  } catch (error) {
    const known = new Set(["invalid_launch_code", "launch_code_invalid_or_expired", "hub_context_invalid", "product_identity_conflict"]);
    const status = known.has(error.message) ? 401 : error.message === "hub_auth_not_configured" || error.message === "product_auth_not_configured" ? 503 : 500;
    return sendJson(response, status, { error: status === 500 ? "hub_authentication_failed" : error.message });
  }
}
