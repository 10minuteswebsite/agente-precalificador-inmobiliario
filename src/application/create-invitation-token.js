import { createHash, randomBytes } from "node:crypto";

export function createInvitationToken() {
  const token = randomBytes(24).toString("base64url");
  return { token, token_hash: createHash("sha256").update(token).digest("hex") };
}
