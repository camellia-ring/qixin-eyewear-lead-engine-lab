import {
  BUSINESS_ROLE_DEFINITIONS,
  MARKET_SEARCH_PROFILES,
  PRODUCT_TRACK_DEFINITIONS,
  PRODUCT_TRACKS,
  businessRoleOptions,
  productTrackMatchesValues,
  type ProductTrack,
} from "@/lib/customer-scope";

export { PRODUCT_TRACK_DEFINITIONS, PRODUCT_TRACKS } from "@/lib/customer-scope";
export type { ProductTrack } from "@/lib/customer-scope";

export const RUBRIC_VERSION = "qixin-v1.2";
export const EXTERNAL_IMPORT_RUBRIC_VERSION = "qixin-v1.2-external-input";

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
export const CONFIDENCE_LEVELS = new Set(["low", "medium", "high"]);
export const HARD_GATE_STATUSES = new Set(["pass", "fail", "needs_review"]);

export const DEFAULT_CUSTOMER_TYPES = businessRoleOptions();
export const DEFAULT_EXCLUSIONS = [
  "普通单体零售店",
  "医院或眼科诊所",
  "新闻网站或行业协会",
  "与眼镜无关的公司",
  "中国供应商或直接竞争工厂",
  "已拒绝、退订或禁止联系",
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

const COMMON_SECOND_LEVEL_SUFFIXES = new Set([
  "co.uk", "org.uk", "com.au", "com.br", "com.mx", "com.cn", "com.hk", "co.jp", "co.kr", "co.nz", "co.za", "com.sg", "com.my", "com.tr", "com.pl",
]);

export function registrableDomain(value: unknown) {
  const hostname = String(value ?? "").trim().toLocaleLowerCase().replace(/^https?:\/\//, "").split(/[/?#]/)[0].replace(/^www\./, "").replace(/:\d+$/, "");
  const labels = hostname.split(".").filter(Boolean);
  if (labels.length <= 2) return hostname;
  const suffix = labels.slice(-2).join(".");
  return COMMON_SECOND_LEVEL_SUFFIXES.has(suffix) ? labels.slice(-3).join(".") : labels.slice(-2).join(".");
}

function domainOrganizationKey(value: unknown) {
  const domain = registrableDomain(value);
  return domain.split(".")[0]?.replace(/[^a-z0-9]+/g, "") || "";
}

export function domainsLikelySame(left: unknown, right: unknown) {
  const leftDomain = registrableDomain(left);
  const rightDomain = registrableDomain(right);
  if (!leftDomain || !rightDomain) return false;
  if (leftDomain === rightDomain) return true;
  const leftKey = domainOrganizationKey(leftDomain);
  const rightKey = domainOrganizationKey(rightDomain);
  return leftKey.length >= 4 && leftKey === rightKey;
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
    .replace(/\b(gmbh|ag|kg|ltd|limited|inc|llc|corp|corporation|company|co|sarl|s\.a\.?|b\.v\.?|n\.v\.?|spa|srl|sas|oy|ab|as|aps|pte|pty|plc|sp\.?\s*z\.?\s*o\.?\s*o\.?)\b/gi, " ")
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
  const domain = registrableDomain(websiteNormalized);
  return domain
    ? `entity:${domain}|${name}`
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
  const scopedProducts = productTypes.filter((product) => productTrackMatchesValues(productTrack, [product]));
  const defaults = PRODUCT_TRACK_DEFINITIONS[productTrack as ProductTrack]?.search || ["eyewear"];
  const seen = new Set<string>();
  return [...scopedProducts, ...defaults].filter((product) => {
    const key = product.toLocaleLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function buildSearchKeywords(campaign: {
  productTrack: string;
  productTracksJson?: string | null;
  targetMarkets?: string | null;
  targetCountriesJson?: string | null;
  productTypesJson?: string | null;
  customerTypesJson?: string | null;
}) {
  const countries = safeJsonList(campaign.targetCountriesJson, stringList(campaign.targetMarkets));
  const markets = countries.length ? countries : [campaign.targetMarkets || "target market"];
  const productTracks = safeJsonList(campaign.productTracksJson, [campaign.productTrack]).filter((track) => PRODUCT_TRACKS.has(track));
  const configuredProducts = safeJsonList(campaign.productTypesJson);
  const customerTypes = safeJsonList(campaign.customerTypesJson, DEFAULT_CUSTOMER_TYPES);
  const roleDefinitions = Object.values(BUSINESS_ROLE_DEFINITIONS).filter((definition) => customerTypes.some((value) =>
    value.toLocaleLowerCase() === definition.label.toLocaleLowerCase()
    || definition.patterns.some((pattern) => pattern.test(value))));
  const englishRoles = (roleDefinitions.length ? roleDefinitions : Object.values(BUSINESS_ROLE_DEFINITIONS))
    .flatMap((definition) => definition.search.slice(0, 1));
  const terms: Array<{ keyword: string; locale: string; purpose: string }> = [];
  for (const market of markets.slice(0, 5)) {
    const profile = MARKET_SEARCH_PROFILES.find((item) => item.match.test(market));
    const localMarket = profile?.market || market;
    const localTypes = profile?.roles || englishRoles;
    const locale = profile?.locale || "en";
    for (const track of productTracks) {
      const products = productSearchTerms(track, configuredProducts).slice(0, track === "eyewear_accessories" ? 4 : 2);
      const localProducts = profile?.products[track as ProductTrack] || products;
      for (const product of products) {
        for (const type of englishRoles.slice(0, 4)) {
          terms.push({ keyword: `${product} ${type} ${market}`.trim(), locale: "en", purpose: "English discovery" });
        }
      }
      for (const product of localProducts.slice(0, 3)) {
        for (const type of localTypes.slice(0, 4)) terms.push({ keyword: `${product} ${type} ${localMarket}`.trim(), locale, purpose: locale === "en" ? "Local-market discovery" : "Local-language discovery" });
      }
    }
    for (const phrase of ["private label eyewear buyer", "private label eyewear brand", "optical retail chain purchasing", "eyewear buying group"]) {
      terms.push({ keyword: `${phrase} ${market}`.trim(), locale: "en", purpose: "Buyer-role discovery" });
    }
  }
  const seen = new Set<string>();
  return terms.filter((item) => {
    const key = item.keyword.toLocaleLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 36);
}

export function researchBrief(campaign: Parameters<typeof buildSearchKeywords>[0] & { name: string; exclusionsJson?: string | null }) {
  const keywords = buildSearchKeywords(campaign);
  const exclusions = safeJsonList(campaign.exclusionsJson, DEFAULT_EXCLUSIONS);
  return [
    `# ${campaign.name} — Codex 小批量研究任务`,
    "",
    "目标：只研究 20–30 家可核验的广义眼镜与普通非电子配件 B2B 买家；保存来源，不猜测事实，不访问个人联系方式，不发送消息。",
    "候选可覆盖镜架、成镜、镜片、眼镜盒/袋、鼻托、镜腿、铰链/螺丝、眼镜绳/链、清洁用品及其他有官网证据的非电子眼镜配件。",
    "",
    "## 搜索词",
    ...keywords.map((item) => `- [${item.locale}] ${item.keyword}`),
    "",
    "## 强制排除",
    ...exclusions.map((item) => `- ${item}`),
    "- 隐形眼镜专营；AI、智能、AR、VR、显示、摄像、计算、联网等电子眼镜专营；与眼镜无关的产品。",
    "- 只有 manufacturer/factory/OEM/ODM 身份且没有独立采购、进口、批发、分销或品牌采购证据的工厂。",
    "- 搜索摘要、个人资料、私密内容或未核验社媒页只能发现候选，不能作为准入证据。",
    "",
    "## 每家公司必须交付",
    "- 公司名称、官网、国家/城市、一个或多个 B2B 商业角色、一个或多个允许产品方向与品牌关系。",
    "- 每个重要判断对应的 Source URL、Source Type、Retrieved Time、Evidence Summary、Confidence。",
    "- observed / inferred / unknown 必须分开；没有证据的字段保持为空或 unknown。",
    "- 优先核验 About/Company、Wholesale/Trade、Distributor/Importer、Products/Collections、Private Label/OEM 与 Contact；不要用导航、页脚、博客或第三方品牌列表的偶然词命中代替核心业务证据。",
    "- 按 qixin-v1.2 七维评分并给出每个维度的正面或负面理由；不知道 MOQ、采购量或规模时保持 unknown，不得抬分。",
    "- 外部 hardGateStatus、评分和覆盖率只作为审计输入；统一写入 needs_review，必须由 Lead Engine 服务器重新核验后才可能批准。",
    "- 只生成结构化 JSON/CSV；不要写 CRM，不要发送邮件，不要把公司同时匹配多个产品或 Campaign 计算为多个唯一客户。",
  ].join("\n");
}

export function crmProductInterests(productTrack: string) {
  return [...(PRODUCT_TRACK_DEFINITIONS[productTrack as ProductTrack]?.crm || [])];
}

export function csvCell(value: unknown) {
  let output = String(value ?? "");
  if (/^[=+\-@]/.test(output)) output = `'${output}`;
  return `"${output.replaceAll('"', '""')}"`;
}
