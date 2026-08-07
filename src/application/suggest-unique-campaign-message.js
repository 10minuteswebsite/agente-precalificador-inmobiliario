export function normalizeCampaignMessage(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function splitMessage(message) {
  const original = String(message ?? "").trim().replace(/\s+/g, " ");
  const match = original.match(/^(.*?\b(?:sobre|de|acerca de))\s+(.+)$/i);
  if (match) return { opening: match[1].trim(), subject: match[2].trim() };
  const generic = original.replace(/^(?:hola[,!]?\s*)?(?:quiero|necesito|deseo|busco|me interesa)\s+(?:más\s+)?información\s*/i, "").trim();
  return { opening: "Quiero información sobre", subject: generic };
}

function purposeTopic(value) {
  return String(value ?? "")
    .trim()
    .replace(/^(?:vender|promocionar|anunciar|reservar|llenar|atraer|captar|conseguir|buscar)\s+(?:entradas?|lugares?|personas?|clientes?)?\s*(?:interesadas?\s+en\s+)?(?:para|en)?\s*/i, "")
    .replace(/[.!?]+$/, "")
    .trim();
}

function extractDetails(purpose, subject) {
  const cleanPurpose = purposeTopic(purpose);
  if (!cleanPurpose) return "";
  if (normalizeCampaignMessage(cleanPurpose) === normalizeCampaignMessage(subject)) return "";
  const subjectWords = String(subject).toLocaleLowerCase().split(/\s+/).filter((word) => word.length > 3);
  const overlap = subjectWords.find((word) => cleanPurpose.toLocaleLowerCase().includes(word));
  if (!overlap) return cleanPurpose;
  return cleanPurpose
    .replace(/^(?:el|la|un|una)\s+(?:taller|sesión|curso|evento)\s*/i, "")
    .trim();
}

export function suggestUniqueCampaignMessage(message, existingMessages = [], random = Math.random, context = "") {
  const original = String(message ?? "").trim().replace(/\s+/g, " ");
  const used = new Set(existingMessages.map(normalizeCampaignMessage));
  used.add(normalizeCampaignMessage(original));
  const { opening, subject: messageSubject } = splitMessage(original);
  const subject = messageSubject || purposeTopic(context);
  const details = extractDetails(context, subject);
  const composed = subject ? `${opening} ${subject}${details ? ` ${details}` : ""}`.replace(/\s+/g, " ").trim() : "";
  const candidates = (composed
    ? [
      composed,
      `${opening} ${subject}${details ? ` en ${details.replace(/^en\s+/i, "")}` : ""}`.replace(/\s+/g, " ").trim(),
      `${opening} ${subject}${details ? `, con información sobre ${details.replace(/^en\s+/i, "")}` : ""}`.replace(/\s+/g, " ").trim(),
    ]
    : ["Hola, quisiera conocer los detalles", "Me interesa descubrir más", "Quiero recibir información clara sobre esta propuesta"])
    .filter((candidate) => !used.has(normalizeCampaignMessage(candidate)));
  if (!candidates.length) return composed ? `${composed} y conocer las opciones disponibles` : "Me interesa conocer una opción diferente";
  return candidates[Math.floor(Math.max(0, Math.min(0.999999, random())) * candidates.length)];
}
