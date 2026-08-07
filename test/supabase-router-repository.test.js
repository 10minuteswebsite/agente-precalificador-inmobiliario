import test from "node:test";
import assert from "node:assert/strict";
import { createSupabaseRouterRepository } from "../src/adapters/persistence/supabase-router-repository.js";

test("requires an injected Supabase client", () => {
  assert.throws(() => createSupabaseRouterRepository(), /supabase_client_required/);
});
