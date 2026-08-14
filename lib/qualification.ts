import type { PublicBusinessContact, SiteEvidence } from "@/lib/discovery";

export const PRODUCT_DIRECTIONS = [
  "普通光学镜片",
  "非球面镜片",
  "防蓝光镜片",
  "变色镜片",
  "渐进镜片",
  "PC安全镜片",
  "老花镜",
  "其他相关眼镜产品",
] as const;

export const TARGET_CUSTOMER_TYPES = [
  "光学镜片批发商",
  "眼镜分销商",
  "光学用品进口商",
  "安全眼镜分销商",
  "老花镜或防蓝光眼镜批发商",
] as const;

export type QualificationInput = {
  evidence: SiteEvidence;
  score: number;
  evidenceCoverage: number;
  officialWebsiteVerified: boolean;
  sourceIsOfficial: boolean;
  searchResultOnly?: boolean;
  duplicate?: boolean;
  doNotContact?: boolean;
};

export type QualificationResult = {
  qualified: boolean;
  hardGateStatus: "pass" | "fail";
  customerType: string;
  companyRole: string;
  productDirections: string[];
  validContact: PublicBusinessContact | null;
  failures: string[];
  reasons: string[];
};

const EXCLUSION_PATTERNS: Array<[RegExp, string]> = [
  [/(consumer|patient|shop online|add to cart|single optical store|local optician|optometry clinic|eye clinic|hospital)/i, "个人消费者、小型单店或医疗机构"],
  [/(news|magazine|media|university|school|college|charity|foundation|nonprofit|non-profit)/i, "媒体、学校或慈善机构"],
  [/(marketplace|directory platform|classifieds|lead database|contact database)/i, "没有可验证企业主体的市场平台或名单站"],
];

function combinedEvidence(evidence: SiteEvidence) {
  return [
    evidence.companyName,
    evidence.companyType,
    evidence.country,
    ...evidence.eyewearTerms,
    ...evidence.b2bTerms,
    ...evidence.productTerms,
    ...evidence.pages.map((page) => page.text.slice(0, 20_000)),
  ].join(" ");
}

export function classifyCustomerType(evidence: SiteEvidence) {
  const text = combinedEvidence(evidence).toLocaleLowerCase();
  const wholesale = /(wholesale|wholesaler|trade account|trade customer|grosshandel|großhandel|mayorista|hurtownia)/i.test(text);
  const distributor = /(distributor|distribution|distributeur|distribuidor|dystrybutor|supplier to opticians|supply optical practices)/i.test(text);
  const importer = /(importer|import and distribut|imports? eyewear|imports? optical)/i.test(text);
  const safety = /(safety glasses|protective eyewear|industrial eye protection|pc safety|polycarbonate safety)/i.test(text);
  const readingOrBlue = /(reading glasses|readers|blue light|blue-light|computer glasses)/i.test(text);
  const lens = /(ophthalmic lens|optical lens|prescription lens|lens laboratory|optical laboratory|lenses)/i.test(text);

  if (safety && distributor) return "安全眼镜分销商";
  if (readingOrBlue && wholesale) return "老花镜或防蓝光眼镜批发商";
  if (lens && wholesale) return "光学镜片批发商";
  if (importer) return "光学用品进口商";
  if (distributor) return "眼镜分销商";
  return "";
}

export function classifyCompanyRole(evidence: SiteEvidence) {
  const text = combinedEvidence(evidence).toLocaleLowerCase();
  if (/(wholesale|wholesaler|grosshandel|großhandel|mayorista|hurtownia)/i.test(text)) return "批发商";
  if (/(distributor|distribution|distributeur|distribuidor|dystrybutor)/i.test(text)) return "分销商";
  if (/(importer|import and distribut)/i.test(text)) return "进口商";
  if (/(optical lab|ophthalmic lab|lens laboratory)/i.test(text)) return "光学实验室";
  if (/(retail chain|stores across|locations across)/i.test(text)) return "零售连锁";
  if (/(eyewear brand|our brand|branded eyewear)/i.test(text)) return "品牌商";
  return "其他";
}

export function classifyProductDirections(evidence: SiteEvidence) {
  const text = combinedEvidence(evidence).toLocaleLowerCase();
  const products: string[] = [];
  if (/(optical lens|ophthalmic lens|prescription lens|single vision)/i.test(text)) products.push("普通光学镜片");
  if (/(aspheric|非球面)/i.test(text)) products.push("非球面镜片");
  if (/(blue light|blue-light|blue blocker|防蓝光)/i.test(text)) products.push("防蓝光镜片");
  if (/(photochromic|transition lens|变色)/i.test(text)) products.push("变色镜片");
  if (/(progressive lens|varifocal|渐进)/i.test(text)) products.push("渐进镜片");
  if (/(polycarbonate|pc safety|safety lens|protective lens)/i.test(text)) products.push("PC安全镜片");
  if (/(reading glasses|readers|老花镜)/i.test(text)) products.push("老花镜");
  if (!products.length && evidence.eyewearTerms.length) products.push("其他相关眼镜产品");
  return products;
}

export function validPublicBusinessContact(contacts: PublicBusinessContact[]) {
  return contacts.find((contact) => contact.status === "valid" && contact.businessUse
    && (contact.sameCompanyDomain || contact.trustedOfficialSource)
    && ["email", "phone", "form", "contact_page"].includes(contact.type)) || null;
}

function exclusionReason(evidence: SiteEvidence) {
  const text = combinedEvidence(evidence);
  const identityText = [evidence.companyName, evidence.companyType, ...evidence.pages.map((page) => page.title)].join(" ");
  if (/^(china|people'?s republic of china|prc|中国)$/i.test(evidence.country.trim())) return "中国竞争者";
  if (/(manufacturer|factory|oem|odm)/i.test(text) && !/(distributor|wholesale|importer)/i.test(text)) return "仅观察到生产商/工厂身份，没有目标采购或分销角色";
  const matched = EXCLUSION_PATTERNS.find(([pattern], index) => pattern.test(index === 0 ? text : identityText));
  if (matched?.[1] === "个人消费者、小型单店或医疗机构" && classifyCustomerType(evidence)) return "";
  return matched?.[1] || "";
}

export function qualifyEvidence(input: QualificationInput): QualificationResult {
  const customerType = classifyCustomerType(input.evidence);
  const companyRole = classifyCompanyRole(input.evidence);
  const productDirections = classifyProductDirections(input.evidence);
  const validContact = validPublicBusinessContact(input.evidence.contacts);
  const excluded = exclusionReason(input.evidence);
  const failures: string[] = [];
  const reasons: string[] = [];

  if (input.searchResultOnly) failures.push("只有搜索结果，没有企业官网核验");
  if (!input.sourceIsOfficial) failures.push("发现来源不是官方目录或官方企业页面");
  if (!input.officialWebsiteVerified) failures.push("没有可访问且可归属的企业官网或官方企业页面");
  if (!input.evidence.eyewearTerms.length) failures.push("官网没有足够眼镜行业证据");
  if (!customerType) failures.push("不属于已确认的五类目标客户");
  if (excluded) failures.push(`触发排除项：${excluded}`);
  if (!validContact) failures.push("没有来自企业官网或可信官方页面的公开商务联系方式");
  if (input.score < 60) failures.push(`评分 ${input.score} 低于强制准入线 60`);
  if (input.evidenceCoverage < 55) failures.push(`证据覆盖率 ${input.evidenceCoverage}% 低于准入线 55%`);
  if (input.duplicate) failures.push("规范化域名、公司主体或品牌关系重复");
  if (input.doNotContact) failures.push("公司已标记禁止联系");

  if (customerType) reasons.push(`目标客户类型：${customerType}`);
  if (productDirections.length) reasons.push(`产品方向：${productDirections.join("、")}`);
  if (input.officialWebsiteVerified) reasons.push("企业官网已访问并通过同域身份核验");
  if (validContact) reasons.push(`公开商务联系方式有效：${validContact.type}`);
  reasons.push(`评分 ${input.score}；证据覆盖率 ${input.evidenceCoverage}%`);

  return {
    qualified: failures.length === 0,
    hardGateStatus: failures.length === 0 ? "pass" : "fail",
    customerType,
    companyRole,
    productDirections,
    validContact,
    failures,
    reasons,
  };
}
