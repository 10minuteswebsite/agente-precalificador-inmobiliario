const CODE_PATTERN = /(?:[—-]\s*)([A-Z0-9]{4})(?=$|[\s.,!?—-])/i;
const normalizeText = (value) => value.trim().replace(/\s+/g, " ").toLocaleLowerCase();

export function resolveCampaign(message, campaigns) {
  const code = message.match(CODE_PATTERN)?.[1]?.toUpperCase();
  if (code) {
    const campaign = campaigns.find((item) => item.code === code);
    if (campaign) return { status: "resolved", method: "code", campaign };
  }
  const exact = campaigns.filter((item) => normalizeText(item.message) === normalizeText(message));
  if (exact.length === 1) return { status: "resolved", method: "exact_message", campaign: exact[0] };
  return { status: "manual_review", reason: exact.length > 1 ? "duplicate_message" : "campaign_not_resolved" };
}
