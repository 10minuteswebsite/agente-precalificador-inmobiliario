export function createHttpCampaignResolver({ endpoint, token, fetchImpl = fetch }) {
  if (!endpoint) throw new Error("campaign_resolver_endpoint_required");
  return {
    async resolve(payload) {
      const response = await fetchImpl(endpoint, { method: "POST", headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(payload) });
      if (!response.ok) throw new Error(`campaign_resolver_failed:${response.status}`);
      return response.json();
    },
  };
}
