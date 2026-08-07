import { createUserApiClient, requireUser } from "../src/application/create-user-api-client.js";
import { createLeadExport } from "../src/domain/leads/create-lead-export.js";

function fileName(request, format) {
  const scope = request.query?.campaign_id ? "campana" : "organizacion";
  return `leads-${scope}.${format}`;
}

export default async function leadExports(request, response) {
  if (request.method !== "GET") {
    response.statusCode = 405;
    response.setHeader?.("Allow", "GET");
    return response.end(JSON.stringify({ error: "method_not_allowed" }));
  }
  try {
    const format = request.query?.format || "csv";
    const supabase = createUserApiClient(request);
    await requireUser(supabase);
    let query = supabase.from("conversations").select("id,created_at,last_message_at,status,summary,qualification_state,custom_field_values,leads(first_name,phone,email),campaigns(id,name,code)").order("last_message_at", { ascending: false }).limit(10000);
    if (request.query?.campaign_id) query = query.eq("campaign_id", request.query.campaign_id);
    const { data, error } = await query;
    if (error) throw error;
    const exported = createLeadExport({ conversations: data ?? [], format });
    response.statusCode = 200;
    response.setHeader?.("Content-Type", exported.contentType);
    response.setHeader?.("Content-Disposition", `attachment; filename="${fileName(request, exported.extension)}"`);
    return response.end(exported.body);
  } catch (error) {
    const status = error.message === "authentication_required" ? 401 : error.message === "email_not_verified" ? 403 : error.message === "lead_export_format_invalid" ? 422 : 500;
    response.statusCode = status;
    response.setHeader?.("Content-Type", "application/json");
    return response.end(JSON.stringify({ error: status === 500 ? "lead_export_failed" : error.message }));
  }
}
