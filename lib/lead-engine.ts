export const RUBRIC_VERSION = "qixin-v1.1";

export const SCORE_LIMITS = Object.freeze({
  productMatchScore: 25,
  customerTypeScore: 20,
  purchasingSignalsScore: 15,
  marketMoqFitScore: 15,
  contactabilityScore: 10,
  accountPotentialScore: 10,
  dataQualityScore: 5,
});

export const SCORE_REASON_FIELDS = Object.freeze({
  productMatchScore: ["productMatchPositiveReason", "productMatchNegativeReason"],
  customerTypeScore: ["customerTypePositiveReason", "customerTypeNegativeReason"],
  purchasingSignalsScore: ["purchasingSignalsPositiveReason", "purchasingSignalsNegativeReason"],
  marketMoqFitScore: ["marketMoqFitPositiveReason", "marketMoqFitNegativeReason"],
  contactabilityScore: ["contactabilityPositiveReason", "contactabilityNegativeReason"],
  accountPotentialScore: ["accountPotentialPositiveReason", "accountPotentialNegativeReason"],
  dataQualityScore: ["dataQualityPositiveReason", "dataQualityNegativeReason"],
});

export type ScoreField = keyof typeof SCORE_LIMITS;
export type Confidence = "low" | "medium" | "high";
export type HardGateStatus = "pass" | "fail" | "needs_review";

export const WORKFLOW_STATUSES = new Set(["discovered", "analyzed", "qualified", "needs_review", "approved", "rejected"]);
export const REVIEW_DECISIONS = new Set(["needs_review", "approved", "rejected"]);
export const CAMPAIGN_STATUSES = new Set(["draft", "active", "paused", "completed"]);
export const PRODUCT_TRACK_DEFINITIONS = Object.freeze({
  optical_frames: { crm: ["Optical frames"], search: ["optical frames", "eyeglass frames", "spectacle frames"] },
  sunglasses: { crm: ["Sunglasses"], search: ["sunglasses", "sun eyewear", "fashion sunglasses"] },
  reading_glasses: { crm: ["Reading glasses"], search: ["reading glasses", "readers eyewear", "ready readers"] },
  blue_light_glasses: { crm: ["Blue light glasses"], search: ["blue light glasses", "computer glasses", "screen eyewear"] },
  kids_eyewear: { crm: ["Kids eyewear"], search: ["kids eyewear", "children's glasses", "children's optical frames"] },
  sports_eyewear: { crm: ["Sports eyewear"], search: ["sports eyewear", "performance sunglasses", "cycling glasses"] },
  protective_eyewear: { crm: ["Protective eyewear"], search: ["protective eyewear", "safety glasses", "industrial eye protection"] },
  optical_lenses: { crm: ["Optical lenses"], search: ["optical lenses", "ophthalmic lenses", "prescription lenses"] },
  // Retained for existing V0/V1 campaigns; new campaigns should use protective_eyewear.
  safety_lenses: { crm: ["Protective eyewear", "Optical lenses"], search: ["safety lenses", "protective lenses", "industrial eye protection"] },
});

export type ProductTrack = keyof typeof PRODUCT_TRACK_DEFINITIONS;
export const PRODUCT_TRACKS = new Set(Object.keys(PRODUCT_TRACK_DEFINITIONS));
export const CONFIDENCE_LEVELS = new Set(["low", "medium", "high"]);
export const HARD_GATE_STATUSES = new Set(["pass", "fail", "needs_review"]);

export const DEFAULT_CUSTOMER_TYPES = ["Importer", "Distributor", "Wholesaler", "Eyewear Brand", "Private Label Brand"];
export const DEFAULT_EXCLUSIONS = [
  "普通单体零售店",
  "医院或眼科诊所",
  "新闻网站或行业协会",
  "与眼镜无关的公司",
  "中国供应商或直接竞争工厂",
  "已拒绝、退订或禁止联系",
];

const COUNTRY_SEARCH_PROFILES: Array<{
  match: RegExp;
  market: string;
  locale: string;
  types: string[];
  products: Partial<Record<ProductTrack, string[]>>;
}> = [
  { match: /germany|deutschland|\bde\b/i, market: "Deutschland", locale: "de", types: ["Großhändler", "Importeur", "Distributor", "Brillenmarke"], products: {
    optical_frames: ["Brillenfassungen", "Brillengestelle"], sunglasses: ["Sonnenbrillen"], reading_glasses: ["Lesebrillen"],
    blue_light_glasses: ["Blaulichtfilterbrillen"], kids_eyewear: ["Kinderbrillen"], sports_eyewear: ["Sportbrillen"],
    protective_eyewear: ["Schutzbrillen"], optical_lenses: ["Brillengläser", "optische Linsen"], safety_lenses: ["Schutzbrillen", "Sicherheitsgläser"],
  } },
  { match: /spain|españa|\bes\b/i, market: "España", locale: "es", types: ["mayorista", "importador", "distribuidor", "marca de gafas"], products: {
    optical_frames: ["monturas ópticas", "monturas de gafas"], sunglasses: ["gafas de sol"], reading_glasses: ["gafas de lectura"],
    blue_light_glasses: ["gafas para luz azul"], kids_eyewear: ["gafas infantiles"], sports_eyewear: ["gafas deportivas"],
    protective_eyewear: ["gafas de seguridad"], optical_lenses: ["lentes oftálmicas", "lentes ópticas"], safety_lenses: ["gafas de seguridad", "lentes protectoras"],
  } },
  { match: /poland|polska|\bpl\b/i, market: "Polska", locale: "pl", types: ["hurtownia", "importer", "dystrybutor", "marka okularów"], products: {
    optical_frames: ["oprawki okularowe"], sunglasses: ["okulary przeciwsłoneczne"], reading_glasses: ["okulary do czytania"],
    blue_light_glasses: ["okulary blokujące światło niebieskie"], kids_eyewear: ["okulary dziecięce"], sports_eyewear: ["okulary sportowe"],
    protective_eyewear: ["okulary ochronne"], optical_lenses: ["soczewki okularowe", "soczewki optyczne"], safety_lenses: ["okulary ochronne", "soczewki ochronne"],
  } },
  { match: /saudi|uae|emirates|arabia|السعودية|الإمارات/i, market: "الشرق الأوسط", locale: "ar", types: ["مستورد نظارات", "موزع نظارات", "تاجر جملة نظارات"], products: {
    optical_frames: ["إطارات نظارات طبية"], sunglasses: ["نظارات شمسية"], reading_glasses: ["نظارات قراءة"],
    blue_light_glasses: ["نظارات حجب الضوء الأزرق"], kids_eyewear: ["نظارات أطفال"], sports_eyewear: ["نظارات رياضية"],
    protective_eyewear: ["نظارات واقية"], optical_lenses: ["عدسات بصرية", "عدسات طبية"], safety_lenses: ["نظارات واقية", "عدسات حماية"],
  } },
  { match: /united kingdom|great britain|england|\buk\b|\bgb\b/i, market: "United Kingdom", locale: "en", types: ["wholesaler", "importer", "distributor", "eyewear brand"], products: Object.fromEntries(
    Object.entries(PRODUCT_TRACK_DEFINITIONS).map(([track, definition]) => [track, definition.search]),
  ) as Record<ProductTrack, string[]> },
];

export function boundedScore(value: unknown, max: number) {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number) || number < 0 || number > max) {
    throw new Error(`score must be between 0 and ${max}`);
  }
  return Math.round(number);
}

export function boundedPercent(value: unknown, field: string) {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number) || number < 0 || number > 100) throw new Error(`${field} must be between 0 and 100`);
  return Math.round(number);
}

export function gradeFor(total: number, confidence: Confidence, hardGateStatus: HardGateStatus) {
  if (hardGateStatus === "fail") return "Reject";
  if (total >= 85 && confidence === "high") return "S";
  if (total >= 75) return "A";
  if (total >= 60) return "B";
  return "C";
}

export function calculateScore(record: Record<string, unknown>) {
  const breakdown = Object.fromEntries(
    Object.entries(SCORE_LIMITS).map(([field, max]) => [field, boundedScore(record[field], max)]),
  ) as Record<ScoreField, number>;
  const total = Object.values(breakdown).reduce((sum, value) => sum + value, 0);
  const confidence = String(record.scoreConfidence || "low") as Confidence;
  const hardGateStatus = String(record.hardGateStatus || "needs_review") as HardGateStatus;
  if (!CONFIDENCE_LEVELS.has(confidence)) throw new Error("invalid score confidence");
  if (!HARD_GATE_STATUSES.has(hardGateStatus)) throw new Error("invalid hard gate status");
  const evidenceCoverage = boundedPercent(record.evidenceCoverage, "evidenceCoverage");
  return { breakdown, total, grade: gradeFor(total, confidence, hardGateStatus), confidence, evidenceCoverage, hardGateStatus };
}

export function normalizeWebsite(value: unknown) {
  const source = String(value ?? "").trim();
  if (!source) return { original: "", normalized: "" };
  const candidate = /^https?:\/\//i.test(source) ? source : `https://${source}`;
  const url = new URL(candidate);
  if (!new Set(["http:", "https:"]).has(url.protocol)) throw new Error("website must use http or https");
  url.hash = "";
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
  url.hash = "";
  return url.toString();
}

export function canonicalSourceUrl(value: unknown) {
  const normalized = normalizeSourceUrl(value);
  if (!normalized) return "";
  const url = new URL(normalized);
  for (const key of [...url.searchParams.keys()]) {
    if (/^(utm_|gclid|fbclid|ref$)/i.test(key)) url.searchParams.delete(key);
  }
  url.searchParams.sort();
  return url.toString().replace(/\/$/, "");
}

export function normalizeCompanyName(value: unknown) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/\b(gmbh|ltd|limited|inc|llc|corp|corporation|company|co|sarl|s\.a\.?|b\.v\.?|spa|oy)\b/gi, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function companyNamesLikelySame(left: unknown, right: unknown) {
  const ignored = new Set(["optical", "optics", "eyewear", "glasses", "lens", "lenses", "group", "brand"]);
  const leftTokens = new Set(normalizeCompanyName(left).split(/\s+/).filter((token) => token.length >= 3 && !ignored.has(token)));
  const rightTokens = new Set(normalizeCompanyName(right).split(/\s+/).filter((token) => token.length >= 3 && !ignored.has(token)));
  if (!leftTokens.size || !rightTokens.size) return false;
  const intersection = [...leftTokens].filter((token) => rightTokens.has(token));
  return intersection.length / Math.min(leftTokens.size, rightTokens.size) >= 0.6;
}

export function identityKey(companyName: unknown, country: unknown, websiteNormalized: string) {
  const name = normalizeCompanyName(companyName);
  const market = String(country ?? "").normalize("NFKC").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-");
  return websiteNormalized
    ? `entity:${websiteNormalized}|${name}`
    : `entity:${name}|${market}`;
}

export function stringList(value: unknown, max = 30) {
  const values = Array.isArray(value)
    ? value
    : String(value ?? "").split(/[;|,\n]/);
  return [...new Set(values.map((item) => String(item).trim()).filter(Boolean))].slice(0, max);
}

export function safeJsonList(value: unknown, fallback: string[] = []) {
  if (Array.isArray(value)) return stringList(value);
  const source = String(value ?? "").trim();
  if (!source) return fallback;
  if (source.startsWith("[")) {
    try {
      const parsed = JSON.parse(source);
      return Array.isArray(parsed) ? stringList(parsed) : fallback;
    } catch {
      return stringList(source);
    }
  }
  return stringList(source);
}

function productSearchTerms(productTrack: string, productTypes: string[]) {
  if (productTypes.length) return productTypes;
  return PRODUCT_TRACK_DEFINITIONS[productTrack as ProductTrack]?.search || ["eyewear"];
}

export function buildSearchKeywords(campaign: {
  productTrack: string;
  targetMarkets?: string | null;
  targetCountriesJson?: string | null;
  productTypesJson?: string | null;
  customerTypesJson?: string | null;
}) {
  const countries = safeJsonList(campaign.targetCountriesJson, stringList(campaign.targetMarkets));
  const markets = countries.length ? countries : [campaign.targetMarkets || "target market"];
  const products = productSearchTerms(campaign.productTrack, safeJsonList(campaign.productTypesJson));
  const customerTypes = safeJsonList(campaign.customerTypesJson, DEFAULT_CUSTOMER_TYPES);
  const terms: Array<{ keyword: string; locale: string; purpose: string }> = [];
  for (const market of markets.slice(0, 5)) {
    const profile = COUNTRY_SEARCH_PROFILES.find((item) => item.match.test(market));
    const localMarket = profile?.market || market;
    const localTypes = profile?.types || customerTypes;
    const localProducts = profile?.products[campaign.productTrack as ProductTrack] || products;
    const locale = profile?.locale || "en";
    for (const product of products.slice(0, 3)) {
      for (const type of customerTypes.slice(0, 3)) {
        terms.push({ keyword: `${product} ${type} ${market}`.trim(), locale: "en", purpose: "English discovery" });
      }
    }
    for (const product of localProducts.slice(0, 3)) {
      for (const type of localTypes.slice(0, 3)) terms.push({ keyword: `${product} ${type} ${localMarket}`.trim(), locale, purpose: locale === "en" ? "Local-market discovery" : "Local-language discovery" });
    }
  }
  const seen = new Set<string>();
  return terms.filter((item) => {
    const key = item.keyword.toLocaleLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 24);
}

export function researchBrief(campaign: Parameters<typeof buildSearchKeywords>[0] & { name: string; exclusionsJson?: string | null }) {
  const keywords = buildSearchKeywords(campaign);
  const exclusions = safeJsonList(campaign.exclusionsJson, DEFAULT_EXCLUSIONS);
  return [
    `# ${campaign.name} — Codex 小批量研究任务`,
    "",
    "目标：只研究 20–30 家可核验的 B2B 眼镜公司；保存来源，不猜测事实，不访问个人联系方式，不发送消息。",
    "",
    "## 搜索词",
    ...keywords.map((item) => `- [${item.locale}] ${item.keyword}`),
    "",
    "## 强制排除",
    ...exclusions.map((item) => `- ${item}`),
    "",
    "## 每家公司必须交付",
    "- 公司名称、官网、国家/城市、公司类型、B2B/B2C、产品与品牌。",
    "- 每个重要判断对应的 Source URL、Source Type、Retrieved Time、Evidence Summary、Confidence。",
    "- observed / inferred / unknown 必须分开；没有证据的字段保持为空或 unknown。",
    "- 按 qixin-v1.1 评分并给出每个维度的加分理由、扣分理由和证据。",
    "- 只生成结构化 JSON/CSV；不要写 CRM，不要发送邮件。",
  ].join("\n");
}

export function crmProductInterests(productTrack: string) {
  return PRODUCT_TRACK_DEFINITIONS[productTrack as ProductTrack]?.crm || [];
}

export function csvCell(value: unknown) {
  let output = String(value ?? "");
  if (/^[=+\-@]/.test(output)) output = `'${output}`;
  return `"${output.replaceAll('"', '""')}"`;
}
