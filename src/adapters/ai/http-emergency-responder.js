export function createHttpEmergencyResponder({ endpoint, token, fetchImpl = fetch }) {
  if (!endpoint) throw new Error("emergency_responder_endpoint_required");
  return {
    async respond(payload) {
      const response = await fetchImpl(endpoint, { method: "POST", headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(payload) });
      if (!response.ok) throw new Error(`emergency_responder_failed:${response.status}`);
      const result = await response.json();
      return typeof result === "string" ? result : result.text;
    },
  };
}
