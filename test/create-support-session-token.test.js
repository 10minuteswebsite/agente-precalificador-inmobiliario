import test from "node:test";
import assert from "node:assert/strict";
import { createSupportSessionToken, hashSupportSessionToken } from "../src/application/create-support-session-token.js";

test("support session tokens are opaque and only their hash is reusable", () => {
  const created = createSupportSessionToken();
  assert.match(created.token, /^[A-Za-z0-9_-]+$/);
  assert.notEqual(created.token, created.token_hash);
  assert.equal(hashSupportSessionToken(created.token), created.token_hash);
  assert.equal(hashSupportSessionToken("short"), null);
});
