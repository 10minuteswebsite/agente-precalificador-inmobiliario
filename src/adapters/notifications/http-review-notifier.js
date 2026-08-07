export function createHttpReviewNotifier({ endpoint, token, fetchImpl = fetch }) {
  if (!endpoint) throw new Error("review_notifier_endpoint_required");
  return {
    async notify(payload) {
      const response = await fetchImpl(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(`review_notifier_failed:${response.status}`);
      return response.json().catch(() => ({}));
    },
  };
}
