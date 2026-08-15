import { DEFAULT_CUSTOMER_TYPES, PRODUCT_TRACK_DEFINITIONS, PRODUCT_TRACKS, type ProductTrack } from "@/lib/lead-engine";

export const CAMPAIGN_PRIORITIES = [
  { value: 100, label: "高" },
  { value: 50, label: "普通" },
  { value: 10, label: "低" },
] as const;

export const PRODUCT_TRACK_LABELS: Record<string, string> = {
  optical_frames: "光学镜架",
  sunglasses: "太阳镜",
  reading_glasses: "老花镜",
  blue_light_glasses: "防蓝光眼镜",
  kids_eyewear: "儿童眼镜",
  sports_eyewear: "运动眼镜",
  protective_eyewear: "防护眼镜",
  optical_lenses: "光学镜片",
  safety_lenses: "安全与防护镜片（旧版）",
};

export const CAMPAIGN_PRODUCT_TRACKS = Object.keys(PRODUCT_TRACK_DEFINITIONS)
  .filter((track) => track !== "safety_lenses")
  .map((value) => ({ value, label: PRODUCT_TRACK_LABELS[value] || value }));

export const CAMPAIGN_CUSTOMER_TYPES = [
  "Optical lens wholesaler",
  "Eyewear distributor",
  "Optical supplies importer",
  "Safety eyewear distributor",
  "Reading / blue light glasses wholesaler",
  "Eyewear brand",
  "Private label brand",
];

export const REGION_PRESETS = {
  global: { label: "全球", countries: [] as string[], language: "English" },
  europe: {
    label: "欧洲",
    language: "English / local language",
    countries: ["United Kingdom", "Ireland", "France", "Germany", "Italy", "Spain", "Portugal", "Netherlands", "Belgium", "Luxembourg", "Switzerland", "Austria", "Poland", "Czechia", "Slovakia", "Hungary", "Romania", "Bulgaria", "Greece", "Denmark", "Sweden", "Norway", "Finland", "Iceland", "Estonia", "Latvia", "Lithuania", "Croatia", "Slovenia", "Serbia", "Bosnia and Herzegovina", "Albania", "North Macedonia", "Montenegro", "Moldova", "Ukraine"],
  },
  middle_east: {
    label: "中东",
    language: "English / Arabic",
    countries: ["United Arab Emirates", "Saudi Arabia", "Qatar", "Kuwait", "Oman", "Bahrain", "Jordan", "Lebanon", "Israel", "Iraq", "Turkey"],
  },
  southeast_asia: {
    label: "东南亚",
    language: "English / local language",
    countries: ["Singapore", "Malaysia", "Thailand", "Indonesia", "Vietnam", "Philippines", "Cambodia", "Laos", "Myanmar", "Brunei", "Timor-Leste"],
  },
  north_america: { label: "北美", countries: ["United States", "Canada", "Mexico"], language: "English / Spanish / French" },
  latin_america: { label: "拉丁美洲", countries: ["Brazil", "Argentina", "Chile", "Colombia", "Peru", "Ecuador", "Uruguay", "Paraguay", "Bolivia", "Costa Rica", "Panama", "Guatemala", "Dominican Republic"], language: "Spanish / Portuguese" },
  oceania: { label: "大洋洲", countries: ["Australia", "New Zealand"], language: "English" },
  africa: { label: "非洲", countries: ["South Africa", "Egypt", "Morocco", "Algeria", "Tunisia", "Kenya", "Nigeria", "Ghana", "Ethiopia", "Tanzania"], language: "English / French / Arabic" },
  custom: { label: "自定义地区", countries: [] as string[], language: "English" },
} as const;

export type RegionKey = keyof typeof REGION_PRESETS;

export function isRegionKey(value: string): value is RegionKey {
  return value in REGION_PRESETS;
}

export function normalizeProductTracks(values: string[], fallback?: string) {
  const valid = values.filter((value) => PRODUCT_TRACKS.has(value));
  if (!valid.length && fallback && PRODUCT_TRACKS.has(fallback)) valid.push(fallback);
  return [...new Set(valid)] as ProductTrack[];
}

export function campaignStrategyName(regionKey: RegionKey, productTracks: string[]) {
  const region = REGION_PRESETS[regionKey].label;
  const products = productTracks.length === 1 ? PRODUCT_TRACK_LABELS[productTracks[0]] || productTracks[0] : "多产品眼镜渠道";
  return `${region} · ${products}`;
}

export function defaultCampaignCountries(regionKey: RegionKey) {
  return [...REGION_PRESETS[regionKey].countries];
}

export function defaultAutomationConfig(regionKey: RegionKey) {
  return {
    outreachMode: "disabled",
    preferredLanguage: REGION_PRESETS[regionKey].language,
    sendWindow: "local_business_hours",
    maxFollowUps: 0,
    stopOnReply: true,
    stopOnBounce: true,
    stopOnOptOut: true,
    replyHandoff: "human",
  };
}

export function campaignProductInterests(productTracks: string[]) {
  return [...new Set(productTracks.flatMap((track) => PRODUCT_TRACK_DEFINITIONS[track as ProductTrack]?.crm || []))];
}

export function campaignCustomerTypes(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].slice(0, 20);
}

export const DEFAULT_CAMPAIGN_CUSTOMER_TYPES = CAMPAIGN_CUSTOMER_TYPES.length
  ? CAMPAIGN_CUSTOMER_TYPES
  : DEFAULT_CUSTOMER_TYPES;
