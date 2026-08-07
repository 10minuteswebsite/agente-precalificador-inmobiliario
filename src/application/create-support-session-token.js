import crypto from "node:crypto";

export function createSupportSessionToken(bytes = 32) {
  const token = crypto.randomBytes(bytes).toString("base64url");
  const token_hash = crypto.createHash("sha256").update(token).digest("hex");
  return { token, token_hash };
}

export function hashSupportSessionToken(token) {
  if (typeof token !== "string" || token.length < 20) return null;
  return crypto.createHash("sha256").update(token).digest("hex");
}
