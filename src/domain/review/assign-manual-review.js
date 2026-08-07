export function assignManualReview(review, campaignId, confirmed = false) {
  if (review.status === "assigned" || review.assigned_campaign_id) {
    return { status: "rejected", reason: "review_already_assigned" };
  }
  if (!campaignId) return { status: "rejected", reason: "campaign_required" };
  if (!confirmed) return { status: "confirmation_required", campaign_id: campaignId };
  return {
    ...review,
    status: "assigned",
    assigned_campaign_id: campaignId,
    assigned_at: new Date().toISOString(),
  };
}
