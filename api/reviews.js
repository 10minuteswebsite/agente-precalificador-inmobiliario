import { createUserApiClient } from "../src/application/create-user-api-client.js";
import { createAdminClient, requireAdmin } from "../src/application/create-admin-client.js";
import { assignManualReview } from "../src/domain/review/assign-manual-review.js";
import { parseBody, sendJson } from "../src/application/http.js";

export default async function reviews(request, response) {
  if (!["GET", "PATCH"].includes(request.method)) return sendJson(response, 405, { error: "method_not_allowed" });
  try {
    const userClient = createUserApiClient(request);
    await requireAdmin(request, userClient);
    const admin = createAdminClient();
    if (!admin) throw new Error("persistence_not_configured");
    if (request.method === "GET") {
      const { data, error } = await admin.from("manual_reviews").select("*, leads(*), campaigns(*)").eq("status", "open").order("created_at", { ascending: true });
      if (error) throw error;
      return sendJson(response, 200, { reviews: data ?? [] });
    }
    const body = parseBody(request);
    if (!body.review_id) return sendJson(response, 422, { error: "review_id_required" });
    const { data: review, error: lookupError } = await admin.from("manual_reviews").select("*").eq("id", body.review_id).single();
    if (lookupError) throw lookupError;
    const assigned = assignManualReview(review, body.campaign_id, body.confirmed === true);
    if (assigned.status === "confirmation_required") return sendJson(response, 409, assigned);
    if (assigned.status === "rejected") return sendJson(response, 409, assigned);
    const { data: existingConversation, error: conversationLookupError } = await admin.from("conversations").select("id").eq("lead_id", review.lead_id).eq("campaign_id", assigned.assigned_campaign_id).maybeSingle();
    if (conversationLookupError) throw conversationLookupError;
    let conversation = existingConversation;
    if (!conversation) {
      const created = await admin.from("conversations").insert({ lead_id: review.lead_id, campaign_id: assigned.assigned_campaign_id, status: "active" }).select("id").single();
      if (created.error) throw created.error;
      conversation = created.data;
    }
    const { data, error } = await admin.from("manual_reviews").update({ status: "assigned", assigned_campaign_id: assigned.assigned_campaign_id, assigned_at: assigned.assigned_at, conversation_id: conversation.id }).eq("id", body.review_id).select().single();
    if (error) throw error;
    return sendJson(response, 200, { review: data });
  } catch (error) {
    const status = error.message === "authentication_required" ? 401 : error.message === "email_not_verified" ? 403 : error.message === "admin_required" ? 403 : error.message === "invalid_json" ? 400 : error.message === "persistence_not_configured" ? 503 : 500;
    return sendJson(response, status, { error: status === 500 ? "request_failed" : error.message });
  }
}
