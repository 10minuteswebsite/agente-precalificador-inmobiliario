import { createClient } from "@supabase/supabase-js";

export function createUserApiClient(request, env = process.env) {
  const authorization = request.headers?.authorization ?? request.headers?.Authorization;
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY || !token) return null;
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

export async function requireUser(supabase) {
  if (!supabase) throw new Error("authentication_required");
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("authentication_required");
  if (data.user.email && data.user.email_confirmed_at === null) throw new Error("email_not_verified");
  return data.user;
}
