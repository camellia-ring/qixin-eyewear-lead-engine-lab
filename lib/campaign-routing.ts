import type { SiteEvidence } from "@/lib/discovery";

export const UNASSIGNED_CAMPAIGN_ID = "system:unassigned";
export const UNASSIGNED_CAMPAIGN_NAME = "待分配客户";

export type RoutableCampaign = {
  id: string;
  name: string;
  productTrack: string;
  targetCountriesJson: string;
  targetMarkets: string;
  productTypesJson: string;
  customerTypesJson: string;
  status: string;
};

const COUNTRY_ALIASES: Record<string, string> = {
  us: "united states", usa: "united states", "u.s.": "united states", "u.s.a.": "united states",
  america: "united states", "united states of america": "united states", 美国: "united states",
  uk: "united kingdom", "u.k.": "united kingdom", britain: "united kingdom", "great britain": "united kingdom", 英国: "united kingdom",
  korea: "south korea", "republic of korea": "south korea", 韩国: "south korea",
  polska: "poland", 波兰: "poland", mexico: "mexico", 墨西哥: "mexico",
  china: "china", 中国: "china", italy: "italy", 意大利: "italy", germany: "germany", 德国: "germany",
  france: "france", 法国: "france", spain: "spain", 西班牙: "spain", canada: "canada", 加拿大: "canada",
  netherlands: "netherlands", 荷兰: "netherlands", austria: "austria", 奥地利: "austria",
  switzerland: "switzerland", 瑞士: "switzerland", "hong kong": "hong kong", 香港: "hong kong",
};

export function jsonStringList(value: string | null | undefined) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed.map((item) => String(item).trim()).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export function normalizeCountry(value: string | null | undefined) {
  const normalized = String(value || "").trim().toLocaleLowerCase().replace(/\s+/g, " ");
  return COUNTRY_ALIASES[normalized] || normalized;
}

export function campaignCountries(campaign: Pick<RoutableCampaign, "targetCountriesJson" | "targetMarkets">) {
  const rawValues = [
    ...jsonStringList(campaign.targetCountriesJson),
    ...String(campaign.targetMarkets || "").split(/[,;、，/|]+/),
  ].map(normalizeCountry).filter(Boolean);
  const regions: Record<string, string[]> = {
    "north america": ["united states", "canada", "mexico"],
    europe: ["united kingdom", "italy", "germany", "france", "spain", "poland", "netherlands", "austria", "switzerland"],
    asia: ["china", "hong kong", "south korea"],
  };
  if (rawValues.length === 1 && ["global", "全球"].includes(rawValues[0])) return [];
  const values = rawValues.flatMap((value) => regions[value] || [value]);
  return [...new Set(values)];
}

function productMatches(campaign: RoutableCampaign, evidence: SiteEvidence, productDirections: string[]) {
  const haystack = [...productDirections, ...evidence.productTerms, ...evidence.eyewearTerms].join(" ").toLocaleLowerCase();
  if (campaign.productTrack === "optical_lenses") return /(镜片|lens|photochromic|progressive|varifocal|polycarbonate|aspheric|blue light)/i.test(haystack);
  if (campaign.productTrack === "optical_frames") return /(镜架|frame|eyewear|spectacle|glasses|sunglass)/i.test(haystack);
  if (campaign.productTrack === "sunglasses") return /(太阳镜|sunglass|sun eyewear)/i.test(haystack);
  if (campaign.productTrack === "reading_glasses") return /(老花|reading glasses|readers)/i.test(haystack);
  if (campaign.productTrack === "blue_light_glasses") return /(防蓝光|blue light|blue-light|computer glasses)/i.test(haystack);
  if (campaign.productTrack === "kids_eyewear") return /(儿童|kids|children)/i.test(haystack);
  if (campaign.productTrack === "sports_eyewear") return /(运动|sports|cycling|performance)/i.test(haystack);
  if (campaign.productTrack === "protective_eyewear" || campaign.productTrack === "safety_lenses") return /(安全|防护|safety|protective|polycarbonate|impact-resistant)/i.test(haystack);
  return evidence.eyewearTerms.length > 0 || productDirections.length > 0;
}

function customerTypeMatches(campaign: RoutableCampaign, customerType: string) {
  const targets = jsonStringList(campaign.customerTypesJson);
  if (!targets.length) return Boolean(customerType);
  const normalizedType = customerType.toLocaleLowerCase();
  return targets.some((target) => {
    const normalizedTarget = target.toLocaleLowerCase();
    if (normalizedTarget === normalizedType) return true;
    if (/(批发|wholesale)/i.test(normalizedTarget) && /(批发|wholesale)/i.test(normalizedType)) return true;
    if (/(分销|distribut)/i.test(normalizedTarget) && /(分销|distribut)/i.test(normalizedType)) return true;
    if (/(进口|import)/i.test(normalizedTarget) && /(进口|import)/i.test(normalizedType)) return true;
    return false;
  });
}

export function campaignMatchesEvidence(
  campaign: RoutableCampaign,
  evidence: SiteEvidence,
  customerType: string,
  productDirections: string[],
) {
  if (campaign.id === UNASSIGNED_CAMPAIGN_ID || campaign.status !== "active") return false;
  const targets = campaignCountries(campaign);
  const evidenceCountry = normalizeCountry(evidence.country);
  if (targets.length && (!evidenceCountry || !targets.includes(evidenceCountry))) return false;
  return customerTypeMatches(campaign, customerType) && productMatches(campaign, evidence, productDirections);
}

export function routeCampaigns(
  campaigns: RoutableCampaign[],
  evidence: SiteEvidence,
  customerType: string,
  productDirections: string[],
) {
  return campaigns.filter((campaign) => campaignMatchesEvidence(campaign, evidence, customerType, productDirections));
}
