const MAX_SOURCES = 20;
const MAX_SOURCE_LENGTH = 2_000;

export function normalizeKnowledgeSources(value) {
  const entries = Array.isArray(value) ? value.map((item) => typeof item === "string" ? item : item?.value) : String(value ?? "").split("\n");
  const seen = new Set();
  return entries
    .map((item) => String(item ?? "").trim())
    .filter(Boolean)
    .map((item) => item.slice(0, MAX_SOURCE_LENGTH))
    .filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_SOURCES)
    .map((value) => ({ type: /^https?:\/\//i.test(value) ? "url" : "text", value }));
}

export function formatKnowledgeSources(sources = []) {
  return sources.map((source) => source?.value).filter(Boolean).join("\n");
}
