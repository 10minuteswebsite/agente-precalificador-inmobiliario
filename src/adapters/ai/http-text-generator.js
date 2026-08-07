/** Provider-neutral HTTP bridge for an approved agent service. */
export function createHttpTextGenerator({ endpoint, token, fetchImpl = fetch } = {}) {
  return async (input) => {
    if (!endpoint) throw new Error("agent_generator_endpoint_required");
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(input),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(`agent_generator_failed:${body?.error?.code ?? response.status}`);
    return body;
  };
}
