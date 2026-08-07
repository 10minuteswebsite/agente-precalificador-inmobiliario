import { randomInt } from "node:crypto";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateCampaignCode(random = randomInt) {
  let code = "";
  for (let index = 0; index < 4; index += 1) code += ALPHABET[random(ALPHABET.length)];
  return code;
}
