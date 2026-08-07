export function buildWhatsAppCampaignLink({ phone = "13214503999", message, code }) {
  const cleanMessage = String(message).trim();
  const text = code ? `${cleanMessage} — ${String(code).trim().toUpperCase()}` : cleanMessage;
  return `https://wa.me/${String(phone).replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
}
