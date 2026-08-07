export function parseBody(request) {
  if (!request.body) return {};
  if (typeof request.body === "object") return request.body;
  try { return JSON.parse(request.body); } catch { throw new Error("invalid_json"); }
}

export function sendJson(response, status, body) {
  response.statusCode = status;
  response.setHeader?.("Content-Type", "application/json");
  response.end(JSON.stringify(body));
}
