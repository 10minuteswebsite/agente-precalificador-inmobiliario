import { createClient } from "@supabase/supabase-js";

export function createAdminClient(env = process.env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function requireAdmin(request, userClient, env = process.env) {
  if (!userClient) throw new Error("authentication_required");
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) throw new Error("authentication_required");
  const allowed = [env.ADMIN_EMAILS, env.SUPER_ADMIN_EMAILS].flatMap((value) => String(value ?? "").split(",")).map((email) => email.trim().toLowerCase()).filter(Boolean);
  if (!allowed.includes(String(data.user.email ?? "").toLowerCase())) throw new Error("admin_required");
  return data.user;
}

export async function requireSuperAdmin(request, userClient, env = process.env) {
  const user = await requireAdmin(request, userClient, env);
  const configured = String(env.SUPER_ADMIN_EMAILS ?? env.ADMIN_EMAILS ?? "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean);
  if (!configured.includes(String(user.email ?? "").toLowerCase())) throw new Error("super_admin_required");
  return user;
}
