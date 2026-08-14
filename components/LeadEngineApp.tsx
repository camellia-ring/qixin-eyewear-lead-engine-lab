"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  IconAlertTriangle,
  IconCheck,
  IconClipboard,
  IconClock,
  IconDownload,
  IconExternalLink,
  IconFileDescription,
  IconFileExport,
  IconLetterQ,
  IconPlus,
  IconPlayerPause,
  IconPlayerPlay,
  IconRadar,
  IconSearch,
  IconSettings,
  IconShieldLock,
  IconTargetArrow,
  IconTrash,
  IconUpload,
  IconUsers,
  IconX,
} from "@tabler/icons-react";
import { SCORE_LIMITS } from "@/lib/lead-engine";
import styles from "./LeadEngineApp.module.css";

type SearchKeyword = { keyword: string; locale: string; purpose: string };
type Campaign = {
  id: string; name: string; productTrack: string; targetCountriesJson: string; targetMarkets: string;
  productTypesJson: string; customerTypesJson: string; targetCount: number; moqFit?: string; companySize?: string;
  positioning?: string; exclusionsJson: string; status: string; searchKeywords: SearchKeyword[]; researchBrief: string;
};
type Lead = {
  id: string; campaignId: string; companyId: string; qualificationResult: string; workflowStatus: string;
  productTrack: string; recommendedProductsJson: string; riskSummary?: string; hardGateStatus: string;
  hardGateReason?: string; currentScore: number; grade: string; evidenceCoverage: number; scoreConfidence: string;
  reviewedAt?: string; autoQualifiedAt?: string; lastVerifiedAt?: string; exportedAt?: string; createdAt: string;
};
type Company = {
  id: string; companyName: string; country?: string; region?: string; city?: string; companyType?: string; customerType?: string; companyRole?: string; businessModel?: string;
  website?: string; primaryDomain?: string; productsJson: string; brandsJson: string; wholesaleSignal?: string;
  privateLabelSignal?: string; oemSignal?: string; pricePosition?: string; companySize?: string;
  productDirectionsJson?: string; analysisSummary?: string; analysisConfidence: string; businessEmail?: string; contactChannel?: string;
  contactStatus?: string; sourceType?: string; sourceName?: string; isDuplicate?: boolean; duplicateOfCompanyId?: string;
  estimatedPurchaseVolume?: string; doNotContact: boolean; firstDiscoveredAt?: string; lastVerifiedAt?: string; lastAnalyzedAt?: string;
};
type Contact = { id: string; companyId: string; fullName: string; jobTitle?: string; email?: string; whatsapp?: string; verificationStatus: string; sourceUrl?: string; isPrimary: boolean };
type Source = { id: string; companyId: string; leadId?: string; sourceUrl: string; sourceType: string; pageTitle?: string; retrievedAt: string; evidenceSummary?: string; confidence: string };
type Claim = { id: string; sourceId: string; companyId: string; leadId?: string; claimType: string; claimSummary: string; evidenceKind: string; confidence: string };
type ScoreRun = { id: string; leadId: string; rubricVersion: string; totalScore: number; grade: string; evidenceCoverage: number; overallConfidence: string; modelIdentifier: string; createdAt: string };
type ScoreDimension = { id: string; scoreRunId: string; dimension: string; score: number; maxScore: number; positiveReason?: string; negativeReason?: string; evidenceIdsJson: string };
type Review = { id: string; leadId: string; decision: string; notes?: string; decidedBy: string; createdAt: string };
type ImportRun = { id: string; campaignId: string; originalFilename?: string; rowCount: number; importedCount: number; skippedCount: number; status: string; createdAt: string };
type ExportRun = { id: string; campaignId: string; rowCount: number; createdAt: string };
type DiscoverySource = {
  id: string; campaignId: string; name: string; sourceUrl: string; normalizedDomain: string; status: string;
  sourceType: string; region: string; tier: string; enabled: boolean; parserKey: string; parserVersion: string;
  cadence: string; maxCandidates: number; priority: number; lastRunAt?: string; lastSuccessAt?: string; nextRunAt?: string;
  lastDiscoveredCount: number; lastQualifiedCount: number; lastDuplicateCount: number; failureCount: number;
  robotsStatus: string; accessNotes?: string; requiresLogin: boolean; isPaid: boolean; lastError?: string; createdAt: string; updatedAt: string;
};
type DiscoveryRun = {
  id: string; sourceId: string; campaignId: string; trigger: string; status: string; discoveredCount: number;
  importedCount: number; duplicateCount: number; excludedCount: number; failedCount: number; pagesFetched: number;
  targetDate?: string; rawDiscoveredCount: number; parsedCount: number; websiteVerifiedCount: number;
  validContactCount: number; mandatoryGateFailedCount: number; qualifiedCount: number;
  errorSummary?: string; startedAt: string; completedAt?: string; createdAt: string;
};
type DiscoveryItem = {
  id: string; runId: string; companyId?: string; websiteUrl: string; normalizedDomain: string; companyName?: string;
  outcome: string; reason?: string; evidenceCount: number; createdAt: string;
};
type EngineState = { id: string; status: string; timezone: string; dailyTarget: number; activeCampaignId?: string; startedAt?: string; pausedAt?: string; stoppedAt?: string; lastHeartbeatAt?: string; lastRunAt?: string; nextRunAt?: string; lastError?: string };
type DailyTarget = { id: string; targetDate: string; timezone: string; targetCount: number; rawDiscoveredCount: number; parsedCount: number; websiteVerifiedCount: number; validContactCount: number; duplicateCount: number; mandatoryGateFailedCount: number; qualifiedCount: number; failedCount: number; sourceExhausted: boolean; deficitReason?: string; updatedAt: string };
type ContactVerification = { id: string; companyId: string; leadId?: string; contactType: string; contactValue?: string; sourceUrl: string; sourceTitle?: string; sameCompanyDomain: boolean; businessUse: boolean; status: string; failureReason?: string; verifiedAt: string };
type DiscoveryAlert = { id: string; sourceId?: string; runId?: string; targetDate?: string; severity: string; alertType: string; message: string; resolvedAt?: string; createdAt: string };
type SourceHealth = { id: string; sourceId: string; checkedAt: string; status: string; discoveredCount: number; qualifiedCount: number; duplicateCount: number; failureCount: number; latencyMs?: number; note?: string };
type Workspace = {
  campaigns: Campaign[]; leads: Lead[]; companies: Company[]; contacts: Contact[]; sources: Source[]; claims: Claim[];
  scoreRuns: ScoreRun[]; scoreDimensions: ScoreDimension[]; reviews: Review[]; imports: ImportRun[]; exports: ExportRun[];
  domains: Array<{ id: string; normalizedDomain: string }>; domainLinks: Array<{ id: string; companyId: string; domainId: string; relationshipType: string }>;
  discoverySources: DiscoverySource[]; discoveryRuns: DiscoveryRun[]; discoveryItems: DiscoveryItem[];
  engineState: EngineState | null; dailyTargets: DailyTarget[]; contactVerifications: ContactVerification[];
  discoveryAlerts: DiscoveryAlert[]; sourceHealth: SourceHealth[]; discoveryAttempts: Array<Record<string, unknown>>; parserVersions: Array<Record<string, unknown>>;
};

const EMPTY_WORKSPACE: Workspace = { campaigns: [], leads: [], companies: [], contacts: [], sources: [], claims: [], scoreRuns: [], scoreDimensions: [], reviews: [], imports: [], exports: [], domains: [], domainLinks: [], discoverySources: [], discoveryRuns: [], discoveryItems: [], engineState: null, dailyTargets: [], contactVerifications: [], discoveryAlerts: [], sourceHealth: [], discoveryAttempts: [], parserVersions: [] };
const STATUS_FILTERS = ["all", "discovered", "analyzed", "qualified", "needs_review", "approved", "rejected"];
const SCORE_LABELS: Record<string, string> = {
  productMatchScore: "产品匹配",
  customerTypeScore: "客户 / 渠道类型",
  purchasingSignalsScore: "采购与批发信号",
  marketMoqFitScore: "市场、MOQ 与运营适配",
  contactabilityScore: "可联系性",
  accountPotentialScore: "客户潜力",
  dataQualityScore: "数据新鲜度与完整度",
};
const STATUS_LABELS: Record<string, string> = {
  all: "全部机会", discovered: "新发现", analyzed: "已分析", qualified: "AI 合格", needs_review: "待审核", approved: "已批准", rejected: "已淘汰",
};
const PRODUCT_LABELS: Record<string, string> = {
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
const PRODUCT_OPTIONS = Object.entries(PRODUCT_LABELS);
const PRODUCT_DIRECTIONS = ["普通光学镜片", "非球面镜片", "防蓝光镜片", "变色镜片", "渐进镜片", "PC安全镜片", "老花镜", "其他相关眼镜产品"];
const CONFIDENCE_LABELS: Record<string, string> = { high: "高", medium: "中等", low: "低" };
const COUNTRY_LABELS: Record<string, string> = {
  "United Kingdom": "英国", UK: "英国", Germany: "德国", France: "法国", Italy: "意大利", Spain: "西班牙",
};
const VIEW_LABELS = {
  review: "客户审核",
  campaign: "Campaign",
  discovery: "自动发现",
  research: "调研任务",
  import: "数据导入",
  export: "CRM 导出",
} as const;
type ViewKey = keyof typeof VIEW_LABELS;
const HEADER_MAP: Record<string, string> = {
  company_name: "companyName", company_type: "companyType", business_model: "businessModel", product_track: "productTrack",
  recommended_products: "recommendedProducts", estimated_purchase_volume: "estimatedPurchaseVolume", business_email: "businessEmail",
  contact_channel: "contactChannel", contact_name: "contactName", contact_role: "contactRole", contact_email: "contactEmail",
  contact_verification: "contactVerification", wholesale_signal: "wholesaleSignal", private_label_signal: "privateLabelSignal",
  oem_signal: "oemSignal", price_position: "pricePosition", company_size: "companySize", analysis_summary: "analysisSummary",
  analysis_confidence: "analysisConfidence", source_url: "sourceUrl", source_urls: "sourceUrls", source_type: "sourceType",
  source_title: "sourceTitle", retrieved_at: "retrievedAt", source_confidence: "sourceConfidence", evidence_summary: "evidenceSummary",
  evidence_kind: "evidenceKind", claim_type: "claimType", claim_confidence: "claimConfidence", hard_gate_status: "hardGateStatus",
  hard_gate_reason: "hardGateReason", evidence_coverage: "evidenceCoverage", score_confidence: "scoreConfidence", risk_summary: "riskSummary",
  product_match_score: "productMatchScore", product_match_positive_reason: "productMatchPositiveReason", product_match_negative_reason: "productMatchNegativeReason",
  customer_type_score: "customerTypeScore", customer_type_positive_reason: "customerTypePositiveReason", customer_type_negative_reason: "customerTypeNegativeReason",
  purchasing_signals_score: "purchasingSignalsScore", purchasing_signals_positive_reason: "purchasingSignalsPositiveReason", purchasing_signals_negative_reason: "purchasingSignalsNegativeReason",
  market_moq_fit_score: "marketMoqFitScore", market_moq_fit_positive_reason: "marketMoqFitPositiveReason", market_moq_fit_negative_reason: "marketMoqFitNegativeReason",
  contactability_score: "contactabilityScore", contactability_positive_reason: "contactabilityPositiveReason", contactability_negative_reason: "contactabilityNegativeReason",
  account_potential_score: "accountPotentialScore", account_potential_positive_reason: "accountPotentialPositiveReason", account_potential_negative_reason: "accountPotentialNegativeReason",
  data_quality_score: "dataQualityScore", data_quality_positive_reason: "dataQualityPositiveReason", data_quality_negative_reason: "dataQualityNegativeReason",
  do_not_contact: "doNotContact",
};

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, { credentials: "same-origin", cache: "no-store", ...options, headers: { "Content-Type": "application/json", ...(options?.headers || {}) } });
  const payload = await response.json().catch(() => ({})) as T & { message?: string; error?: string };
  if (!response.ok) throw new Error(payload.message || payload.error || "请求未完成");
  return payload;
}

function parseCsv(source: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') { value += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else value += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { row.push(value); value = ""; }
    else if (char === "\n") { row.push(value.replace(/\r$/, "")); rows.push(row); row = []; value = ""; }
    else value += char;
  }
  if (quoted) throw new Error("CSV 引号没有闭合");
  if (value || row.length) { row.push(value.replace(/\r$/, "")); rows.push(row); }
  return rows.filter((record) => record.some((cell) => cell.trim()));
}

function recordsFromCsv(source: string) {
  const rows = parseCsv(source.replace(/^\uFEFF/, ""));
  if (rows.length < 2) throw new Error("CSV 至少需要标题行和一条客户记录");
  const headers = rows[0].map((header) => header.trim().toLocaleLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""));
  if (new Set(headers).size !== headers.length) throw new Error("CSV 存在重复标题列");
  if (!headers.includes("company_name") || !headers.includes("source_url")) throw new Error("CSV 必须包含 company_name 和 source_url");
  const numeric = new Set(["evidenceCoverage", ...Object.keys(SCORE_LIMITS)]);
  return rows.slice(1).map((cells) => Object.fromEntries(headers.map((header, index) => {
    const field = HEADER_MAP[header] || header;
    const raw = cells[index]?.trim() || "";
    return [field, numeric.has(field) ? Number(raw || 0) : raw];
  })));
}

function recordsFromJson(source: string) {
  const parsed = JSON.parse(source) as unknown;
  const records = Array.isArray(parsed) ? parsed : (parsed && typeof parsed === "object" ? (parsed as { records?: unknown }).records : null);
  if (!Array.isArray(records) || !records.length) throw new Error("JSON 必须包含非空 records 数组");
  return records;
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((item) => item.toString(16).padStart(2, "0")).join("");
}

function jsonList(value?: string) {
  try { const result = JSON.parse(value || "[]"); return Array.isArray(result) ? result.map(String) : []; } catch { return []; }
}

function formatDate(value?: string) {
  if (!value) return "未记录";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function downloadText(filename: string, content: string, type = "text/plain;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url; link.download = filename; link.click();
  URL.revokeObjectURL(url);
}

function localizedCountry(value?: string) {
  return value ? COUNTRY_LABELS[value] || value : "未记录";
}

function localizedCompanyType(value?: string) {
  if (!value) return "类型待确认";
  const normalized = value.toLocaleLowerCase();
  if (normalized.includes("manufacturer")) return "眼镜制造商";
  if (normalized.includes("retail chain")) return "眼镜零售连锁";
  if (normalized.includes("special") && normalized.includes("distributor")) return "特种镜架经销商";
  if (normalized.includes("wholesaler") && normalized.includes("brand")) return "眼镜品牌 / 批发商";
  if (normalized.includes("distributor") && normalized.includes("brand")) return "眼镜品牌 / 经销商";
  if (normalized.includes("retailer") && normalized.includes("brand")) return "眼镜品牌 / 零售商";
  if (normalized.includes("wholesaler")) return "独立眼镜批发商";
  if (normalized.includes("distributor")) return "眼镜分销商";
  if (normalized.includes("retailer")) return "眼镜零售商";
  if (normalized.includes("brand")) return "眼镜品牌";
  return value;
}

function companyWebsiteUrl(company?: Company) {
  const rawValue = company?.website?.trim() || company?.primaryDomain?.trim();
  if (!rawValue) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(rawValue) ? rawValue : `https://${rawValue}`);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function companySignal(company?: Company) {
  if (!company) return "公开信号待补充";
  const signals: string[] = [];
  if (jsonList(company.productsJson).length) signals.push("产品目录");
  if (jsonList(company.brandsJson).length) signals.push("品牌展示");
  if (company.businessEmail || company.contactChannel) signals.push("商务联系渠道");
  if (!signals.length && company.wholesaleSignal) signals.push("批发业务信号");
  return signals.slice(0, 3).join(" · ") || "公开信号待补充";
}

function compactRisk(lead?: Lead) {
  if (!lead) return "风险待核验";
  if (lead.hardGateStatus === "fail") return lead.hardGateReason || "强制准入未通过";
  if (lead.hardGateStatus !== "pass") return "采购权限、MOQ 与当前供应商未知";
  return lead.riskSummary || "未记录重大风险";
}

export default function LeadEngineApp() {
  const [workspace, setWorkspace] = useState<Workspace>(EMPTY_WORKSPACE);
  const [activeCampaignId, setActiveCampaignId] = useState("");
  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [statusFilter, setStatusFilter] = useState("needs_review");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [countryFilter, setCountryFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [productFilter, setProductFilter] = useState("all");
  const [contactFilter, setContactFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [specialFilter, setSpecialFilter] = useState("all");
  const [sortBy, setSortBy] = useState("score_desc");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [activeView, setActiveView] = useState<ViewKey>("discovery");
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [importReport, setImportReport] = useState<{ imported: number; skipped: number; results?: Array<Record<string, unknown>> } | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const data = await api<Workspace>("/api/workspace");
      setWorkspace(data);
      setActiveCampaignId((current) => data.campaigns.some((item) => item.id === current) ? current : data.campaigns[0]?.id || "");
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "无法加载独立实验数据库"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);
  useEffect(() => {
    if (workspace.engineState?.status !== "running") return;
    const timer = window.setInterval(() => { void load(); }, 30_000);
    return () => window.clearInterval(timer);
  }, [load, workspace.engineState?.status]);

  const companyById = useMemo(() => new Map(workspace.companies.map((company) => [company.id, company])), [workspace.companies]);
  const activeCampaign = workspace.campaigns.find((campaign) => campaign.id === activeCampaignId) || null;
  const campaignLeads = useMemo(() => workspace.leads.filter((lead) => lead.campaignId === activeCampaignId), [workspace.leads, activeCampaignId]);
  const countries = useMemo(() => [...new Set(campaignLeads.map((lead) => companyById.get(lead.companyId)?.country).filter(Boolean) as string[])].sort(), [campaignLeads, companyById]);
  const companyTypes = useMemo(() => [...new Set(campaignLeads.map((lead) => companyById.get(lead.companyId)?.customerType || companyById.get(lead.companyId)?.companyType).filter(Boolean) as string[])].sort(), [campaignLeads, companyById]);
  const sourceTypes = useMemo(() => [...new Set(campaignLeads.map((lead) => companyById.get(lead.companyId)?.sourceType).filter(Boolean) as string[])].sort(), [campaignLeads, companyById]);
  const filteredLeads = useMemo(() => campaignLeads.filter((lead) => {
    const company = companyById.get(lead.companyId);
    const term = search.trim().toLocaleLowerCase();
    return (statusFilter === "all" || lead.workflowStatus === statusFilter)
      && (gradeFilter === "all" || lead.grade === gradeFilter)
      && (countryFilter === "all" || company?.country === countryFilter)
      && (typeFilter === "all" || company?.customerType === typeFilter || company?.companyType === typeFilter)
      && (productFilter === "all" || jsonList(company?.productDirectionsJson).includes(productFilter))
      && (contactFilter === "all" || company?.contactStatus === contactFilter)
      && (sourceFilter === "all" || company?.sourceType === sourceFilter)
      && (specialFilter !== "duplicate" || company?.isDuplicate)
      && (specialFilter !== "dnc" || company?.doNotContact)
      && (!term || [company?.companyName, company?.country, company?.website, company?.companyType, company?.customerType, company?.companyRole, company?.sourceName].some((value) => String(value || "").toLocaleLowerCase().includes(term)));
  }).sort((left, right) => {
    const leftCompany = companyById.get(left.companyId);
    const rightCompany = companyById.get(right.companyId);
    if (sortBy === "score_asc") return left.currentScore - right.currentScore;
    if (sortBy === "company_asc") return String(leftCompany?.companyName || "").localeCompare(String(rightCompany?.companyName || ""));
    if (sortBy === "newest") return String(rightCompany?.firstDiscoveredAt || right.createdAt).localeCompare(String(leftCompany?.firstDiscoveredAt || left.createdAt));
    return right.currentScore - left.currentScore;
  }), [campaignLeads, companyById, contactFilter, countryFilter, gradeFilter, productFilter, search, sortBy, sourceFilter, specialFilter, statusFilter, typeFilter]);
  const pageCount = Math.max(1, Math.ceil(filteredLeads.length / 25));
  const visibleLeads = filteredLeads.slice((Math.min(page, pageCount) - 1) * 25, Math.min(page, pageCount) * 25);
  const selectedLead = filteredLeads.find((lead) => lead.id === selectedLeadId) || filteredLeads[0] || null;
  const selectedCompany = selectedLead ? companyById.get(selectedLead.companyId) || null : null;
  const selectedContacts = selectedCompany ? workspace.contacts.filter((contact) => contact.companyId === selectedCompany.id) : [];
  const selectedSources = selectedLead ? workspace.sources.filter((source) => source.leadId === selectedLead.id) : [];
  const selectedClaims = selectedLead ? workspace.claims.filter((claim) => claim.leadId === selectedLead.id) : [];
  const selectedScoreRun = selectedLead ? workspace.scoreRuns.find((run) => run.leadId === selectedLead.id) || null : null;
  const selectedDimensions = selectedScoreRun ? workspace.scoreDimensions.filter((item) => item.scoreRunId === selectedScoreRun.id) : [];
  const selectedReviews = selectedLead ? workspace.reviews.filter((review) => review.leadId === selectedLead.id) : [];
  const selectedContactVerifications = selectedLead ? workspace.contactVerifications.filter((contact) => contact.leadId === selectedLead.id) : [];
  const selectedDomains = selectedCompany ? workspace.domainLinks.filter((link) => link.companyId === selectedCompany.id).map((link) => workspace.domains.find((domain) => domain.id === link.domainId)?.normalizedDomain).filter(Boolean) : [];
  const counts = Object.fromEntries(STATUS_FILTERS.map((status) => [status, status === "all" ? campaignLeads.length : campaignLeads.filter((lead) => lead.workflowStatus === status).length]));
  const gradeCounts = Object.fromEntries(["S", "A", "B", "C", "Reject"].map((grade) => [grade, campaignLeads.filter((lead) => lead.grade === grade).length]));
  const approvedCount = Number(counts.approved || 0);
  const rejectedCount = Number(counts.rejected || 0);
  const campaignDiscoverySources = workspace.discoverySources.filter((source) => source.campaignId === activeCampaignId);
  const campaignDiscoveryRuns = workspace.discoveryRuns.filter((run) => run.campaignId === activeCampaignId);
  const discoverySourceById = new Map(workspace.discoverySources.map((source) => [source.id, source]));
  const dueSourceCount = campaignDiscoverySources.filter((source) => source.status === "active" && source.cadence !== "manual" && source.nextRunAt && new Date(source.nextRunAt) <= new Date()).length;
  const engine = workspace.engineState;
  const todayTarget = workspace.dailyTargets[0] || null;
  const todayRemaining = Math.max(0, (todayTarget?.targetCount || engine?.dailyTarget || 20) - (todayTarget?.qualifiedCount || 0));
  const openAlerts = workspace.discoveryAlerts.filter((alert) => !alert.resolvedAt);
  const latestRun = campaignDiscoveryRuns[0] || null;
  const campaignMarket = activeCampaign?.targetMarkets || jsonList(activeCampaign?.targetCountriesJson)[0] || "";
  const campaignLabel = activeCampaign
    ? `${localizedCountry(campaignMarket)}${PRODUCT_LABELS[activeCampaign.productTrack] || "眼镜"} · ${campaignLeads.length} 家`
    : "尚未选择 Campaign";
  const approvalGaps = selectedLead && selectedCompany ? [
    selectedLead.hardGateStatus !== "pass" ? "强制准入尚未通过" : "",
    selectedLead.currentScore < 60 ? "评分低于 60" : "",
    selectedLead.evidenceCoverage < 40 ? "证据覆盖率低于 40%" : "",
    selectedLead.scoreConfidence === "low" ? "评分可信度仍为低" : "",
    selectedCompany.doNotContact ? "已进入禁止联系名单" : "",
    !selectedSources.length ? "没有来源" : "",
    !selectedCompany.businessEmail && !selectedCompany.contactChannel && !selectedContacts.length ? "没有商务联系渠道" : "",
    selectedDimensions.length !== Object.keys(SCORE_LIMITS).length ? "评分维度不完整" : "",
  ].filter(Boolean) : [];

  async function createCampaign(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setPending(true); setError(""); setNotice("");
    try {
      const result = await api<{ campaign: Campaign }>("/api/campaigns", { method: "POST", body: JSON.stringify({
        name: data.get("name"), productTrack: data.get("productTrack"), targetCountries: data.get("targetCountries"),
        targetMarkets: data.get("targetMarkets"), productTypes: data.get("productTypes"), customerTypes: data.get("customerTypes"),
        targetCount: Number(data.get("targetCount") || 30), moqFit: data.get("moqFit"), companySize: data.get("companySize"),
        positioning: data.get("positioning"), exclusions: data.get("exclusions"), status: "draft",
      }) });
      form.reset(); await load(); setActiveCampaignId(result.campaign.id);
      setNotice("Campaign 草稿已创建，并已生成本地语言检索词与 Codex 研究任务书。");
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "创建失败"); }
    finally { setPending(false); }
  }

  async function changeCampaignStatus(status: string) {
    if (!activeCampaign) return;
    setPending(true); setError(""); setNotice("");
    try {
      await api("/api/campaigns", { method: "PATCH", body: JSON.stringify({ id: activeCampaign.id, status }) });
      await load(); setNotice(`Campaign 状态已更新为：${status}。`);
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "状态更新失败"); }
    finally { setPending(false); }
  }

  async function updateCampaign(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeCampaign) return;
    const data = new FormData(event.currentTarget);
    setPending(true); setError(""); setNotice("");
    try {
      await api("/api/campaigns", { method: "PATCH", body: JSON.stringify({
        id: activeCampaign.id,
        name: data.get("name"),
        productTrack: data.get("productTrack"),
        targetCountries: data.get("targetCountries"),
        targetMarkets: data.get("targetMarkets"),
        productTypes: data.get("productTypes"),
        customerTypes: data.get("customerTypes"),
        targetCount: Number(data.get("targetCount") || 30),
        moqFit: data.get("moqFit"),
        companySize: data.get("companySize"),
        positioning: data.get("positioning"),
        exclusions: data.get("exclusions"),
      }) });
      await load(); setNotice("Campaign 条件已更新，检索词和研究任务书已同步刷新。");
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Campaign 更新失败"); }
    finally { setPending(false); }
  }

  async function importFile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeCampaignId) return;
    const form = event.currentTarget;
    const file = new FormData(form).get("file");
    if (!(file instanceof File) || !file.size) return;
    setPending(true); setError(""); setNotice(""); setImportReport(null);
    try {
      if (file.size > 2_000_000) throw new Error("导入文件不能超过 2 MB");
      const content = await file.text();
      const records = /\.json$/i.test(file.name) ? recordsFromJson(content) : recordsFromCsv(content);
      const result = await api<{ imported: number; skipped: number; results: Array<Record<string, unknown>>; replayed: boolean }>("/api/import", {
        method: "POST", body: JSON.stringify({ campaignId: activeCampaignId, records, originalFilename: file.name, idempotencyKey: await sha256(content) }),
      });
      setImportReport(result);
      setNotice(result.replayed ? "该文件已经处理过，已返回原导入批次结果，没有重复写入。" : `结构化导入完成：写入 ${result.imported} 条，跳过 ${result.skipped} 条。`);
      form.reset(); await load();
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "导入失败"); }
    finally { setPending(false); }
  }

  async function review(decision: string) {
    if (!selectedLead) return;
    if (decision === "rejected" && !reviewNotes.trim()) { setError("淘汰 Lead 前必须填写原因。"); return; }
    setPending(true); setError(""); setNotice("");
    try {
      await api("/api/reviews", { method: "POST", body: JSON.stringify({ leadId: selectedLead.id, decision, notes: reviewNotes }) });
      setReviewNotes(""); await load(); setNotice(`审核决定已保存：${STATUS_LABELS[decision]}。没有写入生产 CRM。`);
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "审核未完成"); }
    finally { setPending(false); }
  }

  async function exportApproved() {
    if (!activeCampaign || !approvedCount) return;
    setPending(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/exports/crm", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ campaignId: activeCampaign.id }) });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { message?: string; error?: string };
        throw new Error(payload.message || payload.error || "导出未完成");
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a"); link.href = url; link.download = "qixin-approved-leads.csv"; link.click(); URL.revokeObjectURL(url);
      await load(); setNotice("已生成 CRM 兼容文件并记录导出批次；仍需在生产 CRM 中再次人工确认导入。");
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "导出未完成"); }
    finally { setPending(false); }
  }

  async function addDiscoverySource(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeCampaignId) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    setPending(true); setError(""); setNotice("");
    try {
      await api("/api/discovery/sources", { method: "POST", body: JSON.stringify({
        campaignId: activeCampaignId,
        name: data.get("name"),
        sourceUrl: data.get("sourceUrl"),
        cadence: data.get("cadence"),
        maxCandidates: Number(data.get("maxCandidates") || 10),
      }) });
      form.reset(); await load();
      setNotice("已保存你批准的公开来源。系统只会读取该来源及其中链接出的公开官网，不会扩展为全网搜索。");
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "来源添加失败"); }
    finally { setPending(false); }
  }

  async function toggleDiscoverySource(source: DiscoverySource) {
    setPending(true); setError(""); setNotice("");
    try {
      await api("/api/discovery/sources", { method: "PATCH", body: JSON.stringify({ id: source.id, status: source.status === "active" ? "paused" : "active" }) });
      await load(); setNotice(source.status === "active" ? "来源已暂停。" : "来源已恢复；下次到期后可由定时任务运行。");
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "来源状态更新失败"); }
    finally { setPending(false); }
  }

  async function runDiscovery(sourceId: string) {
    setPending(true); setError(""); setNotice("");
    try {
      const result = await api<{ imported: number; qualified: number; duplicate: number; excluded: number; failed: number }>("/api/discovery/run", { method: "POST", body: JSON.stringify({ sourceId }) });
      await load(); setNotice(`采集完成：自动筛选合格 ${result.qualified} 家，写入 ${result.imported} 家，重复 ${result.duplicate} 家，排除 ${result.excluded} 家，失败 ${result.failed} 家。没有自动批准或联系。`);
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "采集运行失败"); }
    finally { setPending(false); }
  }

  async function runDueDiscovery() {
    setPending(true); setError(""); setNotice("");
    try {
      const result = await api<{ dueCount: number; results: Array<{ imported: number }> }>("/api/discovery/run-due", { method: "POST", body: JSON.stringify({ limit: 3 }) });
      await load();
      const imported = result.results.reduce((sum, run) => sum + Number(run.imported || 0), 0);
      setNotice(result.dueCount ? `已运行 ${result.dueCount} 个到期来源，新增 ${imported} 家待审核客户。` : "当前没有到期来源，未执行任何采集。 ");
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "到期来源运行失败"); }
    finally { setPending(false); }
  }

  async function reverifySelectedLead() {
    if (!selectedLead) return;
    setPending(true); setError(""); setNotice("");
    try {
      const result = await api<{ qualified: boolean; score: number; evidenceCoverage: number; failures: string[] }>(`/api/leads/${selectedLead.id}/reverify`, { method: "POST", body: "{}" });
      await load();
      setNotice(result.qualified
        ? `重新核验通过：评分 ${result.score}，证据覆盖率 ${result.evidenceCoverage}%，仍需人工批准后才能联系。`
        : `重新核验完成但未通过准入：${result.failures.join("；")}`);
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "重新核验失败"); }
    finally { setPending(false); }
  }

  async function controlEngine(action: "start" | "pause" | "resume" | "stop" | "run_batch") {
    if (action === "start" && (!activeCampaignId || activeCampaign?.status !== "active")) {
      setError("请先选择并启用一个 Campaign。"); return;
    }
    setPending(true); setError(""); setNotice("");
    try {
      await api("/api/engine/control", {
        method: "POST",
        body: JSON.stringify({ action, campaignId: activeCampaignId, dailyTarget: 20, timezone: "Asia/Shanghai", runNow: true }),
      });
      await load();
      setNotice(action === "start" ? "自动找客户已启动并持久化；浏览器关闭后由服务器定时批次继续运行。"
        : action === "pause" ? "自动发现已暂停。" : action === "resume" ? "自动发现已恢复。"
          : action === "stop" ? "自动发现已停止；历史数据和日志保留。" : "已完成一轮受控补采批次。");
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "自动引擎操作失败"); }
    finally { setPending(false); }
  }

  async function exportLeadList(mode: "qualified" | "approved") {
    setPending(true); setError("");
    try {
      const response = await fetch(`/api/exports/leads?mode=${mode}`, { credentials: "same-origin", cache: "no-store" });
      if (!response.ok) throw new Error("导出未完成");
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a"); link.href = url; link.download = `qixin-${mode}-leads.csv`; link.click(); URL.revokeObjectURL(url);
      setNotice(mode === "qualified" ? "已导出自动筛选合格清单供审核；未写入 CRM，也未联系客户。" : "已导出人工批准清单；未写入 CRM。");
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "导出未完成"); }
    finally { setPending(false); }
  }

  return (
    <main className={styles.shell}>
      <p className={styles.srOnly}>
        可审计的销售机会。生产系统未连接。新建完整 Campaign。批准后才能生成 CRM 文件。
      </p>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true"><IconLetterQ size={25} stroke={2.4} /></span>
          <strong>眼镜客户开发引擎</strong>
        </div>

        <nav className={styles.navigation} aria-label="开发引擎功能">
          <button type="button" className={activeView === "review" ? styles.navActive : ""} onClick={() => { setActiveView("review"); setDrawerOpen(true); }}>
            <IconUsers size={21} stroke={1.8} /><span>客户审核</span>
          </button>
          <button type="button" className={activeView === "campaign" ? styles.navActive : ""} onClick={() => setActiveView("campaign")}>
            <IconTargetArrow size={21} stroke={1.8} /><span>Campaign</span>
          </button>
          <button type="button" className={activeView === "discovery" ? styles.navActive : ""} onClick={() => setActiveView("discovery")}>
            <IconRadar size={21} stroke={1.8} /><span>自动发现</span>
          </button>
          <button type="button" className={activeView === "research" ? styles.navActive : ""} onClick={() => setActiveView("research")}>
            <IconClipboard size={21} stroke={1.8} /><span>调研任务</span>
          </button>
          <button type="button" className={activeView === "import" ? styles.navActive : ""} onClick={() => setActiveView("import")}>
            <IconUpload size={21} stroke={1.8} /><span>数据导入</span>
          </button>
          <button type="button" className={activeView === "export" ? styles.navActive : ""} onClick={() => setActiveView("export")}>
            <IconFileExport size={21} stroke={1.8} /><span>CRM 导出</span>
          </button>
        </nav>

        <div className={styles.sidebarFoot}>
          <div className={styles.privateStatus}><IconShieldLock size={18} /><span><b>私有实验环境</b><small>无自动发送 · 无 CRM 直写</small></span></div>
          <button type="button" onClick={() => setActiveView("campaign")}><IconSettings size={20} /><span>设置</span></button>
        </div>
      </aside>

      <header className={styles.topBar}>
        <label className={styles.campaignSwitcher}>
          <span>当前 Campaign</span>
          <select
            value={activeCampaignId}
            aria-label="切换 Campaign"
            onChange={(event) => { setActiveCampaignId(event.target.value); setSelectedLeadId(""); setStatusFilter("needs_review"); }}
          >
            <option value="">尚未创建 Campaign</option>
            {workspace.campaigns.map((campaign) => {
              const market = campaign.targetMarkets || jsonList(campaign.targetCountriesJson)[0] || "";
              const leadCount = workspace.leads.filter((lead) => lead.campaignId === campaign.id).length;
              return <option key={campaign.id} value={campaign.id}>{localizedCountry(market)}{PRODUCT_LABELS[campaign.productTrack] || "眼镜"} · {leadCount} 家</option>;
            })}
          </select>
          <small>{campaignLabel}</small>
        </label>

        <div className={styles.summaryMetrics} aria-label="Campaign 状态概览">
          <button type="button" className={statusFilter === "needs_review" && activeView === "review" ? styles.metricActive : ""} onClick={() => { setActiveView("review"); setStatusFilter("needs_review"); setDrawerOpen(true); }}>
            <span>待审核</span><b className={styles.metricBlue}>{counts.needs_review || 0}</b>
          </button>
          <button type="button" className={statusFilter === "rejected" && activeView === "review" ? styles.metricActive : ""} onClick={() => { setActiveView("review"); setStatusFilter("rejected"); setDrawerOpen(true); }}>
            <span>已淘汰</span><b className={styles.metricRed}>{rejectedCount}</b>
          </button>
          <button type="button" className={statusFilter === "approved" && activeView === "review" ? styles.metricActive : ""} onClick={() => { setActiveView("review"); setStatusFilter("approved"); setDrawerOpen(true); }}>
            <span>已批准</span><b className={styles.metricGreen}>{approvedCount}</b>
          </button>
        </div>
      </header>

      {error ? <div className={styles.error} role="alert">{error}</div> : null}
      {notice ? <div className={styles.notice} role="status">{notice}</div> : null}

      {activeView === "review" ? (
        <section className={[styles.reviewWorkspace, !drawerOpen && styles.workspaceExpanded].filter(Boolean).join(" ")} aria-label={VIEW_LABELS.review}>
          <div className={styles.reviewHeader}>
            <div>
              <h1>{statusFilter === "needs_review" ? "待审核客户" : STATUS_LABELS[statusFilter] || "客户审核"}</h1>
            </div>
            <details className={styles.filterDisclosure}>
              <summary><IconSearch size={19} />筛选与搜索</summary>
              <div className={styles.filterPanel}>
                <label className={styles.searchBox}>
                  <IconSearch size={20} aria-hidden="true" />
                  <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索公司、国家或类型" />
                </label>
                <div className={styles.filterBar}>
                  <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="工作流状态筛选">
                    {STATUS_FILTERS.map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}（{counts[status] || 0}）</option>)}
                  </select>
                  <select value={gradeFilter} onChange={(event) => setGradeFilter(event.target.value)} aria-label="评分等级筛选">
                    <option value="all">全部评分</option>
                    {["S", "A", "B", "C", "Reject"].map((grade) => <option key={grade} value={grade}>{grade} 级</option>)}
                  </select>
                  <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} aria-label="客户类型筛选">
                    <option value="all">全部类型</option>
                    {companyTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                  <select value={countryFilter} onChange={(event) => setCountryFilter(event.target.value)} aria-label="国家筛选">
                    <option value="all">全部国家</option>
                    {countries.map((country) => <option key={country} value={country}>{localizedCountry(country)}</option>)}
                  </select>
                  <select value={productFilter} onChange={(event) => setProductFilter(event.target.value)} aria-label="产品方向筛选">
                    <option value="all">全部产品方向</option>
                    {PRODUCT_DIRECTIONS.map((product) => <option key={product} value={product}>{product}</option>)}
                  </select>
                  <select value={contactFilter} onChange={(event) => setContactFilter(event.target.value)} aria-label="联系方式状态筛选">
                    <option value="all">全部联系状态</option><option value="valid">联系方式有效</option><option value="missing">无有效联系方式</option><option value="unverified">未核验</option>
                  </select>
                  <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)} aria-label="来源类型筛选">
                    <option value="all">全部来源类型</option>{sourceTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                  <select value={specialFilter} onChange={(event) => setSpecialFilter(event.target.value)} aria-label="特殊状态筛选">
                    <option value="all">全部记录</option><option value="duplicate">仅重复</option><option value="dnc">仅禁止联系</option>
                  </select>
                  <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} aria-label="排序">
                    <option value="score_desc">评分从高到低</option><option value="score_asc">评分从低到高</option><option value="newest">最新发现</option><option value="company_asc">公司名称</option>
                  </select>
                </div>
                <span className={styles.resultCount}>当前显示 {filteredLeads.length} 家</span>
              </div>
            </details>
          </div>

          <div className={styles.tableFrame} aria-busy={loading}>
            <div className={styles.tableScroll}>
              <table className={styles.leadTable}>
                <thead>
                  <tr>
                    <th>公司</th>
                    <th>类型</th>
                    <th>国家</th>
                    <th>评分</th>
                    <th>证据覆盖</th>
                    <th>关键采购信号</th>
                    <th>风险</th>
                    <th>状态</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleLeads.map((lead) => {
                    const company = companyById.get(lead.companyId);
                    const websiteUrl = companyWebsiteUrl(company);
                    const isSelected = selectedLead?.id === lead.id && drawerOpen;
                    const riskLevel = lead.hardGateStatus === "fail" ? "高" : "中等";
                    return (
                      <tr key={lead.id} className={isSelected ? styles.rowSelected : ""} aria-selected={isSelected}>
                        <td>
                          <div className={styles.companyCell}>
                            {websiteUrl ? (
                              <a className={styles.companyWebsite} href={websiteUrl} target="_blank" rel="noopener noreferrer" title={`打开 ${company?.companyName || "公司"} 官网`}>
                                <strong>{company?.companyName || "公司资料缺失"}<IconExternalLink size={14} aria-hidden="true" /></strong>
                                <small>{company?.primaryDomain || company?.website}</small>
                              </a>
                            ) : (
                              <span className={styles.companyUnavailable}>
                                <strong>{company?.companyName || "公司资料缺失"}</strong>
                                <small>官网待核验</small>
                              </span>
                            )}
                            <button type="button" className={styles.evidenceButton} onClick={() => { setSelectedLeadId(lead.id); setDrawerOpen(true); }}>
                              查看证据与审核
                            </button>
                          </div>
                        </td>
                        <td>{localizedCompanyType(company?.companyType)}</td>
                        <td>{localizedCountry(company?.country)}</td>
                        <td><b className={styles.scoreValue}>{lead.currentScore}</b></td>
                        <td><b className={styles.coverageValue}>{lead.evidenceCoverage}%</b></td>
                        <td><span className={styles.signalText} title={companySignal(company)}>{companySignal(company)}</span></td>
                        <td><span className={lead.hardGateStatus === "fail" ? styles.riskHigh : styles.riskMedium}>{riskLevel}</span></td>
                        <td><span className={styles.statusBadge}>{STATUS_LABELS[lead.workflowStatus] || lead.workflowStatus}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {loading ? <div className={styles.emptyState}><IconClock size={26} /><b>正在读取私有数据库…</b></div> : null}
            {!loading && !activeCampaign ? <div className={styles.emptyState}><IconTargetArrow size={28} /><b>先创建第一个 Campaign</b><p>建议从一个产品赛道、20–30 家候选公司开始。</p><button type="button" onClick={() => setActiveView("campaign")}>创建 Campaign</button></div> : null}
            {!loading && activeCampaign && !filteredLeads.length ? <div className={styles.emptyState}><IconSearch size={28} /><b>当前筛选没有客户</b><p>调整筛选条件，或前往数据导入。</p><button type="button" onClick={() => setActiveView("import")}>前往数据导入</button></div> : null}
            {!loading && filteredLeads.length ? <div className={styles.pagination}><span>第 {Math.min(page, pageCount)} / {pageCount} 页 · 共 {filteredLeads.length} 家</span><div><button type="button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>上一页</button><button type="button" disabled={page >= pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}>下一页</button></div></div> : null}
          </div>
        </section>
      ) : null}

      {activeView === "campaign" ? (
        <section className={styles.toolWorkspace} aria-label={VIEW_LABELS.campaign}>
          <div className={styles.toolHeader}><div><span className={styles.sectionKicker}>CAMPAIGN CONTROL</span><h1>Campaign 管理</h1><p>定义市场、客户类型与排除规则；每日审核页只显示与当前任务相关的信息。</p></div><IconTargetArrow size={34} /></div>
          <div className={styles.toolGrid}>
            <section className={styles.toolSection}>
              <h2>当前 Campaign</h2>
              {activeCampaign ? (
                <>
                  <div className={styles.campaignOverview}>
                    <div><span>任务</span><b>{activeCampaign.name}</b></div>
                    <div><span>市场</span><b>{campaignLabel}</b></div>
                    <div><span>状态</span><b>{STATUS_LABELS[activeCampaign.status] || activeCampaign.status}</b></div>
                    <div><span>评分结构</span><b>S {gradeCounts.S || 0} · A {gradeCounts.A || 0} · B {gradeCounts.B || 0}</b></div>
                  </div>
                  <label className={styles.field}>Campaign 状态
                    <select value={activeCampaign.status} disabled={pending} onChange={(event) => void changeCampaignStatus(event.target.value)}>
                      <option value="draft">草稿</option><option value="active">运行中</option><option value="paused">暂停</option><option value="completed">已完成</option>
                    </select>
                  </label>
                  <details className={styles.formDisclosure} open>
                    <summary>编辑 Campaign 条件</summary>
                    <form className={styles.formGrid} onSubmit={updateCampaign} key={activeCampaign.id}>
                      <label className={styles.field}>Campaign 名称<input name="name" required defaultValue={activeCampaign.name} /></label>
                      <label className={styles.field}>产品赛道<select name="productTrack" defaultValue={activeCampaign.productTrack}>{PRODUCT_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                      <label className={styles.field}>目标国家<input name="targetCountries" defaultValue={jsonList(activeCampaign.targetCountriesJson).join("; ")} /></label>
                      <label className={styles.field}>市场说明<input name="targetMarkets" defaultValue={activeCampaign.targetMarkets} /></label>
                      <label className={styles.field}>产品类型<input name="productTypes" defaultValue={jsonList(activeCampaign.productTypesJson).join("; ")} /></label>
                      <label className={styles.field}>客户类型<input name="customerTypes" defaultValue={jsonList(activeCampaign.customerTypesJson).join("; ")} /></label>
                      <label className={styles.field}>目标公司数量<input name="targetCount" type="number" min="1" max="500" defaultValue={activeCampaign.targetCount} /></label>
                      <label className={styles.field}>MOQ 适配<input name="moqFit" defaultValue={activeCampaign.moqFit || ""} /></label>
                      <label className={styles.field}>客户规模<input name="companySize" defaultValue={activeCampaign.companySize || ""} /></label>
                      <label className={styles.field}>产品定位<input name="positioning" defaultValue={activeCampaign.positioning || ""} /></label>
                      <label className={[styles.field, styles.fieldWide].join(" ")}>排除类型<input name="exclusions" defaultValue={jsonList(activeCampaign.exclusionsJson).join("; ")} /></label>
                      <button className={styles.primaryButton} type="submit" disabled={pending}>保存并刷新研究计划</button>
                    </form>
                  </details>
                </>
              ) : <p className={styles.muted}>尚未创建 Campaign。</p>}
            </section>

            <section className={styles.toolSection}>
              <h2><IconPlus size={20} /> 新建 Campaign</h2>
              <form className={styles.formGrid} onSubmit={createCampaign}>
                <label className={[styles.field, styles.fieldWide].join(" ")}>Campaign 名称<input name="name" required maxLength={160} placeholder="例如：德国光学镜片首批 25 家" /></label>
                <label className={styles.field}>产品赛道<select name="productTrack" defaultValue="optical_frames">{PRODUCT_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <label className={styles.field}>目标国家<input name="targetCountries" placeholder="Germany; UK" /></label>
                <label className={styles.field}>市场说明<input name="targetMarkets" placeholder="目标市场" /></label>
                <label className={styles.field}>产品类型<input name="productTypes" placeholder="以分号分隔" /></label>
                <label className={[styles.field, styles.fieldWide].join(" ")}>客户类型<input name="customerTypes" defaultValue="Importer; Distributor; Wholesaler; Eyewear Brand; Private Label Brand" /></label>
                <label className={styles.field}>目标公司数量<input name="targetCount" type="number" min="1" max="500" defaultValue="30" /></label>
                <label className={styles.field}>MOQ 适配<input name="moqFit" /></label>
                <label className={styles.field}>客户规模<input name="companySize" /></label>
                <label className={styles.field}>产品定位<input name="positioning" /></label>
                <label className={[styles.field, styles.fieldWide].join(" ")}>排除类型<input name="exclusions" placeholder="以分号分隔" /></label>
                <button className={styles.primaryButton} type="submit" disabled={pending}>创建 Campaign 草稿</button>
              </form>
            </section>
          </div>
        </section>
      ) : null}

      {activeView === "discovery" ? (
        <section className={styles.toolWorkspace} aria-label={VIEW_LABELS.discovery}>
          <div className={styles.toolHeader}>
            <div>
              <span className={styles.sectionKicker}>PERSISTENT DAILY DISCOVERY</span>
              <h1>自动找客户</h1>
              <p>服务器按 Asia/Shanghai 统计业务日，每 15 分钟可执行一个受控批次；浏览器关闭不影响持久化状态。搜索线索、合格客户和人工批准严格分开。</p>
            </div>
            <IconRadar size={34} />
          </div>

          <section className={styles.engineDashboard}>
            <div className={styles.engineControl}>
              <div><span>当前运行状态</span><b data-status={engine?.status || "stopped"}>{engine?.status === "running" ? "持续运行中" : engine?.status === "paused" ? "已暂停" : "已停止"}</b><small>时区：{engine?.timezone || "Asia/Shanghai"}</small></div>
              <div className={styles.engineActions}>
                <button className={styles.primaryButton} type="button" disabled={pending || engine?.status === "running" || activeCampaign?.status !== "active"} onClick={() => void controlEngine("start")}><IconPlayerPlay size={18} />开始自动找客户</button>
                <button className={styles.secondaryButton} type="button" disabled={pending || engine?.status !== "running"} onClick={() => void controlEngine("pause")}><IconPlayerPause size={18} />暂停</button>
                <button className={styles.secondaryButton} type="button" disabled={pending || engine?.status !== "paused"} onClick={() => void controlEngine("resume")}><IconPlayerPlay size={18} />恢复</button>
                <button className={styles.secondaryButton} type="button" disabled={pending || !engine || engine.status === "stopped"} onClick={() => void controlEngine("stop")}><IconX size={18} />停止</button>
                <button className={styles.secondaryButton} type="button" disabled={pending || engine?.status !== "running"} onClick={() => void controlEngine("run_batch")}><IconRadar size={18} />立即补采一批</button>
              </div>
            </div>
            <div className={styles.engineMetrics}>
              <article><span>今日目标</span><b>{todayTarget?.targetCount || engine?.dailyTarget || 20}</b><small>自动筛选合格客户</small></article>
              <article className={styles.metricSuccess}><span>今日已完成</span><b>{todayTarget?.qualifiedCount || 0}</b><small>强制准入通过且有商务联系方式</small></article>
              <article className={todayRemaining ? styles.metricWarning : styles.metricSuccess}><span>今日仍缺</span><b>{todayRemaining}</b><small>{todayTarget?.sourceExhausted ? "可用来源已耗尽" : "后续批次继续补采"}</small></article>
              <article><span>重复 / 淘汰 / 失败</span><b>{todayTarget?.duplicateCount || 0} / {todayTarget?.mandatoryGateFailedCount || 0} / {todayTarget?.failedCount || 0}</b><small>均不计入每日目标</small></article>
            </div>
            <div className={styles.engineTimeline}>
              <span>最近运行：<b>{formatDate(engine?.lastRunAt)}</b></span>
              <span>下次运行：<b>{formatDate(engine?.nextRunAt)}</b></span>
              <span>当前来源：<b>{latestRun ? discoverySourceById.get(latestRun.sourceId)?.name || "来源已删除" : "等待下一批"}</b></span>
              <span>原始 / 解析 / 官网 / 有效联系：<b>{todayTarget?.rawDiscoveredCount || 0} / {todayTarget?.parsedCount || 0} / {todayTarget?.websiteVerifiedCount || 0} / {todayTarget?.validContactCount || 0}</b></span>
            </div>
            {todayTarget?.deficitReason || engine?.lastError ? <div className={styles.engineAlert}><IconAlertTriangle size={19} /><span>{todayTarget?.deficitReason || engine?.lastError}</span></div> : null}
            {openAlerts.length ? <div className={styles.alertList}>{openAlerts.slice(0, 5).map((alert) => <article key={alert.id} data-severity={alert.severity}><b>{alert.severity === "critical" ? "重要告警" : "来源提醒"}</b><span>{alert.message}</span><small>{formatDate(alert.createdAt)}</small></article>)}</div> : null}
            <div className={styles.engineExports}><button className={styles.secondaryButton} type="button" disabled={pending} onClick={() => void exportLeadList("qualified")}><IconDownload size={17} />导出自动筛选合格清单</button><button className={styles.secondaryButton} type="button" disabled={pending || !approvedCount} onClick={() => void exportLeadList("approved")}><IconDownload size={17} />导出已批准清单</button></div>
          </section>

          <div className={styles.discoveryPrinciples}>
            <article><b>预置官方来源免费运行</b><span>付费搜索和 GPT provider 有接口但默认关闭、无密钥也可运行</span></article>
            <article><b>每批最多 5 个候选</b><span>尊重 robots 与来源限流；失败后下一批自动切换来源</span></article>
            <article><b>人工批准仍是联系闸门</b><span>自动合格客户进入待审核，不发送邮件、不写生产 CRM</span></article>
          </div>

          <div className={styles.toolGrid}>
            <section className={styles.toolSection}>
              <h2><IconPlus size={20} /> 添加已批准来源</h2>
              <p className={styles.muted}>点击开始后会自动写入已确认的官方来源池；也可补充新的公开协会或展商目录。搜索结果不能直接作为合格证据。</p>
              <form className={styles.formGrid} onSubmit={addDiscoverySource}>
                <label className={styles.field}>来源名称<input name="name" required maxLength={160} placeholder="例如：某眼镜展公开展商名录" /></label>
                <label className={styles.field}>运行频率<select name="cadence" defaultValue="daily"><option value="manual">仅手动</option><option value="daily">每天</option><option value="weekly">每周</option></select></label>
                <label className={[styles.field, styles.fieldWide].join(" ")}>公开目录网址<input name="sourceUrl" type="url" required maxLength={2048} placeholder="https://…" /></label>
                <label className={styles.field}>每批最多候选<input name="maxCandidates" type="number" min="1" max="20" defaultValue="10" /></label>
                <button className={styles.primaryButton} type="submit" disabled={!activeCampaignId || activeCampaign?.status !== "active" || pending}>{activeCampaign?.status !== "active" ? "先启用 Campaign" : "保存来源"}</button>
              </form>
              <div className={styles.discoveryBoundary}>
                <b><IconShieldLock size={18} /> 采集边界</b>
                <span>不采集个人姓名、个人邮箱或手机号</span><span>不猜邮箱，不生成开发信，不发送消息</span><span>不自动批准，不写入生产 CRM</span>
              </div>
            </section>

            <section className={styles.toolSection}>
              <div className={styles.sectionTitleRow}>
                <h2>来源控制</h2>
                <button className={styles.secondaryButton} type="button" disabled={pending || !dueSourceCount} onClick={() => void runDueDiscovery()}><IconPlayerPlay size={18} />运行到期来源 {dueSourceCount ? `(${dueSourceCount})` : ""}</button>
              </div>
              <div className={styles.discoverySourceList}>
                {campaignDiscoverySources.map((source) => (
                  <article key={source.id}>
                    <div className={styles.discoverySourceHead}>
                      <div><b>{source.name}</b><a href={source.sourceUrl} target="_blank" rel="noreferrer">{source.normalizedDomain}<IconExternalLink size={14} /></a></div>
                      <span className={source.enabled && source.status === "active" ? styles.sourceActive : styles.sourcePaused}>{source.enabled && source.status === "active" ? `${source.tier}级 · 已启用` : "已暂停"}</span>
                    </div>
                    <dl className={styles.discoveryMeta}>
                      <div><dt>类型 / 区域</dt><dd>{source.sourceType} · {source.region}</dd></div>
                      <div><dt>解析器</dt><dd>{source.parserKey} v{source.parserVersion}</dd></div>
                      <div><dt>上次发现 / 合格 / 重复</dt><dd>{source.lastDiscoveredCount} / {source.lastQualifiedCount} / {source.lastDuplicateCount}</dd></div>
                      <div><dt>成功 / 失败次数</dt><dd>{formatDate(source.lastSuccessAt)} / {source.failureCount}</dd></div>
                      <div><dt>robots / 访问</dt><dd>{source.robotsStatus} · {source.requiresLogin ? "需登录" : source.isPaid ? "付费" : "公开免费"}</dd></div>
                      <div><dt>下次到期</dt><dd>{source.status === "paused" ? "已暂停" : source.cadence === "manual" ? "仅手动" : formatDate(source.nextRunAt)}</dd></div>
                    </dl>
                    {source.accessNotes ? <p className={styles.muted}>{source.accessNotes}</p> : null}
                    {source.lastError ? <p className={styles.runError}>{source.lastError}</p> : null}
                    <div className={styles.discoveryActions}>
                      <button className={styles.primaryButton} type="button" disabled={pending || !source.enabled || source.status !== "active" || source.requiresLogin || source.isPaid || activeCampaign?.status !== "active"} onClick={() => void runDiscovery(source.id)}><IconPlayerPlay size={17} />立即采集</button>
                      <button className={styles.secondaryButton} type="button" disabled={pending} onClick={() => void toggleDiscoverySource(source)}>{source.status === "active" ? <IconPlayerPause size={17} /> : <IconPlayerPlay size={17} />}{source.status === "active" ? "暂停" : "恢复"}</button>
                    </div>
                  </article>
                ))}
                {!campaignDiscoverySources.length ? <div className={styles.emptyCompact}><IconRadar size={28} /><b>尚未添加来源</b><span>添加第一个你批准的公开行业目录后，才会开始发现。</span></div> : null}
              </div>
            </section>
          </div>

          <section className={[styles.toolSection, styles.discoveryHistory].join(" ")}>
            <div className={styles.sectionTitleRow}><h2>采集批次日志</h2><span className={styles.muted}>每一次访问、去重、排除和失败都会保留</span></div>
            <div className={styles.runList}>
              {campaignDiscoveryRuns.map((run) => {
                const runItems = workspace.discoveryItems.filter((item) => item.runId === run.id);
                return (
                  <article key={run.id}>
                    <div className={styles.runSummary}>
                      <div><b>{discoverySourceById.get(run.sourceId)?.name || "已删除来源"}</b><span>{formatDate(run.startedAt)} · {run.trigger === "scheduled" ? "定时" : "手动"}</span></div>
                      <strong data-status={run.status}>{run.status === "completed" ? "完成" : run.status === "partial" ? "部分完成" : run.status === "failed" ? "失败" : "运行中"}</strong>
                    </div>
                    <div className={styles.runMetrics}><span>原始发现 <b>{run.rawDiscoveredCount ?? run.discoveredCount}</b></span><span>成功解析 <b>{run.parsedCount || 0}</b></span><span>官网核验 <b>{run.websiteVerifiedCount || 0}</b></span><span>有效联系 <b>{run.validContactCount || 0}</b></span><span>自动合格 <b>{run.qualifiedCount || 0}</b></span><span>重复 <b>{run.duplicateCount}</b></span><span>准入失败 <b>{run.mandatoryGateFailedCount || run.excludedCount}</b></span><span>采集失败 <b>{run.failedCount}</b></span></div>
                    {run.errorSummary ? <pre className={styles.runError}>{run.errorSummary}</pre> : null}
                    {runItems.length ? <details className={styles.runDetails}><summary>查看本批明细（{runItems.length}）</summary><div>{runItems.slice(0, 20).map((item) => <a key={item.id} href={item.websiteUrl} target="_blank" rel="noreferrer"><span>{item.outcome === "imported" ? "新增" : item.outcome === "duplicate" ? "重复" : item.outcome === "excluded" ? "排除" : "失败"}</span><b>{item.companyName || item.normalizedDomain}</b><small>{item.reason}</small></a>)}</div></details> : null}
                  </article>
                );
              })}
              {!campaignDiscoveryRuns.length ? <p className={styles.muted}>尚无采集批次。添加来源后点击“立即采集”，或等待来源到期。</p> : null}
            </div>
          </section>
        </section>
      ) : null}

      {activeView === "research" ? (
        <section className={styles.toolWorkspace} aria-label={VIEW_LABELS.research}>
          <div className={styles.toolHeader}><div><span className={styles.sectionKicker}>PUBLIC-EVIDENCE RESEARCH</span><h1>调研任务</h1><p>只生成检索计划和结构化任务书，不自动搜索、抓取或访问个人联系方式。</p></div><IconClipboard size={34} /></div>
          {activeCampaign ? (
            <div className={styles.researchLayout}>
              <section className={styles.toolSection}>
                <div className={styles.sectionTitleRow}><h2>本地语言检索词</h2><button className={styles.secondaryButton} type="button" onClick={() => downloadText(activeCampaign.name + "-research-brief.md", activeCampaign.researchBrief)}><IconDownload size={18} />下载研究任务书</button></div>
                <div className={styles.keywordList}>{activeCampaign.searchKeywords.map((item) => <article key={item.locale + "-" + item.keyword}><span>{item.locale}</span><div><b>{item.keyword}</b><small>{item.purpose}</small></div></article>)}</div>
              </section>
              <section className={styles.toolSection}>
                <h2><IconFileDescription size={20} /> 任务书预览</h2>
                <pre className={styles.briefPreview}>{activeCampaign.researchBrief}</pre>
              </section>
            </div>
          ) : <div className={styles.emptyState}><b>请先创建 Campaign</b><button type="button" onClick={() => setActiveView("campaign")}>前往 Campaign</button></div>}
        </section>
      ) : null}

      {activeView === "import" ? (
        <section className={styles.toolWorkspace} aria-label={VIEW_LABELS.import}>
          <div className={styles.toolHeader}><div><span className={styles.sectionKicker}>TRACEABLE INTAKE</span><h1>数据导入</h1><p>只接受经过审核的 CSV 或 JSON；哈希、来源和评分理由会一并保留。</p></div><IconUpload size={34} /></div>
          <div className={styles.toolGrid}>
            <section className={styles.toolSection}>
              <h2>导入到当前 Campaign</h2>
              <p className={styles.muted}>{campaignLabel}</p>
              <div className={styles.templateLinks}><a href="/qixin-lead-engine-template.csv" download>下载 CSV 模板</a><a href="/qixin-lead-engine-template.json" download>下载 JSON 模板</a></div>
              <form className={styles.importForm} onSubmit={importFile}>
                <label className={styles.fileField}>选择已审核文件<input name="file" type="file" accept=".csv,.json,text/csv,application/json" required disabled={!activeCampaignId || activeCampaign?.status !== "active" || pending} /></label>
                <button className={styles.primaryButton} type="submit" disabled={!activeCampaignId || activeCampaign?.status !== "active" || pending}>{pending ? "正在处理…" : activeCampaign?.status !== "active" ? "先把 Campaign 设为运行中" : "导入当前 Campaign"}</button>
              </form>
              {importReport ? <div className={styles.importReport}><b>写入 {importReport.imported} 条，跳过 {importReport.skipped} 条</b>{importReport.results?.filter((item) => item.status !== "imported").slice(0, 5).map((item) => <span key={String(item.row)}>第 {String(item.row)} 行：{String(item.error || item.status)}</span>)}</div> : null}
            </section>
            <section className={styles.toolSection}>
              <h2>导入审计</h2>
              <div className={styles.auditList}>{workspace.imports.filter((run) => run.campaignId === activeCampaignId).slice(0, 8).map((run) => <article key={run.id}><div><b>{run.originalFilename || "结构化导入"}</b><span>{formatDate(run.createdAt)}</span></div><strong>{run.importedCount}/{run.rowCount} 写入</strong></article>)}{!workspace.imports.some((run) => run.campaignId === activeCampaignId) ? <p className={styles.muted}>尚无导入记录。</p> : null}</div>
              <div className={styles.guardrails}><b><IconShieldLock size={18} /> 明确禁止</b><span>无授权搜索或额度消耗</span><span>邮箱猜测与自动补全</span><span>自动生成或发送开发信</span><span>直接写生产 CRM</span></div>
            </section>
          </div>
        </section>
      ) : null}

      {activeView === "export" ? (
        <section className={styles.toolWorkspace} aria-label={VIEW_LABELS.export}>
          <div className={styles.toolHeader}><div><span className={styles.sectionKicker}>CONTROLLED CRM HANDOFF</span><h1>CRM 导出</h1><p>只有人工批准并通过准入门槛的公司才能生成兼容文件。</p></div><IconFileExport size={34} /></div>
          <section className={styles.exportPanel}>
            <div className={styles.exportCount}><span>当前可导出</span><b>{approvedCount}</b><small>家已批准客户</small></div>
            <div className={styles.exportCopy}><h2>{approvedCount ? "导出已批准客户" : "暂无可导出客户"}</h2><p>导出只生成 CRM 兼容 CSV 并记录批次，不会调用或写入生产 CRM。下载后仍需人工确认导入。</p><button className={styles.primaryButton} type="button" disabled={!approvedCount || pending} onClick={() => void exportApproved()}><IconDownload size={18} />导出 {approvedCount} 家已批准客户</button></div>
          </section>
          <section className={styles.toolSection}>
            <h2>导出审计</h2>
            <div className={styles.auditList}>{workspace.exports.filter((run) => run.campaignId === activeCampaignId).map((run) => <article key={run.id}><div><b>CRM 兼容 CSV</b><span>{formatDate(run.createdAt)}</span></div><strong>{run.rowCount} 家</strong></article>)}{!workspace.exports.some((run) => run.campaignId === activeCampaignId) ? <p className={styles.muted}>尚无导出记录。</p> : null}</div>
          </section>
        </section>
      ) : null}

      {activeView === "review" && drawerOpen ? (
        <aside className={styles.drawer} aria-label="当前客户证据与审核">
          {selectedLead && selectedCompany ? (
            <>
              <div className={styles.drawerHeader}>
                <div><span>当前客户</span><h2>{selectedCompany.companyName}</h2></div>
                <button type="button" aria-label="关闭客户详情" onClick={() => setDrawerOpen(false)}><IconX size={22} /></button>
              </div>

              <div className={styles.drawerBody}>
                <dl className={styles.drawerFacts}>
                  <div><dt>类型</dt><dd>{selectedCompany.customerType || localizedCompanyType(selectedCompany.companyType)}</dd></div>
                  <div><dt>国家</dt><dd>{localizedCountry(selectedCompany.country)}</dd></div>
                  <div><dt>评分</dt><dd className={styles.drawerScore}>{selectedLead.currentScore}</dd></div>
                </dl>

                <section className={styles.coverageBlock}>
                  <div><span>证据覆盖</span><b>{selectedLead.evidenceCoverage}%</b></div>
                  <progress max="100" value={selectedLead.evidenceCoverage}>{selectedLead.evidenceCoverage}%</progress>
                  <div className={styles.confidenceRow}><span>可信度</span><b>{CONFIDENCE_LABELS[selectedLead.scoreConfidence] || selectedLead.scoreConfidence}</b></div>
                </section>

                <section className={styles.decisionSummary}>
                  <article><span>关键采购信号</span><p>{localizedCompanyType(selectedCompany.companyType)}，官网公开{companySignal(selectedCompany).replaceAll(" · ", "、")}</p></article>
                  <article className={styles.riskSummary}><span><IconAlertTriangle size={17} /> 风险</span><p>{compactRisk(selectedLead)}</p></article>
                </section>

                <details className={styles.drawerDetails}>
                  <summary>完整评分 <span>{selectedScoreRun?.rubricVersion || "版本未记录"}</span></summary>
                  <div className={styles.scoreList}>{selectedDimensions.map((item) => <article key={item.id}><div><b>{SCORE_LABELS[item.dimension] || item.dimension}</b><strong>{item.score}/{item.maxScore}</strong></div>{item.positiveReason ? <p><IconCheck size={15} />{item.positiveReason}</p> : null}{item.negativeReason ? <p className={styles.negativeReason}><IconAlertTriangle size={15} />{item.negativeReason}</p> : null}</article>)}</div>
                </details>

                <details className={styles.drawerDetails}>
                  <summary>证据来源 <span>{selectedSources.length} 条</span></summary>
                  <div className={styles.sourceList}>{selectedSources.map((source) => <a key={source.id} href={source.sourceUrl} target="_blank" rel="noreferrer"><div><b>{source.pageTitle || source.sourceType}</b><IconExternalLink size={16} /></div><p>{source.evidenceSummary || "无来源摘要"}</p><small>{source.confidence} · 核验于 {formatDate(source.retrievedAt)}</small></a>)}{!selectedSources.length ? <p className={styles.muted}>没有来源，不能批准。</p> : null}{selectedClaims.slice(0, 5).map((claim) => <article key={claim.id}><span>{claim.evidenceKind}</span><b>{claim.claimSummary}</b></article>)}</div>
                </details>

                <details className={styles.drawerDetails}>
                  <summary>公司资料 <span>{selectedDomains.length ? "已解析域名" : "域名待补"}</span></summary>
                  <dl className={styles.compactFacts}>
                    <div><dt>官网</dt><dd>{selectedCompany.website ? <a href={selectedCompany.website} target="_blank" rel="noreferrer">{selectedCompany.primaryDomain || selectedCompany.website}<IconExternalLink size={14} /></a> : "未记录"}</dd></div>
                    <div><dt>域名</dt><dd>{selectedDomains.join(" · ") || "未记录"}</dd></div>
                    <div><dt>客户类型 / 角色</dt><dd>{[selectedCompany.customerType, selectedCompany.companyRole].filter(Boolean).join(" · ") || "未记录"}</dd></div>
                    <div><dt>产品方向</dt><dd>{jsonList(selectedCompany.productDirectionsJson).join(" · ") || "未记录"}</dd></div>
                    <div><dt>产品 / 品牌</dt><dd>{[...jsonList(selectedCompany.productsJson), ...jsonList(selectedCompany.brandsJson)].join(" · ") || "未记录"}</dd></div>
                    <div><dt>推荐产品</dt><dd>{jsonList(selectedLead.recommendedProductsJson).join(" · ") || "未记录"}</dd></div>
                    <div><dt>公开商务渠道</dt><dd>{selectedCompany.businessEmail || selectedCompany.contactChannel || "未记录"}</dd></div>
                    <div><dt>来源</dt><dd>{[selectedCompany.sourceType, selectedCompany.sourceName].filter(Boolean).join(" · ") || "未记录"}</dd></div>
                    <div><dt>发现 / 核验</dt><dd>{formatDate(selectedCompany.firstDiscoveredAt)} / {formatDate(selectedCompany.lastVerifiedAt)}</dd></div>
                  </dl>
                  {selectedContacts.length ? <p className={styles.muted}>已保存 {selectedContacts.length} 条候选联系人记录；本页默认不展示个人联系方式。</p> : null}
                </details>

                <details className={styles.drawerDetails} open={selectedContactVerifications.length > 0}>
                  <summary>商务联系方式核验 <span>{selectedContactVerifications.length} 条</span></summary>
                  <div className={styles.sourceList}>{selectedContactVerifications.map((contact) => <a key={contact.id} href={contact.sourceUrl} target="_blank" rel="noreferrer"><div><b>{contact.contactType} · {contact.status === "valid" ? "有效" : "未通过"}</b><IconExternalLink size={16} /></div><p>{contact.contactValue || "未保存具体值"}</p><small>{contact.sameCompanyDomain ? "企业同域" : "可信官方来源"} · 核验于 {formatDate(contact.verifiedAt)}</small></a>)}{!selectedContactVerifications.length ? <p className={styles.muted}>没有公开商务联系方式核验记录，不能计入每日目标。</p> : null}</div>
                </details>

                {selectedReviews.length ? <details className={styles.drawerDetails}><summary>审核历史 <span>{selectedReviews.length} 条</span></summary><div className={styles.auditList}>{selectedReviews.map((reviewItem) => <article key={reviewItem.id}><div><b>{STATUS_LABELS[reviewItem.decision] || reviewItem.decision}</b><span>{formatDate(reviewItem.createdAt)}</span></div><p>{reviewItem.notes || "未附备注"}</p></article>)}</div></details> : null}
              </div>

              <div className={styles.reviewDock}>
                <label>审核备注<input value={reviewNotes} onChange={(event) => setReviewNotes(event.target.value)} placeholder="淘汰时必须填写原因" /></label>
                <button type="button" className={styles.keepButton} onClick={() => void reverifySelectedLead()} disabled={pending || !selectedCompany.website}><IconRadar size={17} />手工重新核验官网与联系方式</button>
                {approvalGaps.length ? <div className={styles.gapSummary}><IconAlertTriangle size={17} /><span>{approvalGaps.slice(0, 3).join(" · ")}</span></div> : <div className={styles.readySummary}><IconCheck size={17} /><span>已满足批准闸门，仍需你做最终判断。</span></div>}
                <button type="button" className={styles.approveButton} onClick={() => review("approved")} disabled={pending || approvalGaps.length > 0}>
                  {approvalGaps.length ? "证据不足，暂不能批准" : "批准进入导出池"}
                </button>
                <button type="button" className={styles.rejectButton} onClick={() => review("rejected")} disabled={pending}><IconTrash size={18} />淘汰</button>
                <button type="button" className={styles.keepButton} onClick={() => review("needs_review")} disabled={pending}><IconClock size={17} />保留待审核</button>
              </div>
            </>
          ) : <div className={styles.emptyState}><b>选择一家公司查看证据</b></div>}
        </aside>
      ) : null}
    </main>
  );
}
