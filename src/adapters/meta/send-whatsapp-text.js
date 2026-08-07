function required(value, name) {
  if (!value) throw new Error(`meta_sender_missing_${name}`);
  return value;
}

/** Sends a text reply through Meta Cloud API without coupling the domain to Meta. */
export function createMetaWhatsAppSender({ accessToken, phoneNumberId, fetchImpl = fetch, apiVersion = "v23.0" } = {}) {
  return {
    async sendText({ to, text }) {
      required(accessToken, "access_token");
      required(phoneNumberId, "phone_number_id");
      required(to, "recipient");
      required(text, "text");
      const response = await fetchImpl(`https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to, type: "text", text: { preview_url: false, body: text } }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(`meta_sender_failed:${body?.error?.code ?? response.status}`);
      return { id: body?.messages?.[0]?.id ?? null, raw: body };
    },
    async sendInteractive({ to, interactive }) {
      required(accessToken, "access_token");
      required(phoneNumberId, "phone_number_id");
      required(to, "recipient");
      if (!interactive || !["button", "list"].includes(interactive.type)) throw new Error("meta_sender_invalid_interactive");
      const response = await fetchImpl(`https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to, type: "interactive", interactive }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(`meta_sender_failed:${body?.error?.code ?? response.status}`);
      return { id: body?.messages?.[0]?.id ?? null, raw: body };
    },
  };
}
