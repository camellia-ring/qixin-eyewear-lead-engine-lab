export const SCORE_LIMITS = Object.freeze({
  customerTypeScore: 20,
  productFitScore: 20,
  marketPriorityScore: 10,
  buyingSignalScore: 15,
  wholesaleOemScore: 10,
  contactQualityScore: 10,
  evidenceQualityScore: 10,
  recentSignalScore: 5,
});

export type ScoreField = keyof typeof SCORE_LIMITS;

export const REVIEW_STATUSES = new Set(["new", "needs_research", "ready_for_review", "approved", "rejected"]);
export const CAMPAIGN_STATUSES = new Set(["draft", "active", "paused", "completed"]);
export const PRODUCT_TRACKS = new Set(["optical_lenses", "safety_lenses"]);

export function boundedScore(value: unknown, max: number) {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number) || number < 0 || number > max) {
    throw new Error(`score must be between 0 and ${max}`);
  }
  return Math.round(number);
}

export function calculateScore(record: Record<string, unknown>) {
  const breakdown = Object.fromEntries(
    Object.entries(SCORE_LIMITS).map(([field, max]) => [field, boundedScore(record[field], max)]),
  ) as Record<ScoreField, number>;
  const total = Object.values(breakdown).reduce((sum, value) => sum + value, 0);
  return { breakdown, total, grade: total >= 75 ? "A" : total >= 60 ? "B" : "C" };
}

export function normalizeWebsite(value: unknown) {
  const source = String(value ?? "").trim();
  if (!source) return { original: "", normalized: "" };
  const candidate = /^https?:\/\//i.test(source) ? source : `https://${source}`;
  const url = new URL(candidate);
  if (!new Set(["http:", "https:"]).has(url.protocol)) throw new Error("website must use http or https");
  return {
    original: url.toString().replace(/\/$/, ""),
    normalized: url.hostname.toLowerCase().replace(/^www\./, ""),
  };
}

export function normalizeSourceUrl(value: unknown) {
  const source = String(value ?? "").trim();
  if (!source) return "";
  const url = new URL(source);
  if (!new Set(["http:", "https:"]).has(url.protocol)) throw new Error("source URL must use http or https");
  return url.toString();
}

export function identityKey(companyName: unknown, country: unknown, websiteNormalized: string) {
  if (websiteNormalized) return `domain:${websiteNormalized}`;
  const text = `${String(companyName ?? "").trim()}|${String(country ?? "").trim()}`
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}|]+/gu, "-");
  return `company:${text}`;
}

export function crmProductInterests(productTrack: string) {
  return productTrack === "safety_lenses"
    ? "Protective eyewear; Optical lenses"
    : "Optical lenses";
}

export function csvCell(value: unknown) {
  let text = String(value ?? "");
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

