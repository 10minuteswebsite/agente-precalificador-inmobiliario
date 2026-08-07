export function createHttpConversationSummarizer({ endpoint, token, fetchImpl = fetch }) {
  if (!endpoint) throw new Error("summary_endpoint_required");
  return {
    async update(payload) {
      const response = await fetchImpl(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(`summary_service_failed:${response.status}`);
      const result = await response.json();
      return typeof result === "string" ? result : result.summary;
    },
  };
}
