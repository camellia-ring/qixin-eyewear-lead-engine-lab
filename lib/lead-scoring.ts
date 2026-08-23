import {
  classifyBusinessRoles,
  classifyProductScope,
  type CustomerScopeEvidence,
} from "@/lib/customer-scope";

type ScoringContact = {
  type: string;
  sameCompanyDomain: boolean;
  trustedOfficialSource: boolean;
  businessUse: boolean;
  status: string;
};

export type ScorableEvidence = CustomerScopeEvidence & {
  businessEmail: string;
  contactChannel: string;
  contacts: ScoringContact[];
};

function coreText(evidence: CustomerScopeEvidence) {
  return evidence.pages.map((page) => page.classificationText || page.text).join("\n");
}
function validBusinessContact(evidence: ScorableEvidence) {
  return evidence.contacts.find((contact) => contact.status === "valid" && contact.businessUse
    && (contact.sameCompanyDomain || contact.trustedOfficialSource));
}

function scoreReasons(positive: string, negative: string) {
  return [positive || "没有可计分的正面证据", negative || "没有额外扣分证据"] as [string, string];
}

export function deterministicScore(evidence: ScorableEvidence) {
  const roles = classifyBusinessRoles(evidence);
  const productScope = classifyProductScope(evidence);
  const specificProducts = productScope.productDirections.filter((product) => product !== "其他相关眼镜产品");
  const text = coreText(evidence);
  const procurementSignals = [
    /\b(?:procurement|purchasing|category buyer|sourcing|trade account|bulk order|we import|we source|we purchase)\b/i,
    /\b(?:achats?|acheteur|compras?|comprador|einkauf|einkäufer|zakupy|kupiec|acquisti)\b/i,
    /(?:采购|进货|集中采购|渠道采购)/i,
  ].filter((pattern) => pattern.test(text));
  const orderFitSignals = [
    /\b(?:minimum order|minimum quantity|moq|case pack|bulk order|trade order|wholesale account)\b/i,
    /\b(?:commande minimum|pedido mínimo|mindestbestell|minimalne zamówienie)\b/i,
    /(?:最小起订|批量订单|贸易账户)/i,
  ].filter((pattern) => pattern.test(text));
  const scaleSignals = [
    /\b(?:stores|locations|branches) (?:across|nationwide|throughout|in \d+)\b/i,
    /\b(?:multi-country|international distribution|nationwide network|brand portfolio|hundreds of stores)\b/i,
    /(?:全国门店|多国渠道|品牌组合|采购联盟)/i,
  ].filter((pattern) => pattern.test(text));
  const contact = validBusinessContact(evidence);

  const productMatchScore = !productScope.productDirections.length
    ? 0
    : specificProducts.length >= 3 ? 25
      : specificProducts.length === 2 ? 23
        : specificProducts.length === 1 ? 20 : 12;
  const customerTypeScore = roles.length >= 2 ? 20 : roles.length === 1 ? 17 : 0;
  const purchasingSignalsScore = roles.length
    ? Math.min(15, 8 + procurementSignals.length * 3 + (roles.length >= 2 ? 1 : 0))
    : 0;
  const marketMoqFitScore = Math.min(15, (evidence.country ? 3 : 0) + orderFitSignals.length * 6 + (procurementSignals.length ? 2 : 0));
  const contactabilityScore = !contact ? 0 : contact.type === "email" ? 10 : contact.sameCompanyDomain ? 8 : 6;
  const accountPotentialScore = Math.min(10, roles.length ? 3 + scaleSignals.length * 3 + (roles.length >= 2 ? 1 : 0) : 0);
  const dataQualityScore = evidence.pages.length >= 3 ? 5 : evidence.pages.length === 2 ? 4 : evidence.pages.length === 1 ? 3 : 0;

  const evidenceCoverage = Math.min(100,
    (evidence.pages.length ? 10 : 0)
    + (evidence.pages.length >= 2 ? 8 : 0)
    + (productScope.productDirections.length ? 15 : 0)
    + (roles.length ? 15 : 0)
    + (procurementSignals.length || roles.length ? 10 : 0)
    + (contact ? 15 : 0)
    + (evidence.country ? 5 : 0)
    + (evidence.companyName ? 5 : 0)
    + (roles.some((role) => role.sourceUrls.length) ? 7 : 0)
    + (productScope.allowedMatches.some((product) => product.sourceUrls.length) ? 5 : 0));

  return {
    productMatchScore,
    customerTypeScore,
    purchasingSignalsScore,
    marketMoqFitScore,
    contactabilityScore,
    accountPotentialScore,
    dataQualityScore,
    evidenceCoverage,
    scoreConfidence: evidence.pages.length >= 3 && roles.length && productScope.productDirections.length ? "high" : evidence.pages.length >= 2 ? "medium" : "low",
    hardGateStatus: "needs_review",
    reasons: {
      productMatchScore: scoreReasons(
        productScope.productDirections.length ? `允许产品证据：${productScope.productDirections.join("、")}` : "",
        productScope.productDirections.length ? `禁止产品不计分：${productScope.prohibitedProducts.join("、") || "未观察到"}` : "未观察到允许范围内的核心产品证据",
      ),
      customerTypeScore: scoreReasons(
        roles.length ? `可核验 B2B 商业角色：${roles.map((role) => role.value).join("、")}` : "",
        roles.length ? "角色仍须按对应官网来源人工复核" : "未观察到采购、进口、批发、分销、品牌或集中采购角色证据",
      ),
      purchasingSignalsScore: scoreReasons(
        procurementSignals.length ? `观察到 ${procurementSignals.length} 组采购/渠道信号` : roles.length ? "商业角色本身提供基础渠道信号" : "",
        procurementSignals.length ? "没有把一般供应商自述当作采购项目" : "未观察到明确采购、进口、渠道、私牌或 trade account 信号",
      ),
      marketMoqFitScore: scoreReasons(
        [evidence.country ? `国家已核验：${evidence.country}` : "", orderFitSignals.length ? `观察到 ${orderFitSignals.length} 组可验证订单模式信号` : ""].filter(Boolean).join("；"),
        orderFitSignals.length ? "未对未披露的采购量作推测" : "MOQ、采购量和订单适配未知，不给予高分",
      ),
      contactabilityScore: scoreReasons(
        contact ? `公开商务联系方式已核验：${contact.type}` : "",
        contact ? "没有采集或猜测私人联系方式" : "没有企业同域或可信官方页面上的公开商务联系方式",
      ),
      accountPotentialScore: scoreReasons(
        scaleSignals.length ? `观察到 ${scaleSignals.length} 组渠道规模、多门店或品牌组合信号` : roles.length ? "已确认商业渠道角色" : "",
        scaleSignals.length ? "未对未披露营收或采购额作推测" : "渠道规模、门店覆盖和品牌组合缺少可验证证据",
      ),
      dataQualityScore: scoreReasons(
        evidence.pages.length ? `已采集 ${evidence.pages.length} 个企业官网核心页面并保留来源` : "",
        evidence.pages.length >= 2 ? "仍需人工复核证据语境" : "官网页面或来源覆盖不足",
      ),
    } as Record<string, [string, string]>,
  };
}
