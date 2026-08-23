import { normalizeBusinessRoles, normalizeProductDirections } from "@/lib/customer-scope";
import { safeJsonList } from "@/lib/lead-engine";

export type HistoricalReclassificationRow = {
  companyId: string;
  companyName: string;
  country: string | null;
  website: string | null;
  primaryDomain: string | null;
  companyType: string | null;
  customerType: string | null;
  customerTypesJson: string;
  companyRole: string | null;
  businessModel: string | null;
  productsJson: string;
  productDirectionsJson: string;
  wholesaleSignal: string | null;
  privateLabelSignal: string | null;
  oemSignal: string | null;
  businessEmail: string | null;
  contactChannel: string | null;
  isDuplicate: boolean;
  doNotContact: boolean;
  qualificationResult: string;
  workflowStatus: string;
  hardGateReason: string | null;
};

function rankedCounts(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
  return [...counts.entries()].sort((left, right) => right[1] - left[1]).slice(0, 10).map(([label, count]) => ({ label, count }));
}

export function buildHistoricalReclassificationDryRun(rows: HistoricalReclassificationRow[]) {
  const roleValues: string[] = [];
  const productValues: string[] = [];
  const exclusionReasons: string[] = [];
  const samples: Array<{ companyId: string; companyName: string; outcome: "possible_candidate" | "manual_review" | "still_excluded"; reasons: string[] }> = [];
  let possibleCandidates = 0;
  let manualReview = 0;
  let duplicates = 0;

  for (const row of rows) {
    const roles = normalizeBusinessRoles([
      ...safeJsonList(row.customerTypesJson),
      row.customerType || "",
      row.companyRole || "",
      row.companyType || "",
      row.businessModel || "",
      row.wholesaleSignal || "",
      row.privateLabelSignal || "",
      row.oemSignal || "",
    ]);
    const products = normalizeProductDirections([
      ...safeJsonList(row.productDirectionsJson),
      ...safeJsonList(row.productsJson),
    ]);
    const blockers: string[] = [];
    if (row.isDuplicate) { blockers.push("重复公司、域名或品牌关系"); duplicates += 1; }
    if (row.doNotContact) blockers.push("拒联、退订或禁止联系");
    if (!row.website && !row.primaryDomain) blockers.push("没有可重新核验的企业官网");
    if (!roles.length) blockers.push("现有记录没有可追溯 B2B 商业角色");
    if (!products.length) blockers.push("现有记录没有允许产品方向");
    if (/中国大陆直接竞争|隐形眼镜|智能眼镜|AI眼镜|AR\/VR|marketplace|名单站|医院|诊所/i.test(row.hardGateReason || "")) blockers.push("仍命中明确排除项");
    const hasContact = Boolean(row.businessEmail || row.contactChannel);
    if (!blockers.length && hasContact) {
      possibleCandidates += 1;
      roleValues.push(...roles);
      productValues.push(...products);
      samples.push({ companyId: row.companyId, companyName: row.companyName, outcome: "possible_candidate", reasons: [`商业角色：${roles.join("、")}`, `产品方向：${products.join("、")}`] });
    } else if (!blockers.some((reason) => /重复|拒联|明确排除/.test(reason))) {
      manualReview += 1;
      roleValues.push(...roles);
      productValues.push(...products);
      samples.push({ companyId: row.companyId, companyName: row.companyName, outcome: "manual_review", reasons: [...blockers, ...(hasContact ? [] : ["公开商务联系方式需重新核验"])] });
    } else {
      exclusionReasons.push(...blockers);
      samples.push({ companyId: row.companyId, companyName: row.companyName, outcome: "still_excluded", reasons: blockers });
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    mode: "read_only" as const,
    considered: rows.length,
    possibleCandidates,
    manualReview,
    stillExcluded: rows.length - possibleCandidates - manualReview,
    duplicates,
    topBusinessRoles: rankedCounts(roleValues),
    topProductDirections: rankedCounts(productValues),
    topExclusionReasons: rankedCounts(exclusionReasons),
    samples: samples.slice(0, 25),
    limitations: "仅根据现有数据库标签与摘要做只读预判；没有访问官网、没有改写评分、状态、Campaign 或审核历史。可能候选仍必须逐家服务器重新核验。",
  };
}
