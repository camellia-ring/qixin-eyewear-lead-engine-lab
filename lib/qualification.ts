import type { PublicBusinessContact, SiteEvidence } from "@/lib/discovery";
import {
  classifyBusinessRoles,
  classifyProductScope,
  containsAffirmedPattern,
  PROHIBITED_PRODUCT_DEFINITIONS,
  type EvidenceMatch,
} from "@/lib/customer-scope";

export const MIN_QUALIFICATION_SCORE = 60;
export const MIN_EVIDENCE_COVERAGE = 55;

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
  candidateForReview: boolean;
  hardGateStatus: "pass" | "fail" | "needs_review";
  customerType: string;
  customerTypes: string[];
  companyRole: string;
  productDirections: string[];
  prohibitedProducts: string[];
  roleEvidence: EvidenceMatch[];
  productEvidence: EvidenceMatch[];
  validContact: PublicBusinessContact | null;
  failures: string[];
  manualReviewReasons: string[];
  reasons: string[];
};

const EXCLUSION_PATTERNS: Array<[RegExp, string]> = [
  [/(?:individual consumer|patients? only|single optical store|single optician|local optician|optometry clinic|eye clinic|ophthalmology clinic|hospital)/i, "个人消费者、无批发证据的单体小店或医疗机构"],
  [/(?:news|magazine|media|university|school|college|charity|foundation|nonprofit|non-profit)/i, "媒体、学校或慈善机构"],
  [/(?:marketplace|directory platform|classifieds|lead database|contact database|business listing)/i, "没有可验证企业主体的 marketplace、名单站或联系数据库"],
];

function coreText(evidence: SiteEvidence) {
  return [
    evidence.companyName,
    evidence.companyType,
    ...evidence.eyewearTerms,
    ...evidence.b2bTerms,
    ...evidence.productTerms,
    ...evidence.pages.map((page) => page.classificationText || page.text),
  ].join("\n");
}

export function classifyCustomerTypes(evidence: SiteEvidence) {
  return classifyBusinessRoles(evidence).map((role) => role.value);
}

export function classifyCustomerType(evidence: SiteEvidence) {
  return classifyCustomerTypes(evidence)[0] || "";
}

export function classifyCompanyRole(evidence: SiteEvidence) {
  return classifyCustomerType(evidence) || "未知";
}

export function classifyProductDirections(evidence: SiteEvidence) {
  return classifyProductScope(evidence).productDirections;
}

export function validPublicBusinessContact(contacts: PublicBusinessContact[]) {
  return contacts.find((contact) => contact.status === "valid" && contact.businessUse
    && (contact.sameCompanyDomain || contact.trustedOfficialSource)
    && ["email", "phone", "form", "contact_page"].includes(contact.type)) || null;
}

function exclusionReason(evidence: SiteEvidence, roles: EvidenceMatch[], productScope: ReturnType<typeof classifyProductScope>) {
  const text = coreText(evidence);
  const identityText = [evidence.companyName, evidence.companyType, ...evidence.pages.map((page) => page.title)].join(" ");
  const mainlandChina = /^(?:china|people'?s republic of china|prc|中国|中国大陆)$/i.test(evidence.country.trim());
  const manufacturing = containsAffirmedPattern(text, /\b(?:manufacturer|manufacturing|factory|oem|odm|fabricante|fabrik|producent)\b|(?:制造商|工厂|生产厂家)/i);
  const supplierOnly = manufacturing && !roles.length;
  if (mainlandChina && manufacturing) return "中国大陆直接竞争供应商或制造工厂";
  if (supplierOnly) return "只有 manufacturer、factory、OEM 或 ODM 身份，没有独立采购、进口、批发、分销或品牌采购角色";
  const matched = EXCLUSION_PATTERNS.find(([pattern]) => containsAffirmedPattern(`${identityText}\n${text}`, pattern));
  if (matched && roles.length && matched[1].startsWith("个人消费者")) return "";
  if (matched) return matched[1];
  if (productScope.prohibitedProducts.length && !productScope.productDirections.some((product) => product !== "其他相关眼镜产品")) {
    return `仅观察到禁止产品：${productScope.prohibitedProducts.join("、")}`;
  }
  return "";
}

export function qualifyEvidence(input: QualificationInput): QualificationResult {
  const roleEvidence = classifyBusinessRoles(input.evidence);
  const customerTypes = roleEvidence.map((role) => role.value);
  const customerType = customerTypes[0] || "";
  const companyRole = customerType || "未知";
  const productScope = classifyProductScope(input.evidence);
  const productDirections = productScope.productDirections;
  const validContact = validPublicBusinessContact(input.evidence.contacts);
  const excluded = exclusionReason(input.evidence, roleEvidence, productScope);
  const failures: string[] = [];
  const manualReviewReasons: string[] = [];
  const reasons: string[] = [];
  const text = coreText(input.evidence);

  if (input.searchResultOnly) failures.push("只有搜索结果，没有企业官网或可归属官方企业页面核验");
  if (!input.sourceIsOfficial) failures.push("发现入口不是公开且获准的官方目录、官方企业页或其他已批准来源");
  if (!input.officialWebsiteVerified) failures.push("没有可访问且可归属的企业官网或官方企业页面");
  if (!productDirections.length) failures.push("官网没有允许范围内的眼镜或非电子配件产品证据");
  if (!customerTypes.length) failures.push("没有可追溯的采购、进口、批发、分销、品牌、集中采购或其他合格 B2B 商业角色证据");
  if (excluded) failures.push(`触发排除项：${excluded}`);
  if (!validContact) failures.push("没有来自企业官网同域或可信官方页面的公开商务联系方式");
  if (input.score < MIN_QUALIFICATION_SCORE) failures.push(`评分 ${input.score} 低于强制准入线 ${MIN_QUALIFICATION_SCORE}`);
  if (input.evidenceCoverage < MIN_EVIDENCE_COVERAGE) failures.push(`证据覆盖率 ${input.evidenceCoverage}% 低于准入线 ${MIN_EVIDENCE_COVERAGE}%`);
  if (input.duplicate) failures.push("规范化域名、公司主体、名称别名或品牌关系重复");
  if (input.doNotContact) failures.push("公司已进入拒联、退订或禁止联系名单");

  const ambiguousTechnology = containsAffirmedPattern(text, /\b(?:wearable technology|digital eyewear|electronic optics|heads?-up technology|connected device)\b|(?:可穿戴技术|电子光学)/i);
  if (!failures.length && ambiguousTechnology && !productDirections.some((product) => product !== "其他相关眼镜产品")) {
    manualReviewReasons.push("高科技产品边界不清，默认不自动合格，需人工确认普通非电子眼镜业务是否独立成立");
  }

  if (customerTypes.length) reasons.push(`B2B 商业角色：${customerTypes.join("、")}`);
  if (productDirections.length) reasons.push(`允许产品方向：${productDirections.join("、")}`);
  if (productScope.prohibitedProducts.length && productDirections.some((product) => product !== "其他相关眼镜产品")) {
    reasons.push(`同时观察到禁止产品 ${productScope.prohibitedProducts.join("、")}；禁止产品不计分，普通眼镜业务按独立证据审核`);
  }
  if (input.officialWebsiteVerified) reasons.push("企业官网已访问并通过同域身份核验");
  if (validContact) reasons.push(`公开商务联系方式有效：${validContact.type}`);
  reasons.push(`评分 ${input.score}；证据覆盖率 ${input.evidenceCoverage}%`);

  const hardGateStatus = failures.length ? "fail" : manualReviewReasons.length ? "needs_review" : "pass";
  return {
    qualified: hardGateStatus === "pass",
    candidateForReview: hardGateStatus !== "fail",
    hardGateStatus,
    customerType,
    customerTypes,
    companyRole,
    productDirections,
    prohibitedProducts: productScope.prohibitedProducts,
    roleEvidence,
    productEvidence: productScope.allowedMatches,
    validContact,
    failures,
    manualReviewReasons,
    reasons,
  };
}

export type ApprovalPolicyInput = {
  campaignAssigned: boolean;
  hardGateStatus: string;
  score: number;
  evidenceCoverage: number;
  scoreConfidence: string;
  doNotContact: boolean;
  sourceCount: number;
  contactPresent: boolean;
  scoreDimensionCount: number;
  expectedScoreDimensionCount: number;
  serverVerified: boolean;
};

export function approvalPolicyGaps(input: ApprovalPolicyInput) {
  return [
    input.campaignAssigned ? "" : "必须先分配到 Campaign",
    input.hardGateStatus === "pass" ? "" : "强制准入尚未通过",
    input.score >= MIN_QUALIFICATION_SCORE ? "" : `评分低于 ${MIN_QUALIFICATION_SCORE}`,
    input.evidenceCoverage >= MIN_EVIDENCE_COVERAGE ? "" : `证据覆盖率低于 ${MIN_EVIDENCE_COVERAGE}%`,
    input.scoreConfidence !== "low" ? "" : "评分可信度仍为低",
    input.doNotContact ? "已进入禁止联系名单" : "",
    input.sourceCount ? "" : "没有来源",
    input.contactPresent ? "" : "没有商务联系渠道",
    input.scoreDimensionCount === input.expectedScoreDimensionCount ? "" : "评分维度不完整",
    input.serverVerified ? "" : "尚未使用当前服务器规则重新核验",
  ].filter(Boolean);
}

export function prohibitedProductLabels() {
  return Object.values(PROHIBITED_PRODUCT_DEFINITIONS).map((definition) => definition.label);
}
