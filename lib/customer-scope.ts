export const BUSINESS_ROLE_DEFINITIONS = Object.freeze({
  wholesaler: {
    label: "批发商",
    patterns: [/\bwholesale(?:r|rs)?\b/i, /gro(?:ss|ß)h(?:andel|ändler)/i, /\bmayorista\b/i, /\bhurtowni[ae]\b/i, /\bgrossiste\b/i, /\bingrosso\b/i, /\batacadista\b/i, /تجار?ة?\s*الجملة/i],
    search: ["wholesaler", "Großhändler", "mayorista", "hurtownia", "grossiste", "grossista", "تاجر جملة"],
  },
  distributor: {
    label: "分销商",
    patterns: [/\bdistribut(?:e|es|ed|ing|or|ors|ion|ions|eur|eurs)\b/i, /\bdistribuidor(?:es)?\b/i, /\bdystrybutor(?:zy)?\b/i, /\bdistributore\b/i, /\bdistribui(?:dor|ção)\b/i, /موزع/i, /supplier to opticians/i, /supply optical practices/i],
    search: ["distributor", "distributeur", "distribuidor", "dystrybutor", "distributore", "موزع"],
  },
  importer: {
    label: "进口商",
    patterns: [/\bimport(?:er|ers|ateur|ateurs|ador|adores|atore|atori)\b/i, /\bimport and distribut/i, /\bimports?\s+(?:eyewear|optical|spectacle|glasses|frames|lenses|accessories)\b/i, /مستورد/i],
    search: ["importer", "importateur", "importador", "importatore", "مستورد"],
  },
  brand: {
    label: "眼镜或配件品牌商",
    patterns: [/\beyewear brand\b/i, /\boptical brand\b/i, /\baccessor(?:y|ies) brand\b/i, /\bour (?:own )?brand\b/i, /\bbranded eyewear\b/i, /\bmarque de (?:lunettes|montures)\b/i, /\bmarca de (?:gafas|monturas|óculos)\b/i, /\bbrillenmarke\b/i, /\bmarka okular/i, /علامة تجارية.*نظارات/i],
    search: ["eyewear brand", "private eyewear brand", "marque de lunettes", "marca de gafas", "Brillenmarke", "marka okularów", "علامة تجارية للنظارات"],
  },
  private_label_buyer: {
    label: "私牌/OEM/ODM采购方",
    patterns: [/\bprivate label (?:buyer|sourcing|procurement)\b/i, /\b(?:oem|odm) (?:buyer|sourcing|procurement)\b/i, /\bsource(?:s|d|ing)? (?:our )?(?:eyewear|frames|glasses|accessories).*(?:factory|manufacturer|supplier)\b/i, /\bcontract manufacturing (?:partner|supplier)\b/i, /\boutsourc(?:e|ed|ing) (?:production|manufacturing)\b/i, /\b采购.*(?:贴牌|代工|OEM|ODM)/i],
    search: ["private label eyewear buyer", "OEM eyewear sourcing", "ODM eyewear procurement"],
  },
  retail_chain_buyer: {
    label: "连锁零售集中采购方",
    patterns: [/\b(?:retail|optical|eyewear) chain\b.*\b(?:procurement|purchasing|buying|sourcing)\b/i, /\bcentral(?:ized|ised)? (?:procurement|purchasing|buying)\b/i, /\bhead office (?:procurement|purchasing|buying)\b/i, /\bchain of (?:optical )?(?:stores|shops)\b.*\b(?:buyer|buying|purchasing)\b/i, /集中采购/i],
    search: ["optical retail chain purchasing", "eyewear chain central procurement"],
  },
  buying_group: {
    label: "采购联盟或Buying Group",
    patterns: [/\bbuying group\b/i, /\bpurchasing (?:group|alliance|cooperative)\b/i, /\bgroupement d['’]achat\b/i, /\beinkaufsverband\b/i, /\bgrupo de compra\b/i, /\bgrupa zakupowa\b/i, /\bgruppo d['’]acquisto\b/i, /采购联盟/i],
    search: ["eyewear buying group", "optical purchasing alliance", "groupement d'achat optique", "Einkaufsverband Optik"],
  },
  ecommerce_buyer: {
    label: "电商/全渠道采购方",
    patterns: [/\b(?:e-?commerce|online retailer|omnichannel|multi-?channel)\b.*\b(?:procurement|purchasing|buying|sourcing|import)\b/i, /\b(?:procurement|purchasing|buying|sourcing|import)\b.*\b(?:e-?commerce|online retailer|omnichannel|multi-?channel)\b/i, /电商.*(?:采购|进口|批发|分销)/i],
    search: ["eyewear ecommerce purchasing", "omnichannel eyewear buyer"],
  },
  optical_lab_buyer: {
    label: "光学实验室/镜片加工采购方",
    patterns: [/\b(?:optical|ophthalmic|lens) lab(?:oratory)?\b.*\b(?:buy|buyer|purchas|procure|source|stock)\w*\b/i, /\b(?:buy|buyer|purchas|procure|source|stock)\w*\b.*\b(?:optical|ophthalmic|lens) lab(?:oratory)?\b/i, /\b(?:laboratoire optique|laboratorio óptico|optisches labor|laboratorium optyczne)\b.*\b(?:achat|compr|einkauf|zakup)\w*\b/i, /镜片加工.*采购/i],
    search: ["optical laboratory lens purchasing", "lens lab frame procurement"],
  },
  accessories_trade_buyer: {
    label: "眼镜配件批发/进口/分销商",
    patterns: [/\b(?:eyewear|spectacle|optical|glasses) accessor(?:y|ies|ios|io)\b.*\b(?:wholesale|distribut|import)\w*\b/i, /\b(?:wholesale|distribut|import)\w*\b.*\b(?:eyewear|spectacle|optical|glasses) accessor(?:y|ies|ios|io)\b/i, /眼镜配件.*(?:批发|进口|分销)/i],
    search: ["eyewear accessories wholesaler", "eyewear accessories distributor", "eyewear accessories importer"],
  },
  other_b2b_buyer: {
    label: "其他有明确采购证据的B2B买家",
    patterns: [/\b(?:procurement|purchasing department|category buyer|commercial buyer|sourcing team|we source|we purchase|we import|trade buying)\b/i, /\b(?:achats?|acheteur|compras?|comprador|einkauf|einkäufer|zakupy|kupiec|acquisti)\b/i, /(?:采购|进货|渠道采购|商业采购)/i],
    search: ["eyewear B2B buyer", "eyewear procurement", "optical purchasing"],
  },
} as const);

export type BusinessRoleKey = keyof typeof BUSINESS_ROLE_DEFINITIONS;
export type BusinessRoleLabel = (typeof BUSINESS_ROLE_DEFINITIONS)[BusinessRoleKey]["label"];

type ProductDefinition = {
  label: string;
  track: ProductTrack;
  patterns: readonly RegExp[];
  search: readonly string[];
};

export const PRODUCT_TRACK_DEFINITIONS = Object.freeze({
  optical_frames: { crm: ["Optical frames"], search: ["optical frames", "eyeglass frames", "spectacle frames"] },
  sunglasses: { crm: ["Sunglasses"], search: ["sunglasses", "sun eyewear", "fashion sunglasses"] },
  reading_glasses: { crm: ["Reading glasses"], search: ["reading glasses", "readers eyewear", "ready readers"] },
  blue_light_glasses: { crm: ["Blue light glasses"], search: ["blue light glasses", "computer glasses", "screen eyewear"] },
  kids_eyewear: { crm: ["Kids eyewear"], search: ["kids eyewear", "children's glasses", "children's optical frames"] },
  sports_eyewear: { crm: ["Sports eyewear"], search: ["sports eyewear", "performance sunglasses", "cycling glasses"] },
  protective_eyewear: { crm: ["Protective eyewear"], search: ["protective eyewear", "safety glasses", "industrial eye protection"] },
  optical_lenses: { crm: ["Optical lenses"], search: ["optical lenses", "ophthalmic lenses", "prescription lenses"] },
  eyewear_accessories: { crm: ["Eyewear accessories"], search: ["eyewear accessories", "spectacle cases", "nose pads", "eyewear components"] },
  // Retained for existing V0/V1 campaigns; new campaigns should use protective_eyewear.
  safety_lenses: { crm: ["Protective eyewear", "Optical lenses"], search: ["safety lenses", "protective lenses", "industrial eye protection"] },
} as const);

export type ProductTrack = keyof typeof PRODUCT_TRACK_DEFINITIONS;
export const PRODUCT_TRACKS = new Set(Object.keys(PRODUCT_TRACK_DEFINITIONS));

export const PRODUCT_DIRECTION_DEFINITIONS = Object.freeze({
  optical_frames: { label: "光学镜架", track: "optical_frames", patterns: [/\boptical frames?\b/i, /\beyeglass frames?\b/i, /\bspectacle frames?\b/i, /\bbrillenfassungen?\b/i, /\bmonturas? (?:ópticas?|de gafas)\b/i, /\boprawki okularowe\b/i, /\bmontures? (?:optiques?|de lunettes)\b/i, /(?:光学镜架|镜架)/i], search: ["optical frames"] },
  sunglasses: { label: "太阳镜", track: "sunglasses", patterns: [/\bsunglasses?\b/i, /\bsun eyewear\b/i, /\bsonnenbrillen?\b/i, /\bgafas de sol\b/i, /\bokulary przeciwsłoneczne\b/i, /\blunettes de soleil\b/i, /太阳镜/i], search: ["sunglasses"] },
  reading_glasses: { label: "老花镜", track: "reading_glasses", patterns: [/\breading glasses\b/i, /\bready readers\b/i, /\blesebrillen?\b/i, /\bgafas de lectura\b/i, /\bokulary do czytania\b/i, /\blunettes de lecture\b/i, /老花镜/i], search: ["reading glasses"] },
  blue_light_glasses: { label: "防蓝光眼镜", track: "blue_light_glasses", patterns: [/\bblue[- ]light (?:blocking )?glasses\b/i, /\bcomputer glasses\b/i, /\bblaulichtfilterbrillen?\b/i, /\bgafas (?:para|de) luz azul\b/i, /\bokulary blokujące światło niebieskie\b/i, /防蓝光眼镜/i], search: ["blue light glasses"] },
  kids_eyewear: { label: "儿童眼镜", track: "kids_eyewear", patterns: [/\b(?:kids?|children'?s|junior) (?:eyewear|glasses|frames)\b/i, /\bkinderbrillen?\b/i, /\bgafas infantiles\b/i, /\bokulary dziecięce\b/i, /儿童眼镜/i], search: ["kids eyewear"] },
  sports_eyewear: { label: "运动眼镜", track: "sports_eyewear", patterns: [/\b(?:sports?|cycling|performance) (?:eyewear|glasses|sunglasses)\b/i, /\bsportbrillen?\b/i, /\bgafas deportivas\b/i, /\bokulary sportowe\b/i, /运动眼镜/i], search: ["sports eyewear"] },
  protective_eyewear: { label: "防护眼镜", track: "protective_eyewear", patterns: [/\b(?:protective|safety|industrial) (?:eyewear|glasses|goggles)\b/i, /\beye protection\b/i, /\bschutzbrillen?\b/i, /\bgafas de seguridad\b/i, /\bokulary ochronne\b/i, /(?:防护眼镜|安全眼镜)/i], search: ["protective eyewear"] },
  optical_lenses: { label: "普通光学镜片", track: "optical_lenses", patterns: [/\bophthalmic lenses?\b/i, /\boptical lenses?\b/i, /\bprescription lenses?\b/i, /\bsingle vision\b/i, /\bbrillengläser\b/i, /\blentes oftálmicas\b/i, /\bsoczewki okularowe\b/i, /(?:普通光学镜片|光学镜片)/i], search: ["optical lenses"] },
  aspheric_lenses: { label: "非球面镜片", track: "optical_lenses", patterns: [/\baspheric lenses?\b/i, /\basphärische brillengläser\b/i, /\blentes asféricas\b/i, /非球面镜片/i], search: ["aspheric lenses"] },
  blue_light_lenses: { label: "防蓝光镜片", track: "optical_lenses", patterns: [/\bblue[- ]light (?:blocking )?lenses?\b/i, /\bblue blocker lenses?\b/i, /\bblaulichtfiltergläser\b/i, /\blentes (?:con filtro de )?luz azul\b/i, /防蓝光镜片/i], search: ["blue light lenses"] },
  photochromic_lenses: { label: "变色镜片", track: "optical_lenses", patterns: [/\bphotochromic lenses?\b/i, /\btransition lenses?\b/i, /\bphototrope brillengläser\b/i, /\blentes fotocromáticas\b/i, /变色镜片/i], search: ["photochromic lenses"] },
  progressive_lenses: { label: "渐进镜片", track: "optical_lenses", patterns: [/\bprogressive lenses?\b/i, /\bvarifocal lenses?\b/i, /\bgleitsichtgläser\b/i, /\blentes progresivas\b/i, /\bsoczewki progresywne\b/i, /渐进镜片/i], search: ["progressive lenses"] },
  pc_safety_lenses: { label: "PC安全镜片", track: "protective_eyewear", patterns: [/\bpolycarbonate safety lenses?\b/i, /\bpc safety lenses?\b/i, /\bimpact[- ]resistant lenses?\b/i, /PC安全镜片/i], search: ["PC safety lenses"] },
  cases_bags: { label: "眼镜盒/袋", track: "eyewear_accessories", patterns: [/\b(?:eyewear|spectacle|glasses|sunglasses) (?:cases?|pouches?|bags?)\b/i, /\betuis? (?:à|de) lunettes\b/i, /\bbrillenetuis?\b/i, /\bestuches? para gafas\b/i, /futerał(?:y|ów) na okulary/i, /(?:眼镜盒|眼镜袋)/i], search: ["spectacle cases", "eyewear pouches"] },
  nose_pads: { label: "鼻托", track: "eyewear_accessories", patterns: [/\bnose pads?\b/i, /\bbrillen[- ]?nasenpads?\b/i, /\bplaquetas? nasales\b/i, /\bnoski do okularów\b/i, /鼻托/i], search: ["nose pads"] },
  temples: { label: "镜腿", track: "eyewear_accessories", patterns: [/\b(?:spectacle|eyeglass|eyewear|frame) temples?\b/i, /\btemple arms?\b/i, /\bbrillenbügel\b/i, /\bvarillas? de gafas\b/i, /镜腿/i], search: ["eyewear temple arms"] },
  hinges_screws: { label: "铰链/螺丝", track: "eyewear_accessories", patterns: [/\b(?:eyewear|spectacle|frame) hinges?\b/i, /\b(?:eyewear|spectacle|frame) screws?\b/i, /\bbrillenscharniere?\b/i, /\btornillos? para gafas\b/i, /(?:眼镜铰链|镜架铰链|眼镜螺丝|镜架螺丝)/i], search: ["eyewear hinges", "spectacle screws"] },
  cords_chains: { label: "眼镜绳/链", track: "eyewear_accessories", patterns: [/\b(?:eyewear|spectacle|glasses) (?:cords?|chains?|straps?|retainers?)\b/i, /\bbrillenketten?\b/i, /\bcadenas? para gafas\b/i, /(?:眼镜绳|眼镜链)/i], search: ["eyewear cords", "glasses chains"] },
  cleaning: { label: "清洁用品", track: "eyewear_accessories", patterns: [/\b(?:eyewear|lens|glasses) cleaning (?:cloths?|kits?|sprays?)\b/i, /\bmicrofiber (?:lens )?cloths?\b/i, /\bbrillenputztücher\b/i, /\bpaños? para (?:lentes|gafas)\b/i, /(?:眼镜清洁布|镜片清洁布|清洁布)/i], search: ["eyewear cleaning cloths"] },
  other_accessories: { label: "其他非电子眼镜配件", track: "eyewear_accessories", patterns: [/\b(?:eyewear|spectacle|optical|glasses) accessor(?:y|ies)\b/i, /\beyewear components?\b/i, /\bframe parts?\b/i, /(?:眼镜配件|镜架零件)/i], search: ["eyewear accessories", "eyewear components"] },
} satisfies Record<string, ProductDefinition>);

export type ProductDirectionLabel = (typeof PRODUCT_DIRECTION_DEFINITIONS)[keyof typeof PRODUCT_DIRECTION_DEFINITIONS]["label"] | "其他相关眼镜产品";

export const PROHIBITED_PRODUCT_DEFINITIONS = Object.freeze({
  contact_lenses: { label: "隐形眼镜", patterns: [/\bcontact lenses?\b/i, /\bcolored contacts?\b/i, /\bkontaktlinsen?\b/i, /\blentilles? de contact\b/i, /\blentes? de contacto\b/i, /\bsoczewki kontaktowe\b/i, /隐形眼镜/i] },
  smart_glasses: { label: "AI/智能眼镜", patterns: [/\bai glasses\b/i, /\bsmart glasses\b/i, /\bconnected eyewear\b/i, /\belectronic eyewear\b/i, /\bwearable computing\b/i, /(?:AI眼镜|人工智能眼镜|智能眼镜|电子眼镜)/i] },
  ar_vr_display: { label: "AR/VR/显示或摄像眼镜", patterns: [/\b(?:ar|vr|xr) (?:glasses|headset|eyewear)\b/i, /\baugmented reality (?:glasses|eyewear)\b/i, /\bvirtual reality (?:glasses|eyewear|headset)\b/i, /\bheads?-up display\b/i, /\bcamera glasses\b/i, /(?:AR眼镜|VR眼镜|显示眼镜|摄像眼镜)/i] },
});

export const EYEWEAR_LEXICAL_TERMS = [
  "eyewear", "eyeglass", "eyeglasses", "spectacle", "spectacles", "optical frame", "optical frames", "sunglass", "sunglasses",
  "reading glasses", "ophthalmic lens", "optical lens", "safety glasses", "prescription lens", "progressive lens", "photochromic",
  "blue light", "polycarbonate lens", "eyewear accessories", "spectacle case", "nose pad", "eyewear components", "frame parts",
  "brillen", "sonnenbrillen", "lunettes", "montures", "gafas", "monturas", "occhiali", "okulary", "眼镜", "镜架", "镜片", "鼻托",
];

export const PRODUCT_LEXICAL_TERMS = [
  ...new Set(Object.values(PRODUCT_DIRECTION_DEFINITIONS).flatMap((definition) => definition.search)),
  "optical lens", "ophthalmic lens", "prescription lens", "single vision", "aspheric", "blue light", "blue-light", "photochromic",
  "progressive lens", "varifocal", "polycarbonate", "safety lens", "protective lens", "reading glasses", "optical frame", "sunglasses",
];

export const B2B_LEXICAL_TERMS = [
  ...new Set(Object.values(BUSINESS_ROLE_DEFINITIONS).flatMap((definition) => definition.search)),
  "trade customer", "trade account", "stockist", "retailer login", "b2b", "private label", "white label", "bulk order", "procurement", "purchasing",
];

export const INTERNAL_EVIDENCE_PAGE_TERMS = [
  "about", "company", "products", "collections", "eyewear", "glasses", "frames", "lenses", "accessories", "components",
  "wholesale", "trade", "distributor", "importer", "stockist", "contact", "brands", "private-label", "oem", "procurement", "purchasing",
];

export type ScopeEvidencePage = { url: string; title: string; text: string; classificationText?: string };
export type CustomerScopeEvidence = {
  companyName: string;
  country: string;
  companyType: string;
  eyewearTerms: string[];
  b2bTerms: string[];
  productTerms: string[];
  pages: ScopeEvidencePage[];
};

export type EvidenceMatch = { value: string; matchedTerms: string[]; sourceUrls: string[] };

function coreText(page: ScopeEvidencePage) {
  return page.classificationText || page.text;
}

function evidenceText(evidence: CustomerScopeEvidence) {
  return [
    evidence.companyName,
    evidence.companyType,
    ...evidence.eyewearTerms,
    ...evidence.b2bTerms,
    ...evidence.productTerms,
    ...evidence.pages.map(coreText),
  ].join("\n");
}

function patternLabel(pattern: RegExp) {
  return pattern.source.replaceAll("\\b", "").replaceAll("(?:", "(").slice(0, 120);
}

export function containsAffirmedPattern(text: string, pattern: RegExp) {
  const flags = [...new Set(`${pattern.flags.replace(/[gy]/g, "")}g`.split(""))].join("");
  const matcher = new RegExp(pattern.source, flags);
  for (const match of text.matchAll(matcher)) {
    const before = text.slice(Math.max(0, (match.index || 0) - 70), match.index || 0);
    if (!/(?:\b(?:not|never|without|no longer|neither|nor|kein|keine|nicht|sans|aucun|sin|nunca|nie|bez)\b|(?:不是|并非|不从事|不经营))[^.!?。！？]{0,45}$/i.test(before)) return true;
  }
  return false;
}

function matchesFor(value: string, patterns: readonly RegExp[], evidence: CustomerScopeEvidence): EvidenceMatch | null {
  const text = evidenceText(evidence);
  const matched = patterns.filter((pattern) => containsAffirmedPattern(text, pattern));
  if (!matched.length) return null;
  const sourceUrls = evidence.pages
    .filter((page) => patterns.some((pattern) => containsAffirmedPattern(coreText(page), pattern)))
    .map((page) => page.url);
  return { value, matchedTerms: matched.map(patternLabel), sourceUrls: [...new Set(sourceUrls)] };
}

export function classifyProductScope(evidence: CustomerScopeEvidence) {
  const allowedMatches = Object.values(PRODUCT_DIRECTION_DEFINITIONS)
    .map((definition) => matchesFor(definition.label, definition.patterns, evidence))
    .filter((match): match is EvidenceMatch => Boolean(match));
  const prohibitedMatches = Object.values(PROHIBITED_PRODUCT_DEFINITIONS)
    .map((definition) => matchesFor(definition.label, definition.patterns, evidence))
    .filter((match): match is EvidenceMatch => Boolean(match));
  if (!allowedMatches.length && evidence.eyewearTerms.length && !prohibitedMatches.length) {
    allowedMatches.push({
      value: "其他相关眼镜产品",
      matchedTerms: evidence.eyewearTerms.slice(0, 6),
      sourceUrls: evidence.pages.filter((page) => evidence.eyewearTerms.some((term) => coreText(page).toLocaleLowerCase().includes(term.toLocaleLowerCase()))).map((page) => page.url),
    });
  }
  return {
    allowedMatches,
    prohibitedMatches,
    productDirections: [...new Set(allowedMatches.map((match) => match.value))],
    prohibitedProducts: [...new Set(prohibitedMatches.map((match) => match.value))],
  };
}

export function classifyBusinessRoles(evidence: CustomerScopeEvidence) {
  const roles: EvidenceMatch[] = [];
  for (const definition of Object.values(BUSINESS_ROLE_DEFINITIONS)) {
    if (definition.label === BUSINESS_ROLE_DEFINITIONS.other_b2b_buyer.label) continue;
    const match = matchesFor(definition.label, definition.patterns, evidence);
    if (match) roles.push(match);
  }
  const productScope = classifyProductScope(evidence);
  if (!roles.length && productScope.productDirections.length) {
    const other = BUSINESS_ROLE_DEFINITIONS.other_b2b_buyer;
    const match = matchesFor(other.label, other.patterns, evidence);
    if (match) roles.push(match);
  }
  return roles;
}

export const LEGACY_CUSTOMER_TYPE_TO_ROLE: Readonly<Record<string, BusinessRoleLabel>> = Object.freeze({
  "optical lens wholesaler": "批发商",
  "光学镜片批发商": "批发商",
  "eyewear distributor": "分销商",
  "眼镜分销商": "分销商",
  "optical supplies importer": "进口商",
  "光学用品进口商": "进口商",
  "safety eyewear distributor": "分销商",
  "安全眼镜分销商": "分销商",
  "reading / blue light glasses wholesaler": "批发商",
  "老花镜或防蓝光眼镜批发商": "批发商",
  "eyewear brand": "眼镜或配件品牌商",
  "eyewear wholesaler": "批发商",
  "eyewear importer": "进口商",
  "private label brand": "私牌/OEM/ODM采购方",
  wholesaler: "批发商",
  distributor: "分销商",
  importer: "进口商",
});

export function normalizeBusinessRole(value: string) {
  const normalized = value.trim().toLocaleLowerCase();
  const legacy = LEGACY_CUSTOMER_TYPE_TO_ROLE[normalized];
  if (legacy) return legacy;
  const exact = Object.values(BUSINESS_ROLE_DEFINITIONS).find((definition) => definition.label.toLocaleLowerCase() === normalized);
  if (exact) return exact.label;
  const matched = Object.values(BUSINESS_ROLE_DEFINITIONS).find((definition) => definition.patterns.some((pattern) => containsAffirmedPattern(value, pattern)));
  return matched?.label || "";
}

export function normalizeBusinessRoles(values: string[]) {
  return [...new Set(values.map(normalizeBusinessRole).filter(Boolean))];
}

export function businessRoleMatchesTarget(role: string, target: string) {
  const normalizedRole = normalizeBusinessRole(role) || role.trim().toLocaleLowerCase();
  const normalizedTarget = normalizeBusinessRole(target) || target.trim().toLocaleLowerCase();
  return normalizedRole === normalizedTarget;
}

export function productTrackMatchesValues(track: string, values: string[]) {
  const labels = new Set(values.map((value) => value.toLocaleLowerCase()));
  return Object.values(PRODUCT_DIRECTION_DEFINITIONS).some((definition) => definition.track === track
    && [...labels].some((value) => value === definition.label.toLocaleLowerCase() || definition.patterns.some((pattern) => containsAffirmedPattern(value, pattern))))
    || (track === "safety_lenses" && Object.values(PRODUCT_DIRECTION_DEFINITIONS).some((definition) => definition.track === "protective_eyewear"
      && [...labels].some((value) => value === definition.label.toLocaleLowerCase() || definition.patterns.some((pattern) => containsAffirmedPattern(value, pattern)))));
}

export function productDirectionsForTrack(track: string) {
  return [...new Set(Object.values(PRODUCT_DIRECTION_DEFINITIONS).filter((definition) => definition.track === track).map((definition) => definition.label))];
}

export function normalizeProductDirection(value: string) {
  const normalized = value.trim();
  if (!normalized) return "";
  const exact = Object.values(PRODUCT_DIRECTION_DEFINITIONS).find((definition) => definition.label.toLocaleLowerCase() === normalized.toLocaleLowerCase());
  if (exact) return exact.label;
  const matched = Object.values(PRODUCT_DIRECTION_DEFINITIONS).find((definition) => definition.patterns.some((pattern) => containsAffirmedPattern(normalized, pattern)));
  if (matched) return matched.label;
  return /eyewear|glasses|spectacle|optical|眼镜|镜片|镜架/i.test(normalized) ? "其他相关眼镜产品" : "";
}

export function normalizeProductDirections(values: string[]) {
  return [...new Set(values.map(normalizeProductDirection).filter(Boolean))];
}

export function businessRoleOptions() {
  return Object.values(BUSINESS_ROLE_DEFINITIONS).map((definition) => definition.label);
}

export function productDirectionOptions() {
  return [...new Set([...Object.values(PRODUCT_DIRECTION_DEFINITIONS).map((definition) => definition.label), "其他相关眼镜产品"])];
}

export const MARKET_SEARCH_PROFILES: Array<{
  match: RegExp;
  market: string;
  locale: string;
  roles: string[];
  products: Partial<Record<ProductTrack, string[]>>;
}> = [
  { match: /germany|deutschland|\bde\b/i, market: "Deutschland", locale: "de", roles: ["Großhändler", "Importeur", "Distributor", "Brillenmarke", "Einkaufsverband"], products: { optical_frames: ["Brillenfassungen"], sunglasses: ["Sonnenbrillen"], reading_glasses: ["Lesebrillen"], blue_light_glasses: ["Blaulichtfilterbrillen"], kids_eyewear: ["Kinderbrillen"], sports_eyewear: ["Sportbrillen"], protective_eyewear: ["Schutzbrillen"], optical_lenses: ["Brillengläser"], eyewear_accessories: ["Brillenzubehör", "Brillenetuis", "Nasenpads"] } },
  { match: /spain|españa|\bes\b/i, market: "España", locale: "es", roles: ["mayorista", "importador", "distribuidor", "marca de gafas", "grupo de compra"], products: { optical_frames: ["monturas ópticas"], sunglasses: ["gafas de sol"], reading_glasses: ["gafas de lectura"], blue_light_glasses: ["gafas para luz azul"], kids_eyewear: ["gafas infantiles"], sports_eyewear: ["gafas deportivas"], protective_eyewear: ["gafas de seguridad"], optical_lenses: ["lentes oftálmicas"], eyewear_accessories: ["accesorios para gafas", "estuches para gafas", "plaquetas nasales"] } },
  { match: /poland|polska|\bpl\b/i, market: "Polska", locale: "pl", roles: ["hurtownia", "importer", "dystrybutor", "marka okularów", "grupa zakupowa"], products: { optical_frames: ["oprawki okularowe"], sunglasses: ["okulary przeciwsłoneczne"], reading_glasses: ["okulary do czytania"], blue_light_glasses: ["okulary blokujące światło niebieskie"], kids_eyewear: ["okulary dziecięce"], sports_eyewear: ["okulary sportowe"], protective_eyewear: ["okulary ochronne"], optical_lenses: ["soczewki okularowe"], eyewear_accessories: ["akcesoria do okularów", "futerały na okulary", "noski do okularów"] } },
  { match: /france|français|\bfr\b/i, market: "France", locale: "fr", roles: ["grossiste", "importateur", "distributeur", "marque de lunettes", "groupement d'achat"], products: { optical_frames: ["montures optiques"], sunglasses: ["lunettes de soleil"], reading_glasses: ["lunettes de lecture"], protective_eyewear: ["lunettes de protection"], optical_lenses: ["verres optiques"], eyewear_accessories: ["accessoires de lunettes", "étuis à lunettes"] } },
  { match: /saudi|uae|emirates|arabia|السعودية|الإمارات/i, market: "الشرق الأوسط", locale: "ar", roles: ["مستورد نظارات", "موزع نظارات", "تاجر جملة نظارات"], products: { optical_frames: ["إطارات نظارات طبية"], sunglasses: ["نظارات شمسية"], reading_glasses: ["نظارات قراءة"], blue_light_glasses: ["نظارات حجب الضوء الأزرق"], kids_eyewear: ["نظارات أطفال"], sports_eyewear: ["نظارات رياضية"], protective_eyewear: ["نظارات واقية"], optical_lenses: ["عدسات بصرية"], eyewear_accessories: ["إكسسوارات النظارات", "علب النظارات", "وسادات الأنف"] } },
];
