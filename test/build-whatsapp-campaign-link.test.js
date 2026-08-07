import test from "node:test";
import assert from "node:assert/strict";
import { buildWhatsAppCampaignLink } from "../src/application/build-whatsapp-campaign-link.js";

test("builds a shareable WhatsApp campaign link without exposing a technical code", () => {
  const link = buildWhatsAppCampaignLink({ phone: "+1 321 450 3999", message: "Quiero información" });
  assert.equal(link, "https://wa.me/13214503999?text=Quiero%20informaci%C3%B3n");
});

test("keeps legacy code links compatible", () => {
  const link = buildWhatsAppCampaignLink({ phone: "+1 321 450 3999", message: "Quiero información", code: "ab12" });
  assert.equal(link, "https://wa.me/13214503999?text=Quiero%20informaci%C3%B3n%20%E2%80%94%20AB12");
});
