import { SCORE_LIMITS } from "@/lib/lead-engine";
import { normalizeBusinessRoles } from "@/lib/customer-scope";
import type { ReportingPeriod } from "@/lib/reporting-period";

export type SearchKeyword = { keyword: string; locale: string; purpose: string };
export type Campaign = {
  id: string; name: string; productTrack: string; targetCountriesJson: string; targetMarkets: string;
  productTypesJson: string; customerTypesJson: string; targetCount: number; moqFit?: string; companySize?: string;
  positioning?: string; exclusionsJson: string; regionKey: string; productTracksJson: string; strategyPriority: number;
  automationConfigJson: string; status: string; searchKeywords: SearchKeyword[]; researchBrief: string;
};
export type Lead = {
  id: string; campaignId: string; companyId: string; qualificationResult: string; workflowStatus: string;
  productTrack: string; recommendedProductsJson: string; riskSummary?: string; hardGateStatus: string;
  hardGateReason?: string; currentScore: number; grade: string; evidenceCoverage: number; scoreConfidence: string;
  reviewedAt?: string; autoQualifiedAt?: string; lastVerifiedAt?: string; exportedAt?: string; createdAt: string;
};
export type Company = {
  id: string; companyName: string; country?: string; region?: string; city?: string; companyType?: string; customerType?: string; companyRole?: string; businessModel?: string;
  customerTypesJson?: string; primaryCampaignId?: string;
  website?: string; primaryDomain?: string; productsJson: string; brandsJson: string; wholesaleSignal?: string;
  privateLabelSignal?: string; oemSignal?: string; pricePosition?: string; companySize?: string;
  productDirectionsJson?: string; analysisSummary?: string; analysisConfidence: string; businessEmail?: string; contactChannel?: string;
  contactStatus?: string; sourceType?: string; sourceName?: string; isDuplicate?: boolean; duplicateOfCompanyId?: string;
  estimatedPurchaseVolume?: string; doNotContact: boolean; firstDiscoveredAt?: string; lastVerifiedAt?: string; lastAnalyzedAt?: string;
};
export type Source = { id: string; companyId: string; leadId?: string; sourceUrl: string; sourceType: string; pageTitle?: string; retrievedAt: string; evidenceSummary?: string; confidence: string };
export type Claim = { id: string; sourceId: string; companyId: string; leadId?: string; claimType: string; claimSummary: string; evidenceKind: string; confidence: string };
export type ScoreRun = { id: string; leadId: string; rubricVersion: string; totalScore: number; grade: string; evidenceCoverage: number; overallConfidence: string; modelIdentifier: string; createdAt: string };
export type ScoreDimension = { id: string; scoreRunId: string; dimension: string; score: number; maxScore: number; positiveReason?: string; negativeReason?: string; evidenceIdsJson: string };
export type Review = { id: string; leadId: string; decision: string; notes?: string; decidedBy: string; createdAt: string };
export type ImportRun = { id: string; campaignId: string; originalFilename?: string; rowCount: number; importedCount: number; skippedCount: number; status: string; createdAt: string };
export type ExportRun = { id: string; campaignId: string; rowCount: number; createdAt: string };
export type DiscoverySource = {
  id: string; campaignId: string; name: string; sourceUrl: string; normalizedDomain: string; status: string;
  sourceType: string; region: string; tier: string; enabled: boolean; parserKey: string; parserVersion: string;
  cadence: string; maxCandidates: number; priority: number; lastRunAt?: string; lastSuccessAt?: string; nextRunAt?: string;
  lastDiscoveredCount: number; lastQualifiedCount: number; lastDuplicateCount: number; failureCount: number;
  robotsStatus: string; accessNotes?: string; requiresLogin: boolean; isPaid: boolean; lastError?: string; createdAt: string; updatedAt: string;
};
export type DiscoveryRun = {
  id: string; sourceId: string; campaignId: string; trigger: string; status: string; discoveredCount: number;
  importedCount: number; duplicateCount: number; excludedCount: number; failedCount: number; pagesFetched: number;
  targetDate?: string; rawDiscoveredCount: number; parsedCount: number; websiteVerifiedCount: number;
  validContactCount: number; mandatoryGateFailedCount: number; qualifiedCount: number;
  errorSummary?: string; startedAt: string; completedAt?: string; createdAt: string;
};
export type DiscoveryItem = { id: string; runId: string; companyId?: string; websiteUrl: string; normalizedDomain: string; companyName?: string; outcome: string; reason?: string; evidenceCount: number; createdAt: string };
export type EngineState = { id: string; status: string; timezone: string; activeCampaignId?: string; startedAt?: string; pausedAt?: string; stoppedAt?: string; lastHeartbeatAt?: string; lastRunAt?: string; nextRunAt?: string; lastError?: string };
export type DailyLedger = { id: string; targetDate: string; timezone: string; rawDiscoveredCount: number; parsedCount: number; websiteVerifiedCount: number; validContactCount: number; duplicateCount: number; mandatoryGateFailedCount: number; qualifiedCount: number; failedCount: number; sourceExhausted: boolean; availabilityNote?: string; updatedAt: string };
export type DiscoveryStats = {
  generatedAt: string;
  timeZone: string;
  definition: string;
  summary: { today: number; yesterday: number; week: number; month: number; quarter: number; year: number; total: number };
  periods: Record<"week" | "month" | "quarter" | "year", ReportingPeriod>;
  history: {
    rows: Array<{ date: string; label: string; count: number }>;
    previousBefore: string | null;
    earliestCompletedDate: string | null;
  };
};
export type ContactVerification = { id: string; companyId: string; leadId?: string; contactType: string; contactValue?: string; sourceUrl: string; sourceTitle?: string; sameCompanyDomain: boolean; businessUse: boolean; status: string; failureReason?: string; verifiedAt: string };
export type DiscoveryAlert = { id: string; sourceId?: string; runId?: string; targetDate?: string; severity: string; alertType: string; message: string; resolvedAt?: string; createdAt: string };
export type SourceHealth = { id: string; sourceId: string; checkedAt: string; status: string; discoveredCount: number; qualifiedCount: number; duplicateCount: number; failureCount: number; latencyMs?: number; note?: string };
export type ReclassificationDryRun = {
  generatedAt: string; mode: "read_only"; considered: number; possibleCandidates: number; manualReview: number;
  stillExcluded: number; duplicates: number; topBusinessRoles: Array<{ label: string; count: number }>;
  topProductDirections: Array<{ label: string; count: number }>; topExclusionReasons: Array<{ label: string; count: number }>;
  samples: Array<{ companyId: string; companyName: string; outcome: string; reasons: string[] }>; limitations: string;
};
export type LeadListRow = {
  leadId: string; campaignId: string; companyId: string; workflowStatus: string; qualificationResult: string;
  assignmentType: string; matchStatus: string; matchReason?: string; hardGateStatus: string; hardGateReason?: string;
  riskSummary?: string; score: number; grade: string; evidenceCoverage: number; confidence: string; autoQualifiedAt?: string;
  companyName: string; country?: string; region?: string; companyType?: string; customerType?: string; customerTypesJson?: string;
  companyRole?: string; companySize?: string; pricePosition?: string; productsJson: string; brandsJson: string; wholesaleSignal?: string;
  productDirectionsJson?: string; website?: string; primaryDomain?: string; businessEmail?: string; contactChannel?: string;
  contactStatus?: string; sourceType?: string; sourceName?: string; primaryCampaignId?: string; firstDiscoveredAt?: string;
  lastVerifiedAt?: string; isDuplicate: boolean; doNotContact: boolean;
  reviewedAt?: string;
};
export type LeadPage = {
  rows: LeadListRow[];
  pagination: { page: number; pageSize: number; total: number; pageCount: number };
  facets: { statusCounts: Record<string, number>; reviewStateCounts: Record<string, number>; gradeCounts: Record<string, number>; regions: Array<{ value: string; label: string }>; countries: string[]; companyTypes: string[]; productDirections: string[]; sourceTypes: string[] };
  completion?: ReportingPeriod | null;
};
export type LeadDetail = {
  lead: Lead; company: Company; sources: Source[]; claims: Claim[]; scoreRun: ScoreRun | null;
  scoreDimensions: ScoreDimension[]; reviews: Review[]; domains: Array<{ id: string; normalizedDomain: string; relationshipType: string }>;
  contactCount: number; contactVerifications: ContactVerification[];
  memberships: Array<{ leadId: string; campaignId: string; campaignName: string; campaignStatus: string; strategyPriority: number; assignmentType: string; matchStatus: string; matchReason?: string; matchedAt?: string }>;
};
export type Workspace = {
  campaigns: Campaign[]; leadCounts: Record<string, Record<string, number>>; imports: ImportRun[]; exports: ExportRun[];
  discoverySources: DiscoverySource[]; discoveryRuns: DiscoveryRun[]; discoveryItems: DiscoveryItem[];
  engineState: EngineState | null; dailyLedgers: DailyLedger[]; discoveryAlerts: DiscoveryAlert[];
  sourceHealth: SourceHealth[]; discoveryAttempts: Array<Record<string, unknown>>; parserVersions: Array<Record<string, unknown>>;
};

export const EMPTY_WORKSPACE: Workspace = { campaigns: [], leadCounts: {}, imports: [], exports: [], discoverySources: [], discoveryRuns: [], discoveryItems: [], engineState: null, dailyLedgers: [], discoveryAlerts: [], sourceHealth: [], discoveryAttempts: [], parserVersions: [] };
export const EMPTY_LEAD_PAGE: LeadPage = { rows: [], pagination: { page: 1, pageSize: 25, total: 0, pageCount: 1 }, facets: { statusCounts: { all: 0 }, reviewStateCounts: { unreviewed: 0, reviewed: 0 }, gradeCounts: {}, regions: [], countries: [], companyTypes: [], productDirections: [], sourceTypes: [] } };
export const EMPTY_DISCOVERY_STATS: DiscoveryStats = {
  generatedAt: "",
  timeZone: "Asia/Shanghai",
  definition: "自动发现后通过筛选、公司级去重并保存的唯一合格公司；导入客户不计入",
  summary: { today: 0, yesterday: 0, week: 0, month: 0, quarter: 0, year: 0, total: 0 },
  periods: {
    week: { kind: "week", anchor: "", startDate: "", endDate: "", from: "", to: "", label: "本周" },
    month: { kind: "month", anchor: "", startDate: "", endDate: "", from: "", to: "", label: "本月" },
    quarter: { kind: "quarter", anchor: "", startDate: "", endDate: "", from: "", to: "", label: "本季度" },
    year: { kind: "year", anchor: "", startDate: "", endDate: "", from: "", to: "", label: "本年" },
  },
  history: { rows: [], previousBefore: null, earliestCompletedDate: null },
};
export const SCORE_LABELS: Record<string, string> = { productMatchScore: "产品匹配", customerTypeScore: "客户 / 渠道类型", purchasingSignalsScore: "采购与批发信号", marketMoqFitScore: "市场、MOQ 与运营适配", contactabilityScore: "可联系性", accountPotentialScore: "客户潜力", dataQualityScore: "数据新鲜度与完整度" };
export const STATUS_LABELS: Record<string, string> = { all: "全部机会", discovered: "新发现", analyzed: "已分析", qualified: "AI 合格", needs_review: "待审核", approved: "已批准", rejected: "已淘汰" };
export const CONFIDENCE_LABELS: Record<string, string> = { high: "高", medium: "中等", low: "低" };
const COUNTRY_LABELS: Record<string, string> = { "United Kingdom": "英国", UK: "英国", Germany: "德国", France: "法国", Italy: "意大利", Spain: "西班牙" };
export const VIEW_LABELS = { review: "客户审核", campaign: "Campaign", discovery: "自动发现", export: "CRM 导出", advanced: "高级工具" } as const;
export type ViewKey = keyof typeof VIEW_LABELS;

export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, { credentials: "same-origin", cache: "no-store", ...options, headers: { "Content-Type": "application/json", ...(options?.headers || {}) } });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new Error("网络请求中断。系统状态会自动刷新，请勿重复点击。");
  }
  const payload = await response.json().catch(() => ({})) as T & { message?: string; error?: string };
  if (!response.ok) throw new Error(payload.message || payload.error || "请求未完成");
  return payload;
}

export function jsonList(value?: string) { try { const result = JSON.parse(value || "[]"); return Array.isArray(result) ? result.map(String) : []; } catch { return []; } }
export function formList(data: FormData, name: string) { return [...new Set(data.getAll(name).flatMap((value) => String(value).split(/[;|,\n]/)).map((value) => value.trim()).filter(Boolean))]; }
export function formatDate(value?: string) { if (!value) return "未记录"; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(date); }
export function downloadText(filename: string, content: string, type = "text/plain;charset=utf-8") { const url = URL.createObjectURL(new Blob([content], { type })); const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url); }
export function localizedCountry(value?: string) { return value ? COUNTRY_LABELS[value] || value : "未记录"; }
export function localizedCompanyType(value?: string) { if (!value) return "类型待确认"; const normalized = value.toLocaleLowerCase(); if (normalized.includes("manufacturer")) return "眼镜制造商"; if (normalized.includes("retail chain")) return "眼镜零售连锁"; if (normalized.includes("special") && normalized.includes("distributor")) return "特种镜架经销商"; if (normalized.includes("wholesaler") && normalized.includes("brand")) return "眼镜品牌 / 批发商"; if (normalized.includes("distributor") && normalized.includes("brand")) return "眼镜品牌 / 经销商"; if (normalized.includes("retailer") && normalized.includes("brand")) return "眼镜品牌 / 零售商"; if (normalized.includes("wholesaler")) return "独立眼镜批发商"; if (normalized.includes("distributor")) return "眼镜分销商"; if (normalized.includes("retailer")) return "眼镜零售商"; if (normalized.includes("brand")) return "眼镜品牌"; return value; }
export function customerTypeLabel(company: { customerTypesJson?: string; customerType?: string; companyType?: string }) { const values = normalizeBusinessRoles([...jsonList(company.customerTypesJson), company.customerType || ""]); return values.length ? values.join(" · ") : localizedCompanyType(company.companyType); }
export function companyWebsiteUrl(company?: Pick<Company, "website" | "primaryDomain">) { const rawValue = company?.website || company?.primaryDomain; if (!rawValue) return ""; try { const url = new URL(/^https?:\/\//i.test(rawValue) ? rawValue : `https://${rawValue}`); return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : ""; } catch { return ""; } }
export function companySignal(company?: Pick<Company, "productsJson" | "brandsJson" | "businessEmail" | "contactChannel" | "wholesaleSignal">) { if (!company) return "证据待加载"; const products = jsonList(company.productsJson); const brands = jsonList(company.brandsJson); return [company.wholesaleSignal, products.length ? `产品 ${products.slice(0, 2).join("、")}` : "", brands.length ? `品牌 ${brands.slice(0, 2).join("、")}` : "", company.businessEmail || company.contactChannel ? "有公开商务渠道" : "商务渠道待补"].filter(Boolean).join(" · "); }
export function compactRisk(lead?: Lead) { if (!lead) return "风险待加载"; return [lead.hardGateStatus !== "pass" ? lead.hardGateReason || "强制准入未通过" : "", lead.riskSummary].filter(Boolean).join("；") || "未发现阻断性风险，仍需人工判断。"; }

export const scoreDimensionCount = Object.keys(SCORE_LIMITS).length;
