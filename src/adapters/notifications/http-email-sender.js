export function createHttpEmailSender({ endpoint, token, fetchImpl = fetch, timeoutMs = 20_000 } = {}) {
  if (!endpoint) throw new Error("email_sender_not_configured");
  return {
    async send(payload) {
      const response = await fetchImpl(endpoint, { method: "POST", headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(payload), signal: AbortSignal.timeout(timeoutMs) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(`email_sender_failed:${body?.error?.code ?? response.status}`);
      return body;
    },
  };
}
