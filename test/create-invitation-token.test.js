import test from "node:test";
import assert from "node:assert/strict";
import { createInvitationToken } from "../src/application/create-invitation-token.js";

test("invitation token returns a one-way hash and raw token separately", () => {
  const result = createInvitationToken();
  assert.ok(result.token.length > 20);
  assert.match(result.token_hash, /^[a-f0-9]{64}$/);
  assert.notEqual(result.token, result.token_hash);
});
