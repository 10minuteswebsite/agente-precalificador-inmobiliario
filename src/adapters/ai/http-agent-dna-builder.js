/** Provider-neutral HTTP adapter for the conversational Agent DNA builder. */
export function createHttpAgentDnaBuilder({ endpoint, token, fetchImpl = fetch, timeoutMs = 20_000 } = {}) {
  if (!endpoint) throw new Error("agent_builder_not_configured");
  return async (input) => {
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`agent_builder_failed:${body?.error?.code ?? response.status}`);
    return body;
  };
}
