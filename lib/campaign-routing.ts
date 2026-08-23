import type { SiteEvidence } from "@/lib/discovery";
import { REGION_PRESETS, isRegionKey, normalizeProductTracks } from "@/lib/campaign-strategy";
import { businessRoleMatchesTarget, productTrackMatchesValues } from "@/lib/customer-scope";

export const UNASSIGNED_CAMPAIGN_ID = "system:unassigned";
export const UNASSIGNED_CAMPAIGN_NAME = "待分配客户";
export const GLOBAL_DISCOVERY_CAMPAIGN_ID = "system:global-discovery";
export const GLOBAL_DISCOVERY_CAMPAIGN_NAME = "全局来源池";

export function isSystemCampaignId(campaignId: string | null | undefined) {
  return campaignId === UNASSIGNED_CAMPAIGN_ID || campaignId === GLOBAL_DISCOVERY_CAMPAIGN_ID;
}

export type RoutableCampaign = {
  id: string;
  name: string;
  productTrack: string;
  targetCountriesJson: string;
  targetMarkets: string;
  productTypesJson: string;
  customerTypesJson: string;
  regionKey?: string | null;
  productTracksJson?: string | null;
  strategyPriority?: number | null;
  status: string;
};

export type RoutableCompany = {
  country?: string | null;
  customerType?: string | null;
  customerTypesJson?: string | null;
  productDirectionsJson?: string | null;
  productsJson?: string | null;
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
  uae: "united arab emirates", emirates: "united arab emirates", 阿联酋: "united arab emirates",
  "saudi arabia": "saudi arabia", saudi: "saudi arabia", 沙特: "saudi arabia",
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

export function campaignProductTracks(campaign: Pick<RoutableCampaign, "productTrack" | "productTracksJson">) {
  return normalizeProductTracks(jsonStringList(campaign.productTracksJson), campaign.productTrack);
}

function productMatches(campaign: RoutableCampaign, values: string[]) {
  return campaignProductTracks(campaign).some((track) => productTrackMatchesValues(track, values));
}

function customerTypeMatches(campaign: RoutableCampaign, customerTypes: string[]) {
  const targets = jsonStringList(campaign.customerTypesJson);
  if (!targets.length) return customerTypes.length > 0;
  return customerTypes.some((customerType) => targets.some((target) => businessRoleMatchesTarget(customerType, target)));
}

function targetCountries(campaign: RoutableCampaign) {
  const configured = campaignCountries(campaign);
  if (configured.length) return configured;
  if (campaign.regionKey && isRegionKey(campaign.regionKey)) {
    return REGION_PRESETS[campaign.regionKey].countries.map(normalizeCountry);
  }
  return configured;
}

export function campaignMatchesEvidence(
  campaign: RoutableCampaign,
  evidence: SiteEvidence,
  customerType: string | string[],
  productDirections: string[],
) {
  if (isSystemCampaignId(campaign.id) || campaign.status !== "active") return false;
  const targets = targetCountries(campaign);
  const evidenceCountry = normalizeCountry(evidence.country);
  if (targets.length && (!evidenceCountry || !targets.includes(evidenceCountry))) return false;
  return customerTypeMatches(campaign, (Array.isArray(customerType) ? customerType : [customerType]).filter(Boolean))
    && productMatches(campaign, [...productDirections, ...evidence.productTerms, ...evidence.eyewearTerms]);
}

export function campaignMatchesCompany(campaign: RoutableCampaign, company: RoutableCompany) {
  if (isSystemCampaignId(campaign.id) || campaign.status !== "active") return false;
  const targets = targetCountries(campaign);
  const companyCountry = normalizeCountry(company.country);
  if (targets.length && (!companyCountry || !targets.includes(companyCountry))) return false;
  const customerTypes = [...jsonStringList(company.customerTypesJson), company.customerType || ""].filter(Boolean);
  const products = [...jsonStringList(company.productDirectionsJson), ...jsonStringList(company.productsJson)];
  return customerTypeMatches(campaign, customerTypes) && productMatches(campaign, products);
}

export function routeCampaigns(
  campaigns: RoutableCampaign[],
  evidence: SiteEvidence,
  customerType: string | string[],
  productDirections: string[],
) {
  return campaigns
    .filter((campaign) => campaignMatchesEvidence(campaign, evidence, customerType, productDirections))
    .sort((left, right) => Number(right.strategyPriority || 50) - Number(left.strategyPriority || 50));
}
