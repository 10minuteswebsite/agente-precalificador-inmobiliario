import { clearSupportSessionCookie } from "../../src/application/hub-session.js";

export default function supportLogout(request, response) {
  if (request.method !== "GET" && request.method !== "POST") {
    response.statusCode = 405;
    return response.end();
  }
  response.statusCode = 303;
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Set-Cookie", clearSupportSessionCookie());
  response.setHeader("Location", "/");
  response.end();
}
