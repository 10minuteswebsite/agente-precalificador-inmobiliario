function required(value, name) {
  if (!value) throw new Error(`meta_template_missing_${name}`);
  return value;
}

/** Provider adapter for approved WhatsApp templates; the domain supplies only neutral variables. */
export function createMetaWhatsAppTemplateSender({ accessToken, phoneNumberId, fetchImpl = fetch, apiVersion = "v23.0" } = {}) {
  return {
    async sendTemplate({ to, name, language = "es", parameters = [] }) {
      required(accessToken, "access_token");
      required(phoneNumberId, "phone_number_id");
      required(to, "recipient");
      required(name, "name");
      const response = await fetchImpl(`https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to, type: "template", template: { name, language: { code: language }, ...(parameters.length ? { components: [{ type: "body", parameters: parameters.map((text) => ({ type: "text", text: String(text) })) }] } : {}) } }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(`meta_template_failed:${body?.error?.code ?? response.status}`);
      return { id: body?.messages?.[0]?.id ?? null, raw: body };
    },
  };
}
