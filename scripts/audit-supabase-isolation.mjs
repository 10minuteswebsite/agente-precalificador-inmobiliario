import fs from "node:fs/promises";

const migration = await fs.readFile(new URL("../supabase/migrations/0001_router_core.sql", import.meta.url), "utf8");
const exportEndpoint = await fs.readFile(new URL("../api/lead-exports.js", import.meta.url), "utf8");
const requiredTables = ["tenants", "agents", "campaigns", "leads", "conversations", "messages", "manual_reviews", "tenant_members"];
const requiredPolicies = ["agents_member_access", "campaigns_member_access", "leads_member_access", "conversations_member_access", "messages_member_access", "manual_reviews_member_access"];

for (const table of requiredTables) {
  if (!migration.includes(`alter table public.${table} enable row level security`)) throw new Error(`rls_missing:${table}`);
}
for (const policy of requiredPolicies) {
  const start = migration.indexOf(`create policy ${policy}`);
  if (start < 0) throw new Error(`policy_missing:${policy}`);
  const body = migration.slice(start, migration.indexOf(";", start) + 1);
  if (!body.includes("auth.uid()") || !body.includes("tenant_id")) throw new Error(`policy_scope_missing:${policy}`);
}
if (migration.includes("auth.role()")) throw new Error("deprecated_auth_role_policy");
if (!exportEndpoint.includes("createUserApiClient") || !exportEndpoint.includes("requireUser")) throw new Error("export_auth_missing");
if (exportEndpoint.includes("body.tenant_id") || exportEndpoint.includes("request.query?.tenant_id")) throw new Error("export_trusts_client_tenant");
console.log("Supabase isolation audit passed: RLS, tenant policies, authenticated export, and no client tenant authorization.");
