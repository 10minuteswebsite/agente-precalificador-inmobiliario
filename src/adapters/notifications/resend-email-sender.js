export function createResendEmailSender({ apiKey, from, fetchImpl = fetch, timeoutMs = 20_000 } = {}) {
  if (!apiKey || !from) throw new Error("email_sender_not_configured");
  return {
    async send(payload) {
      const response = await fetchImpl("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
          ...(payload.idempotency_key ? { "idempotency-key": payload.idempotency_key } : {}),
        },
        body: JSON.stringify({ from, to: payload.to, subject: payload.subject, text: payload.text }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(`email_sender_failed:${body?.name ?? body?.error?.code ?? response.status}`);
      return body;
    },
  };
}

