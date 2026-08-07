/**
 * Notifies the internal team that a lead needs ownership review.
 * Providers (email, Slack, etc.) stay outside the routing domain.
 */
export function createReviewNotifier({ notify }) {
  if (typeof notify !== "function") throw new Error("review_notifier_required");
  return { notify };
}
