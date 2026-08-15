"use client";

import { useCallback, useEffect, useState } from "react";
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
type LeadListRow = {
  leadId: string; campaignId: string; companyId: string; workflowStatus: string; qualificationResult: string;
  hardGateStatus: string; hardGateReason?: string; riskSummary?: string; score: number; grade: string;
  evidenceCoverage: number; confidence: string; autoQualifiedAt?: string; companyName: string; country?: string;
  region?: string; companyType?: string; customerType?: string; companyRole?: string; productsJson: string;
  brandsJson: string; wholesaleSignal?: string; productDirectionsJson?: string; website?: string; primaryDomain?: string;
  businessEmail?: string; contactChannel?: string; contactStatus?: string; sourceType?: string; sourceName?: string;
  firstDiscoveredAt?: string; lastVerifiedAt?: string; isDuplicate: boolean; doNotContact: boolean;
};
type LeadPage = {
  rows: LeadListRow[];
  pagination: { page: number; pageSize: number; total: number; pageCount: number };
  facets: {
    statusCounts: Record<string, number>; gradeCounts: Record<string, number>; countries: string[];
    companyTypes: string[]; sourceTypes: string[];
  };
};
type LeadDetail = {
  lead: Lead; company: Company; sources: Source[]; claims: Claim[]; scoreRun: ScoreRun | null;
  scoreDimensions: ScoreDimension[]; reviews: Review[]; domains: Array<{ id: string; normalizedDomain: string; relationshipType: string }>;
  contactCount: number; contactVerifications: ContactVerification[];
};
type Workspace = {
  campaigns: Campaign[]; leadCounts: Record<string, Record<string, number>>; imports: ImportRun[]; exports: ExportRun[];
  discoverySources: DiscoverySource[]; discoveryRuns: DiscoveryRun[]; discoveryItems: DiscoveryItem[];
  engineState: EngineState | null; dailyTargets: DailyTarget[];
  discoveryAlerts: DiscoveryAlert[]; sourceHealth: SourceHealth[]; discoveryAttempts: Array<Record<string, unknown>>; parserVersions: Array<Record<string, unknown>>;
};

const EMPTY_WORKSPACE: Workspace = { campaigns: [], leadCounts: {}, imports: [], exports: [], discoverySources: [], discoveryRuns: [], discoveryItems: [], engineState: null, dailyTargets: [], discoveryAlerts: [], sourceHealth: [], discoveryAttempts: [], parserVersions: [] };
const EMPTY_LEAD_PAGE: LeadPage = { rows: [], pagination: { page: 1, pageSize: 25, total: 0, pageCount: 1 }, facets: { statusCounts: { all: 0 }, gradeCounts: {}, countries: [], companyTypes: [], sourceTypes: [] } };
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
  export: "CRM 导出",
  advanced: "高级工具",
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

function companyWebsiteUrl(company?: Pick<Company, "website" | "primaryDomain">) {
  const rawValue = company?.website?.trim() || company?.primaryDomain?.trim();
  if (!rawValue) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(rawValue) ? rawValue : `https://${rawValue}`);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function companySignal(company?: Pick<Company, "productsJson" | "brandsJson" | "businessEmail" | "contactChannel" | "wholesaleSignal">) {
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
  const [reviewCampaignId, setReviewCampaignId] = useState("all");
  const [activeCampaignId, setActiveCampaignId] = useState("");
  const [exportCampaignId, setExportCampaignId] = useState("");
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
  const [leadLoading, setLeadLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [assignmentCampaignId, setAssignmentCampaignId] = useState("");
  const [activeView, setActiveView] = useState<ViewKey>("discovery");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [leadPage, setLeadPage] = useState<LeadPage>(EMPTY_LEAD_PAGE);
  const [leadDetail, setLeadDetail] = useState<LeadDetail | null>(null);
  const [leadRefreshKey, setLeadRefreshKey] = useState(0);
  const [importReport, setImportReport] = useState<{ imported: number; skipped: number; results?: Array<Record<string, unknown>> } | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const data = await api<Workspace>("/api/workspace");
      setWorkspace(data);
      const businessCampaigns = data.campaigns.filter((item) => item.id !== "system:unassigned");
      setActiveCampaignId((current) => businessCampaigns.some((item) => item.id === current) ? current : businessCampaigns[0]?.id || "");
      setExportCampaignId((current) => businessCampaigns.some((item) => item.id === current) ? current : businessCampaigns[0]?.id || "");
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "无法加载独立实验数据库"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);
  useEffect(() => {
    if (workspace.engineState?.status !== "running") return;
    const timer = window.setInterval(() => { void load(); setLeadRefreshKey((value) => value + 1); }, 30_000);
    return () => window.clearInterval(timer);
  }, [load, workspace.engineState?.status]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLeadLoading(true);
      const parameters = new URLSearchParams({ page: String(page), pageSize: "25" });
      if (reviewCampaignId !== "all") parameters.set("campaignId", reviewCampaignId);
      if (statusFilter !== "all") parameters.set("status", statusFilter);
      if (gradeFilter !== "all") parameters.set("grade", gradeFilter);
      if (countryFilter !== "all") parameters.set("country", countryFilter);
      if (typeFilter !== "all") parameters.set("customerType", typeFilter);
      if (productFilter !== "all") parameters.set("productDirection", productFilter);
      if (contactFilter !== "all") parameters.set("contactStatus", contactFilter);
      if (sourceFilter !== "all") parameters.set("sourceType", sourceFilter);
      if (specialFilter === "duplicate") parameters.set("duplicate", "true");
      if (specialFilter === "dnc") parameters.set("doNotContact", "true");
      if (search.trim()) parameters.set("q", search.trim());
      if (sortBy === "score_asc") { parameters.set("sort", "score"); parameters.set("order", "asc"); }
      else if (sortBy === "company_asc") { parameters.set("sort", "company"); parameters.set("order", "asc"); }
      else if (sortBy === "newest") { parameters.set("sort", "firstDiscovered"); parameters.set("order", "desc"); }
      else { parameters.set("sort", "score"); parameters.set("order", "desc"); }
      void api<LeadPage>(`/api/leads?${parameters.toString()}`, { signal: controller.signal }).then((data) => {
        setLeadPage(data);
        setSelectedLeadId((current) => data.rows.some((row) => row.leadId === current) ? current : data.rows[0]?.leadId || "");
        if (!data.rows.length) setDrawerOpen(false);
      }).catch((requestError) => {
        if (!(requestError instanceof DOMException && requestError.name === "AbortError")) setError(requestError instanceof Error ? requestError.message : "客户列表加载失败");
      }).finally(() => { if (!controller.signal.aborted) setLeadLoading(false); });
    }, 220);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [contactFilter, countryFilter, gradeFilter, leadRefreshKey, page, productFilter, reviewCampaignId, search, sortBy, sourceFilter, specialFilter, statusFilter, typeFilter]);

  useEffect(() => {
    if (!drawerOpen || !selectedLeadId) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setDetailLoading(true);
      void api<LeadDetail>(`/api/leads/${selectedLeadId}`, { signal: controller.signal }).then(setLeadDetail).catch((requestError) => {
        if (!(requestError instanceof DOMException && requestError.name === "AbortError")) setError(requestError instanceof Error ? requestError.message : "客户详情加载失败");
      }).finally(() => { if (!controller.signal.aborted) setDetailLoading(false); });
    }, 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [drawerOpen, leadRefreshKey, selectedLeadId]);

  const businessCampaigns = workspace.campaigns.filter((campaign) => campaign.id !== "system:unassigned");
  const activeBusinessCampaigns = businessCampaigns.filter((campaign) => campaign.status === "active");
  const activeCampaign = businessCampaigns.find((campaign) => campaign.id === activeCampaignId) || null;
  const exportCampaign = businessCampaigns.find((campaign) => campaign.id === exportCampaignId) || null;
  const visibleLeads = leadPage.rows;
  const selectedLead = leadDetail?.lead || null;
  const selectedCompany = leadDetail?.company || null;
  const selectedSources = leadDetail?.sources || [];
  const selectedClaims = leadDetail?.claims || [];
  const selectedScoreRun = leadDetail?.scoreRun || null;
  const selectedDimensions = leadDetail?.scoreDimensions || [];
  const selectedReviews = leadDetail?.reviews || [];
  const selectedContactVerifications = leadDetail?.contactVerifications || [];
  const selectedDomains = leadDetail?.domains.map((domain) => domain.normalizedDomain) || [];
  const counts = leadPage.facets.statusCounts;
  const countries = leadPage.facets.countries;
  const companyTypes = leadPage.facets.companyTypes;
  const sourceTypes = leadPage.facets.sourceTypes;
  const pageCount = leadPage.pagination.pageCount;
  const approvedCount = Number(counts.approved || 0);
  const exportApprovedCount = Number(workspace.leadCounts[exportCampaignId]?.approved || 0);
  const totalApprovedCount = businessCampaigns.reduce((sum, campaign) => sum + Number(workspace.leadCounts[campaign.id]?.approved || 0), 0);
  const rejectedCount = Number(counts.rejected || 0);
  const campaignDiscoverySources = workspace.discoverySources.filter((source) => source.campaignId === activeCampaignId);
  const globalDiscoverySources = workspace.discoverySources.filter((source) => businessCampaigns.some((campaign) => campaign.id === source.campaignId));
  const globalDiscoveryRuns = workspace.discoveryRuns.filter((run) => businessCampaigns.some((campaign) => campaign.id === run.campaignId));
  const discoverySourceById = new Map(workspace.discoverySources.map((source) => [source.id, source]));
  const dueSourceCount = campaignDiscoverySources.filter((source) => source.status === "active" && source.cadence !== "manual" && source.nextRunAt && new Date(source.nextRunAt) <= new Date()).length;
  const engine = workspace.engineState;
  const todayTarget = workspace.dailyTargets[0] || null;
  const todayRemaining = Math.max(0, (todayTarget?.targetCount || engine?.dailyTarget || 20) - (todayTarget?.qualifiedCount || 0));
  const openAlerts = workspace.discoveryAlerts.filter((alert) => !alert.resolvedAt);
  const latestRun = globalDiscoveryRuns[0] || null;
  const campaignById = new Map(workspace.campaigns.map((campaign) => [campaign.id, campaign]));
  const globalSourceOverview = [...new Set(globalDiscoverySources.map((source) => source.sourceUrl))].map((sourceUrl) => {
    const rows = globalDiscoverySources.filter((source) => source.sourceUrl === sourceUrl);
    const representative = rows.find((source) => source.enabled && source.status === "active") || rows[0];
    return { ...representative, activeCampaignCount: rows.filter((source) => source.enabled && source.status === "active").length };
  });
  const reviewCampaignName = reviewCampaignId === "all" ? "全部 Campaign"
    : reviewCampaignId === "system:unassigned" ? "待分配"
      : businessCampaigns.find((campaign) => campaign.id === reviewCampaignId)?.name || "Campaign";
  const campaignMarket = activeCampaign?.targetMarkets || jsonList(activeCampaign?.targetCountriesJson)[0] || "";
  const campaignLeadCount = Number(workspace.leadCounts[activeCampaignId]?.all || 0);
  const campaignLabel = activeCampaign
    ? `${localizedCountry(campaignMarket)}${PRODUCT_LABELS[activeCampaign.productTrack] || "眼镜"} · ${campaignLeadCount} 家`
    : "尚未选择 Campaign";
  const approvalGaps = selectedLead && selectedCompany ? [
    selectedLead.campaignId === "system:unassigned" ? "必须先分配到 Campaign" : "",
    selectedLead.hardGateStatus !== "pass" ? "强制准入尚未通过" : "",
    selectedLead.currentScore < 60 ? "评分低于 60" : "",
    selectedLead.evidenceCoverage < 40 ? "证据覆盖率低于 40%" : "",
    selectedLead.scoreConfidence === "low" ? "评分可信度仍为低" : "",
    selectedCompany.doNotContact ? "已进入禁止联系名单" : "",
    !selectedSources.length ? "没有来源" : "",
    !selectedCompany.businessEmail && !selectedCompany.contactChannel && !leadDetail?.contactCount ? "没有商务联系渠道" : "",
    selectedDimensions.length !== Object.keys(SCORE_LIMITS).length ? "评分维度不完整" : "",
  ].filter(Boolean) : [];

  function openLead(leadId: string) {
    setSelectedLeadId(leadId);
    setLeadDetail(null);
    setDetailLoading(true);
    setDrawerOpen(true);
  }

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
      form.reset(); await load(); setLeadRefreshKey((value) => value + 1);
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "导入失败"); }
    finally { setPending(false); }
  }

  async function review(decision: string) {
    if (!selectedLead) return;
    if (decision === "rejected" && !reviewNotes.trim()) { setError("淘汰 Lead 前必须填写原因。"); return; }
    setPending(true); setError(""); setNotice("");
    try {
      await api("/api/reviews", { method: "POST", body: JSON.stringify({ leadId: selectedLead.id, decision, notes: reviewNotes }) });
      setReviewNotes(""); setDrawerOpen(false); await load(); setLeadRefreshKey((value) => value + 1); setNotice(`审核决定已保存：${STATUS_LABELS[decision]}。没有写入生产 CRM。`);
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "审核未完成"); }
    finally { setPending(false); }
  }

  async function exportApproved() {
    if (!exportCampaign || !exportApprovedCount) return;
    setPending(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/exports/crm", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ campaignId: exportCampaign.id }) });
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
      await load(); setLeadRefreshKey((value) => value + 1); setNotice(`采集完成：自动筛选合格 ${result.qualified} 家，写入 ${result.imported} 家，重复 ${result.duplicate} 家，排除 ${result.excluded} 家，失败 ${result.failed} 家。没有自动批准或联系。`);
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "采集运行失败"); }
    finally { setPending(false); }
  }

  async function reverifySelectedLead() {
    if (!selectedLead) return;
    setPending(true); setError(""); setNotice("");
    try {
      const result = await api<{ qualified: boolean; score: number; evidenceCoverage: number; failures: string[] }>(`/api/leads/${selectedLead.id}/reverify`, { method: "POST", body: "{}" });
      await load(); setLeadRefreshKey((value) => value + 1);
      setNotice(result.qualified
        ? `重新核验通过：评分 ${result.score}，证据覆盖率 ${result.evidenceCoverage}%，仍需人工批准后才能联系。`
        : `重新核验完成但未通过准入：${result.failures.join("；")}`);
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "重新核验失败"); }
    finally { setPending(false); }
  }

  async function assignSelectedLead() {
    if (!selectedLead || selectedLead.campaignId !== "system:unassigned" || !assignmentCampaignId) return;
    setPending(true); setError(""); setNotice("");
    try {
      const result = await api<{ campaign: Campaign }>(`/api/leads/${selectedLead.id}/assign`, {
        method: "POST", body: JSON.stringify({ campaignId: assignmentCampaignId }),
      });
      setDrawerOpen(false); setAssignmentCampaignId(""); await load(); setLeadRefreshKey((value) => value + 1);
      setNotice(`客户已分配到 ${result.campaign.name}，仍保留为待审核状态。`);
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "客户分配失败"); }
    finally { setPending(false); }
  }

  async function controlEngine(action: "start" | "pause" | "resume" | "stop" | "run_batch") {
    if (action === "start" && !activeBusinessCampaigns.length) {
      setError("请先启用至少一个 Campaign。"); return;
    }
    setPending(true); setError(""); setNotice("");
    try {
      await api("/api/engine/control", {
        method: "POST",
        body: JSON.stringify({ action, dailyTarget: 20, timezone: "Asia/Shanghai", runNow: true }),
      });
      await load();
      if (action === "start" || action === "run_batch") setLeadRefreshKey((value) => value + 1);
      setNotice(action === "start" ? "自动找客户状态已持久化；只有部署环境已启用服务器 Cron 时，关闭浏览器后才会继续运行。"
        : action === "pause" ? "自动发现已暂停。" : action === "resume" ? "自动发现已恢复。"
          : action === "stop" ? "自动发现已停止；历史数据和日志保留。" : "已完成一轮受控补采批次。");
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "自动引擎操作失败"); }
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
          <button type="button" className={activeView === "discovery" ? styles.navActive : ""} onClick={() => setActiveView("discovery")}>
            <IconRadar size={21} stroke={1.8} /><span>自动发现</span>
          </button>
          <button type="button" className={activeView === "review" ? styles.navActive : ""} onClick={() => { setActiveView("review"); setDrawerOpen(false); }}>
            <IconUsers size={21} stroke={1.8} /><span>客户审核</span>
          </button>
          <button type="button" className={activeView === "campaign" ? styles.navActive : ""} onClick={() => setActiveView("campaign")}>
            <IconTargetArrow size={21} stroke={1.8} /><span>Campaign</span>
          </button>
          <button type="button" className={activeView === "export" ? styles.navActive : ""} onClick={() => setActiveView("export")}>
            <IconFileExport size={21} stroke={1.8} /><span>CRM 导出</span>
          </button>
          <button type="button" className={activeView === "advanced" ? styles.navActive : ""} onClick={() => setActiveView("advanced")}>
            <IconSettings size={21} stroke={1.8} /><span>高级工具</span>
          </button>
        </nav>

        <div className={styles.sidebarFoot}>
          <div className={styles.privateStatus}><IconShieldLock size={18} /><span><b>私有实验环境</b><small>无自动发送 · 无 CRM 直写</small></span></div>
          <button type="button" onClick={() => setActiveView("advanced")}><IconSettings size={20} /><span>高级工具与维护</span></button>
        </div>
      </aside>

      <header className={styles.topBar}>
        <div className={styles.campaignSwitcher}>
          <span>{activeView === "discovery" ? "全局自动发现" : VIEW_LABELS[activeView]}</span>
          <strong>{activeView === "review" ? reviewCampaignName : activeView === "discovery" ? `${activeBusinessCampaigns.length} 个运行中 Campaign` : "眼镜客户开发引擎"}</strong>
          <small>{activeView === "discovery" ? "系统按各 Campaign 市场自动轮换来源与归类" : "私有环境 · 人工批准后才能导出"}</small>
        </div>

        {activeView === "review" ? <div className={styles.summaryMetrics} aria-label="审核状态概览">
          <button type="button" className={statusFilter === "needs_review" && activeView === "review" ? styles.metricActive : ""} onClick={() => { setActiveView("review"); setStatusFilter("needs_review"); setDrawerOpen(false); setPage(1); }}>
            <span>待审核</span><b className={styles.metricBlue}>{counts.needs_review || 0}</b>
          </button>
          <button type="button" className={statusFilter === "rejected" && activeView === "review" ? styles.metricActive : ""} onClick={() => { setActiveView("review"); setStatusFilter("rejected"); setDrawerOpen(false); setPage(1); }}>
            <span>已淘汰</span><b className={styles.metricRed}>{rejectedCount}</b>
          </button>
          <button type="button" className={statusFilter === "approved" && activeView === "review" ? styles.metricActive : ""} onClick={() => { setActiveView("review"); setStatusFilter("approved"); setDrawerOpen(false); setPage(1); }}>
            <span>已批准</span><b className={styles.metricGreen}>{approvedCount}</b>
          </button>
        </div> : null}
      </header>

      {error ? <div className={styles.error} role="alert">{error}</div> : null}
      {notice ? <div className={styles.notice} role="status">{notice}</div> : null}

      {activeView === "review" ? (
        <section className={[styles.reviewWorkspace, !drawerOpen && styles.workspaceExpanded].filter(Boolean).join(" ")} aria-label={VIEW_LABELS.review}>
          <div className={styles.reviewHeader}>
            <div className={styles.reviewTitleGroup}>
              <h1>{statusFilter === "needs_review" ? "待审核客户" : STATUS_LABELS[statusFilter] || "客户审核"}</h1>
              <label className={styles.reviewCampaignPicker}>审核 Campaign
                <select value={reviewCampaignId} onChange={(event) => { setReviewCampaignId(event.target.value); setSelectedLeadId(""); setDrawerOpen(false); setPage(1); }}>
                  <option value="all">全部 Campaign</option>
                  <option value="system:unassigned">待分配（{workspace.leadCounts["system:unassigned"]?.all || 0}）</option>
                  {businessCampaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>
                    {campaign.name} · 待审核 {workspace.leadCounts[campaign.id]?.needs_review || 0} / 淘汰 {workspace.leadCounts[campaign.id]?.rejected || 0}
                  </option>)}
                </select>
              </label>
            </div>
            <details className={styles.filterDisclosure}>
              <summary><IconSearch size={19} />筛选与搜索</summary>
              <div className={styles.filterPanel}>
                <label className={styles.searchBox}>
                  <IconSearch size={20} aria-hidden="true" />
                  <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="搜索公司、国家或类型" />
                </label>
                <div className={styles.filterBar}>
                  <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }} aria-label="工作流状态筛选">
                    {STATUS_FILTERS.map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}（{counts[status] || 0}）</option>)}
                  </select>
                  <select value={gradeFilter} onChange={(event) => { setGradeFilter(event.target.value); setPage(1); }} aria-label="评分等级筛选">
                    <option value="all">全部评分</option>
                    {["S", "A", "B", "C", "Reject"].map((grade) => <option key={grade} value={grade}>{grade} 级</option>)}
                  </select>
                  <select value={typeFilter} onChange={(event) => { setTypeFilter(event.target.value); setPage(1); }} aria-label="客户类型筛选">
                    <option value="all">全部类型</option>
                    {companyTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                  <select value={countryFilter} onChange={(event) => { setCountryFilter(event.target.value); setPage(1); }} aria-label="国家筛选">
                    <option value="all">全部国家</option>
                    {countries.map((country) => <option key={country} value={country}>{localizedCountry(country)}</option>)}
                  </select>
                  <select value={productFilter} onChange={(event) => { setProductFilter(event.target.value); setPage(1); }} aria-label="产品方向筛选">
                    <option value="all">全部产品方向</option>
                    {PRODUCT_DIRECTIONS.map((product) => <option key={product} value={product}>{product}</option>)}
                  </select>
                  <select value={contactFilter} onChange={(event) => { setContactFilter(event.target.value); setPage(1); }} aria-label="联系方式状态筛选">
                    <option value="all">全部联系状态</option><option value="valid">联系方式有效</option><option value="missing">无有效联系方式</option><option value="unverified">未核验</option>
                  </select>
                  <select value={sourceFilter} onChange={(event) => { setSourceFilter(event.target.value); setPage(1); }} aria-label="来源类型筛选">
                    <option value="all">全部来源类型</option>{sourceTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                  <select value={specialFilter} onChange={(event) => { setSpecialFilter(event.target.value); setPage(1); }} aria-label="特殊状态筛选">
                    <option value="all">全部记录</option><option value="duplicate">仅重复</option><option value="dnc">仅禁止联系</option>
                  </select>
                  <select value={sortBy} onChange={(event) => { setSortBy(event.target.value); setPage(1); }} aria-label="排序">
                    <option value="score_desc">评分从高到低</option><option value="score_asc">评分从低到高</option><option value="newest">最新发现</option><option value="company_asc">公司名称</option>
                  </select>
                </div>
                <span className={styles.resultCount}>找到 {leadPage.pagination.total} 家</span>
              </div>
            </details>
          </div>

          <div className={styles.reviewStatusTabs} aria-label="手机审核状态">
            <button type="button" data-active={statusFilter === "needs_review"} onClick={() => { setStatusFilter("needs_review"); setPage(1); }}>待审核 <b>{counts.needs_review || 0}</b></button>
            <button type="button" data-active={statusFilter === "rejected"} onClick={() => { setStatusFilter("rejected"); setPage(1); }}>已淘汰 <b>{rejectedCount}</b></button>
            <button type="button" data-active={statusFilter === "approved"} onClick={() => { setStatusFilter("approved"); setPage(1); }}>已批准 <b>{approvedCount}</b></button>
          </div>

          <div className={styles.tableFrame} aria-busy={loading || leadLoading}>
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
                    const websiteUrl = companyWebsiteUrl(lead);
                    const isSelected = selectedLeadId === lead.leadId && drawerOpen;
                    const riskLevel = lead.hardGateStatus === "fail" ? "高" : "中等";
                    return (
                      <tr key={lead.leadId} className={isSelected ? styles.rowSelected : ""} aria-selected={isSelected}>
                        <td>
                          <div className={styles.companyCell}>
                            {websiteUrl ? (
                              <a className={styles.companyWebsite} href={websiteUrl} target="_blank" rel="noopener noreferrer" title={`打开 ${lead.companyName || "公司"} 官网`}>
                                <strong>{lead.companyName || "公司资料缺失"}<IconExternalLink size={14} aria-hidden="true" /></strong>
                                <small>{lead.primaryDomain || lead.website}</small>
                              </a>
                            ) : (
                              <span className={styles.companyUnavailable}>
                                <strong>{lead.companyName || "公司资料缺失"}</strong>
                                <small>官网待核验</small>
                              </span>
                            )}
                            <button type="button" className={styles.evidenceButton} onClick={() => openLead(lead.leadId)}>
                              查看证据与审核
                            </button>
                          </div>
                        </td>
                        <td>{lead.customerType || localizedCompanyType(lead.companyType)}</td>
                        <td>{localizedCountry(lead.country)}</td>
                        <td><b className={styles.scoreValue}>{lead.score}</b></td>
                        <td><b className={styles.coverageValue}>{lead.evidenceCoverage}%</b></td>
                        <td><span className={styles.signalText} title={companySignal(lead)}>{companySignal(lead)}</span></td>
                        <td><span className={lead.hardGateStatus === "fail" ? styles.riskHigh : styles.riskMedium}>{riskLevel}</span></td>
                        <td><span className={styles.statusBadge}>{STATUS_LABELS[lead.workflowStatus] || lead.workflowStatus}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className={styles.mobileLeadList} aria-label="客户卡片列表">
              {visibleLeads.map((lead) => (
                <article key={lead.leadId} className={selectedLeadId === lead.leadId && drawerOpen ? styles.mobileLeadSelected : ""}>
                  <button type="button" onClick={() => openLead(lead.leadId)} aria-label={`查看 ${lead.companyName} 的证据与审核`}>
                    <div className={styles.mobileLeadHead}>
                      <div><b>{lead.companyName}</b><span>{lead.primaryDomain || localizedCountry(lead.country)}</span></div>
                      <strong>{lead.score}</strong>
                    </div>
                    <div className={styles.mobileLeadMeta}>
                      <span>{lead.customerType || localizedCompanyType(lead.companyType)}</span>
                      <span>证据 {lead.evidenceCoverage}%</span>
                      <span>{STATUS_LABELS[lead.workflowStatus] || lead.workflowStatus}</span>
                    </div>
                    <p>{companySignal(lead)}</p>
                    <small>点按查看证据与审核</small>
                  </button>
                </article>
              ))}
            </div>

            {loading || leadLoading ? <div className={styles.emptyState}><IconClock size={26} /><b>正在读取私有数据库…</b></div> : null}
            {!loading && !businessCampaigns.length ? <div className={styles.emptyState}><IconTargetArrow size={28} /><b>先创建第一个 Campaign</b><p>建议从一个产品赛道、20–30 家候选公司开始。</p><button type="button" onClick={() => setActiveView("campaign")}>创建 Campaign</button></div> : null}
            {!loading && !leadLoading && businessCampaigns.length > 0 && !visibleLeads.length ? <div className={styles.emptyState}><IconSearch size={28} /><b>{statusFilter === "needs_review" && rejectedCount ? "这个 Campaign 暂无待审核客户" : "当前筛选没有客户"}</b><p>{statusFilter === "needs_review" && rejectedCount ? `已找到 ${rejectedCount} 家，但都未通过自动准入；可查看淘汰原因。` : "切换 Campaign、状态或清除筛选条件后再查看。"}</p>{statusFilter === "needs_review" && rejectedCount ? <button type="button" onClick={() => { setStatusFilter("rejected"); setPage(1); }}>查看 {rejectedCount} 家已淘汰客户</button> : <button type="button" onClick={() => { setStatusFilter("all"); setGradeFilter("all"); setCountryFilter("all"); setTypeFilter("all"); setProductFilter("all"); setContactFilter("all"); setSourceFilter("all"); setSpecialFilter("all"); setSearch(""); setPage(1); }}>清除筛选</button>}</div> : null}
            {!loading && !leadLoading && visibleLeads.length ? <div className={styles.pagination}><span>第 {Math.min(page, pageCount)} / {pageCount} 页 · 共 {leadPage.pagination.total} 家</span><div><button type="button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>上一页</button><button type="button" disabled={page >= pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}>下一页</button></div></div> : null}
          </div>
        </section>
      ) : null}

      {activeView === "campaign" ? (
        <section className={styles.toolWorkspace} aria-label={VIEW_LABELS.campaign}>
          <div className={styles.toolHeader}><div><span className={styles.sectionKicker}>CAMPAIGN CONTROL</span><h1>Campaign 管理</h1><p>定义市场、客户类型与排除规则；每日审核页只显示与当前任务相关的信息。</p></div><IconTargetArrow size={34} /></div>
          <div className={styles.toolGrid}>
            <section className={styles.toolSection}>
              <h2>编辑 Campaign</h2>
              <label className={styles.field}>选择 Campaign
                <select value={activeCampaignId} onChange={(event) => setActiveCampaignId(event.target.value)}>
                  <option value="">尚未创建 Campaign</option>
                  {businessCampaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}
                </select>
              </label>
              {activeCampaign ? (
                <>
                  <div className={styles.campaignOverview}>
                    <div><span>任务</span><b>{activeCampaign.name}</b></div>
                    <div><span>市场</span><b>{campaignLabel}</b></div>
                    <div><span>状态</span><b>{STATUS_LABELS[activeCampaign.status] || activeCampaign.status}</b></div>
                    <div><span>客户记录</span><b>{workspace.leadCounts[activeCampaign.id]?.all || 0} 家</b></div>
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
              <h1>全局自动找客户</h1>
              <p>无需先选择 Campaign。系统根据所有运行中 Campaign 的国家、客户类型与产品条件轮换公开来源，再按证据自动归类；无法可靠归类的客户进入待分配。</p>
            </div>
            <IconRadar size={34} />
          </div>

          <section className={styles.engineDashboard}>
            <div className={styles.engineControl}>
              <div><span>当前运行状态</span><b data-status={engine?.status || "stopped"}>{engine?.status === "running" ? "已标记运行" : engine?.status === "paused" ? "已暂停" : "已停止"}</b><small>时区：{engine?.timezone || "Asia/Shanghai"} · 后台持续运行需已启用 Cron</small></div>
              <div className={styles.engineActions}>
                <button className={styles.primaryButton} type="button" disabled={pending || engine?.status === "running" || !activeBusinessCampaigns.length} onClick={() => void controlEngine("start")}><IconPlayerPlay size={18} />开始自动找客户</button>
                <button className={styles.secondaryButton} type="button" disabled={pending || engine?.status !== "running"} onClick={() => void controlEngine("pause")}><IconPlayerPause size={18} />暂停</button>
                <button className={styles.secondaryButton} type="button" disabled={pending || engine?.status !== "paused"} onClick={() => void controlEngine("resume")}><IconPlayerPlay size={18} />恢复</button>
                <button className={styles.secondaryButton} type="button" disabled={pending || !engine || engine.status === "stopped"} onClick={() => void controlEngine("stop")}><IconX size={18} />停止</button>
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
              <span>后台目标：<b>{latestRun ? campaignById.get(latestRun.campaignId)?.name || "Campaign 已删除" : "自动轮换"}</b></span>
              <span>原始 / 解析 / 官网 / 有效联系：<b>{todayTarget?.rawDiscoveredCount || 0} / {todayTarget?.parsedCount || 0} / {todayTarget?.websiteVerifiedCount || 0} / {todayTarget?.validContactCount || 0}</b></span>
            </div>
            {todayTarget?.deficitReason || engine?.lastError ? <div className={styles.engineAlert}><IconAlertTriangle size={19} /><span>{todayTarget?.deficitReason || engine?.lastError}</span></div> : null}
            {openAlerts.length ? <div className={styles.alertList}>{openAlerts.slice(0, 5).map((alert) => <article key={alert.id} data-severity={alert.severity}><b>{alert.severity === "critical" ? "重要告警" : "来源提醒"}</b><span>{alert.message}</span><small>{formatDate(alert.createdAt)}</small></article>)}</div> : null}
            <div className={styles.engineExports}><span>自动合格客户可在审核台按 Campaign 查看证据；人工批准后才能导出。</span><button className={styles.secondaryButton} type="button" disabled={!totalApprovedCount} onClick={() => setActiveView("export")}><IconFileExport size={17} />前往 CRM 导出</button></div>
          </section>

          <div className={styles.discoveryPrinciples}>
            <article><b>预置官方来源免费运行</b><span>付费搜索和 GPT provider 有接口但默认关闭、无密钥也可运行</span></article>
            <article><b>每批最多 5 个候选</b><span>尊重 robots 与来源限流；失败后下一批自动切换来源</span></article>
            <article><b>人工批准仍是联系闸门</b><span>自动合格客户进入待审核，不发送邮件、不写生产 CRM</span></article>
          </div>

          <section className={[styles.toolSection, styles.sourceOverview].join(" ")}>
            <div className={styles.sectionTitleRow}><h2>来源运行概览</h2><button className={styles.secondaryButton} type="button" onClick={() => setActiveView("advanced")}><IconSettings size={17} />管理来源</button></div>
            <div className={styles.sourceOverviewGrid}>
              {globalSourceOverview.map((source) => (
                <article key={source.id}>
                  <div><b>{source.name}</b><span className={source.enabled && source.status === "active" ? styles.sourceActive : styles.sourcePaused}>{source.enabled && source.status === "active" ? `${source.tier}级 · 已启用` : "已暂停"}</span></div>
                  <p>{source.activeCampaignCount} 个 Campaign 使用</p>
                  <small>{source.region} · {source.cadence === "manual" ? "仅手动" : `下次：${formatDate(source.nextRunAt)}`}</small>
                </article>
              ))}
              {!globalSourceOverview.length ? <div className={styles.emptyCompact}><IconRadar size={28} /><b>尚未准备来源</b><span>启用 Campaign 后，引擎会按市场准备官方来源。</span></div> : null}
            </div>
          </section>

          <section className={[styles.toolSection, styles.discoveryHistory].join(" ")}>
            <div className={styles.sectionTitleRow}><h2>采集批次日志</h2><span className={styles.muted}>每一次访问、去重、排除和失败都会保留</span></div>
            <div className={styles.runList}>
              {globalDiscoveryRuns.map((run) => {
                const runItems = workspace.discoveryItems.filter((item) => item.runId === run.id);
                return (
                  <article key={run.id}>
                    <div className={styles.runSummary}>
                      <div><b>{discoverySourceById.get(run.sourceId)?.name || "已删除来源"}</b><span>{campaignById.get(run.campaignId)?.name || "Campaign 已删除"} · {formatDate(run.startedAt)} · {run.trigger === "scheduled" ? "定时" : "手动"}</span></div>
                      <strong data-status={run.status}>{run.status === "completed" ? "完成" : run.status === "partial" ? "部分完成" : run.status === "failed" ? "失败" : "运行中"}</strong>
                    </div>
                    <div className={styles.runMetrics}><span>原始发现 <b>{run.rawDiscoveredCount ?? run.discoveredCount}</b></span><span>成功解析 <b>{run.parsedCount || 0}</b></span><span>官网核验 <b>{run.websiteVerifiedCount || 0}</b></span><span>有效联系 <b>{run.validContactCount || 0}</b></span><span>自动合格 <b>{run.qualifiedCount || 0}</b></span><span>重复 <b>{run.duplicateCount}</b></span><span>准入失败 <b>{run.mandatoryGateFailedCount || run.excludedCount}</b></span><span>采集失败 <b>{run.failedCount}</b></span></div>
                    {run.errorSummary ? <pre className={styles.runError}>{run.errorSummary}</pre> : null}
                    {runItems.length ? <details className={styles.runDetails}><summary>查看本批明细（{runItems.length}）</summary><div>{runItems.slice(0, 20).map((item) => <a key={item.id} href={item.websiteUrl} target="_blank" rel="noreferrer"><span>{item.outcome === "imported" ? "新增" : item.outcome === "duplicate" ? "重复" : item.outcome === "excluded" ? "排除" : "失败"}</span><b>{item.companyName || item.normalizedDomain}</b><small>{item.reason}</small></a>)}</div></details> : null}
                  </article>
                );
              })}
              {!globalDiscoveryRuns.length ? <p className={styles.muted}>尚无采集批次。开始引擎后等待服务器定时运行；手工诊断入口位于高级工具。</p> : null}
            </div>
          </section>
        </section>
      ) : null}

      {activeView === "advanced" ? (
        <section className={styles.toolWorkspace} aria-label={VIEW_LABELS.advanced}>
          <div className={styles.toolHeader}><div><span className={styles.sectionKicker}>MAINTENANCE & FALLBACKS</span><h1>高级工具</h1><p>日常自动找客户不需要这些入口；仅在扩充来源、手工诊断、补录或恢复时使用。</p></div><IconSettings size={34} /></div>
          <label className={styles.contextPicker}>维护或导入到 Campaign
            <select value={activeCampaignId} onChange={(event) => setActiveCampaignId(event.target.value)}>
              <option value="">请选择 Campaign</option>
              {businessCampaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}
            </select>
          </label>

          <details className={styles.advancedSection} open>
            <summary><span><IconRadar size={20} />来源维护与手工诊断</span><small>{campaignDiscoverySources.length} 个来源 · {dueSourceCount} 个到期</small></summary>
            <div className={styles.toolGrid}>
              <section className={styles.toolSection}>
                <div className={styles.sectionTitleRow}><h2><IconPlus size={20} />添加已批准来源</h2><button className={styles.secondaryButton} type="button" disabled={pending || engine?.status !== "running"} onClick={() => void controlEngine("run_batch")}><IconRadar size={17} />受控补采一批</button></div>
                <p className={styles.muted}>只补充公开协会或展商目录。搜索结果不能直接作为合格证据；手工补采仍走同一自动引擎与每日计数。</p>
                <form className={styles.formGrid} onSubmit={addDiscoverySource}>
                  <label className={styles.field}>来源名称<input name="name" required maxLength={160} placeholder="例如：某眼镜展公开展商名录" /></label>
                  <label className={styles.field}>运行频率<select name="cadence" defaultValue="daily"><option value="manual">仅手动</option><option value="daily">每天</option><option value="weekly">每周</option></select></label>
                  <label className={[styles.field, styles.fieldWide].join(" ")}>公开目录网址<input name="sourceUrl" type="url" required maxLength={2048} placeholder="https://…" /></label>
                  <label className={styles.field}>每批最多候选<input name="maxCandidates" type="number" min="1" max="20" defaultValue="10" /></label>
                  <button className={styles.primaryButton} type="submit" disabled={!activeCampaignId || activeCampaign?.status !== "active" || pending}>{activeCampaign?.status !== "active" ? "先启用 Campaign" : "保存来源"}</button>
                </form>
                <div className={styles.discoveryBoundary}><b><IconShieldLock size={18} />采集边界</b><span>不采集个人姓名、个人邮箱或手机号</span><span>不猜邮箱，不生成或发送开发信</span><span>不自动批准，不写入生产 CRM</span></div>
              </section>
              <section className={styles.toolSection}>
                <h2>来源控制</h2>
                <div className={styles.discoverySourceList}>
                  {campaignDiscoverySources.map((source) => (
                    <article key={source.id}>
                      <div className={styles.discoverySourceHead}><div><b>{source.name}</b><a href={source.sourceUrl} target="_blank" rel="noreferrer">{source.normalizedDomain}<IconExternalLink size={14} /></a></div><span className={source.enabled && source.status === "active" ? styles.sourceActive : styles.sourcePaused}>{source.enabled && source.status === "active" ? `${source.tier}级 · 已启用` : "已暂停"}</span></div>
                      <dl className={styles.discoveryMeta}><div><dt>类型 / 区域</dt><dd>{source.sourceType} · {source.region}</dd></div><div><dt>解析器</dt><dd>{source.parserKey} v{source.parserVersion}</dd></div><div><dt>发现 / 合格 / 重复</dt><dd>{source.lastDiscoveredCount} / {source.lastQualifiedCount} / {source.lastDuplicateCount}</dd></div><div><dt>失败次数</dt><dd>{source.failureCount}</dd></div><div><dt>robots / 访问</dt><dd>{source.robotsStatus} · {source.requiresLogin ? "需登录" : source.isPaid ? "付费" : "公开免费"}</dd></div><div><dt>下次到期</dt><dd>{source.status === "paused" ? "已暂停" : source.cadence === "manual" ? "仅手动" : formatDate(source.nextRunAt)}</dd></div></dl>
                      {source.lastError ? <p className={styles.runError}>{source.lastError}</p> : null}
                      <div className={styles.discoveryActions}><button className={styles.primaryButton} type="button" disabled={pending || !source.enabled || source.status !== "active" || source.requiresLogin || source.isPaid || activeCampaign?.status !== "active"} onClick={() => void runDiscovery(source.id)}><IconPlayerPlay size={17} />立即采集</button><button className={styles.secondaryButton} type="button" disabled={pending} onClick={() => void toggleDiscoverySource(source)}>{source.status === "active" ? <IconPlayerPause size={17} /> : <IconPlayerPlay size={17} />}{source.status === "active" ? "暂停" : "恢复"}</button></div>
                    </article>
                  ))}
                  {!campaignDiscoverySources.length ? <div className={styles.emptyCompact}><IconRadar size={28} /><b>尚未添加来源</b><span>先启用 Campaign，再添加公开行业目录。</span></div> : null}
                </div>
              </section>
            </div>
          </details>

          <details className={styles.advancedSection}>
            <summary><span><IconClipboard size={20} />人工调研任务书</span><small>来源扩充或外部研究时使用</small></summary>
            {activeCampaign ? <div className={styles.researchLayout}><section className={styles.toolSection}><div className={styles.sectionTitleRow}><h2>本地语言检索词</h2><button className={styles.secondaryButton} type="button" onClick={() => downloadText(activeCampaign.name + "-research-brief.md", activeCampaign.researchBrief)}><IconDownload size={18} />下载任务书</button></div><div className={styles.keywordList}>{activeCampaign.searchKeywords.map((item) => <article key={item.locale + "-" + item.keyword}><span>{item.locale}</span><div><b>{item.keyword}</b><small>{item.purpose}</small></div></article>)}</div></section><section className={styles.toolSection}><h2><IconFileDescription size={20} />任务书预览</h2><pre className={styles.briefPreview}>{activeCampaign.researchBrief}</pre></section></div> : <div className={styles.emptyState}><b>请先创建 Campaign</b><button type="button" onClick={() => setActiveView("campaign")}>前往 Campaign</button></div>}
          </details>

          <details className={styles.advancedSection}>
            <summary><span><IconUpload size={20} />已审核数据导入与审计</span><small>恢复、补录和外部研究导入</small></summary>
            <div className={styles.toolGrid}>
              <section className={styles.toolSection}><h2>导入到所选 Campaign</h2><p className={styles.muted}>{campaignLabel}</p><div className={styles.templateLinks}><a href="/qixin-lead-engine-template.csv" download>下载 CSV 模板</a><a href="/qixin-lead-engine-template.json" download>下载 JSON 模板</a></div><form className={styles.importForm} onSubmit={importFile}><label className={styles.fileField}>选择已审核文件<input name="file" type="file" accept=".csv,.json,text/csv,application/json" required disabled={!activeCampaignId || activeCampaign?.status !== "active" || pending} /></label><button className={styles.primaryButton} type="submit" disabled={!activeCampaignId || activeCampaign?.status !== "active" || pending}>{pending ? "正在处理…" : activeCampaign?.status !== "active" ? "先把 Campaign 设为运行中" : "导入所选 Campaign"}</button></form>{importReport ? <div className={styles.importReport}><b>写入 {importReport.imported} 条，跳过 {importReport.skipped} 条</b>{importReport.results?.filter((item) => item.status !== "imported").slice(0, 5).map((item) => <span key={String(item.row)}>第 {String(item.row)} 行：{String(item.error || item.status)}</span>)}</div> : null}</section>
              <section className={styles.toolSection}><h2>导入审计</h2><div className={styles.auditList}>{workspace.imports.filter((run) => run.campaignId === activeCampaignId).slice(0, 8).map((run) => <article key={run.id}><div><b>{run.originalFilename || "结构化导入"}</b><span>{formatDate(run.createdAt)}</span></div><strong>{run.importedCount}/{run.rowCount} 写入</strong></article>)}{!workspace.imports.some((run) => run.campaignId === activeCampaignId) ? <p className={styles.muted}>尚无导入记录。</p> : null}</div><div className={styles.guardrails}><b><IconShieldLock size={18} />明确禁止</b><span>无授权搜索或额度消耗</span><span>邮箱猜测与自动补全</span><span>自动生成或发送开发信</span><span>直接写生产 CRM</span></div></section>
            </div>
          </details>
        </section>
      ) : null}

      {activeView === "export" ? (
        <section className={styles.toolWorkspace} aria-label={VIEW_LABELS.export}>
          <div className={styles.toolHeader}><div><span className={styles.sectionKicker}>CONTROLLED CRM HANDOFF</span><h1>CRM 导出</h1><p>只有人工批准并通过准入门槛的公司才能生成兼容文件。</p></div><IconFileExport size={34} /></div>
          <label className={styles.contextPicker}>导出 Campaign
            <select value={exportCampaignId} onChange={(event) => setExportCampaignId(event.target.value)}>
              <option value="">请选择 Campaign</option>
              {businessCampaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}
            </select>
          </label>
          <section className={styles.exportPanel}>
            <div className={styles.exportCount}><span>当前可导出</span><b>{exportApprovedCount}</b><small>家已批准客户</small></div>
            <div className={styles.exportCopy}><h2>{exportApprovedCount ? "导出已批准客户" : "暂无可导出客户"}</h2><p>导出只生成 CRM 兼容 CSV 并记录批次，不会调用或写入生产 CRM。下载后仍需人工确认导入。</p><button className={styles.primaryButton} type="button" disabled={!exportApprovedCount || pending} onClick={() => void exportApproved()}><IconDownload size={18} />导出 {exportApprovedCount} 家已批准客户</button></div>
          </section>
          <section className={styles.toolSection}>
            <h2>导出审计</h2>
            <div className={styles.auditList}>{workspace.exports.filter((run) => run.campaignId === exportCampaignId).map((run) => <article key={run.id}><div><b>CRM 兼容 CSV</b><span>{formatDate(run.createdAt)}</span></div><strong>{run.rowCount} 家</strong></article>)}{!workspace.exports.some((run) => run.campaignId === exportCampaignId) ? <p className={styles.muted}>尚无导出记录。</p> : null}</div>
          </section>
        </section>
      ) : null}

      {activeView === "review" && drawerOpen ? (
        <aside className={styles.drawer} aria-label="当前客户证据与审核">
          {detailLoading ? <div className={styles.emptyState}><IconClock size={26} /><b>正在加载客户证据…</b></div> : selectedLead && selectedCompany ? (
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
                  {leadDetail?.contactCount ? <p className={styles.muted}>已保存 {leadDetail.contactCount} 条候选联系人记录；本页默认不展示个人联系方式。</p> : null}
                </details>

                <details className={styles.drawerDetails} open={selectedContactVerifications.length > 0}>
                  <summary>商务联系方式核验 <span>{selectedContactVerifications.length} 条</span></summary>
                  <div className={styles.sourceList}>{selectedContactVerifications.map((contact) => <a key={contact.id} href={contact.sourceUrl} target="_blank" rel="noreferrer"><div><b>{contact.contactType} · {contact.status === "valid" ? "有效" : "未通过"}</b><IconExternalLink size={16} /></div><p>{contact.contactValue || "未保存具体值"}</p><small>{contact.sameCompanyDomain ? "企业同域" : "可信官方来源"} · 核验于 {formatDate(contact.verifiedAt)}</small></a>)}{!selectedContactVerifications.length ? <p className={styles.muted}>没有公开商务联系方式核验记录，不能计入每日目标。</p> : null}</div>
                </details>

                {selectedReviews.length ? <details className={styles.drawerDetails}><summary>审核历史 <span>{selectedReviews.length} 条</span></summary><div className={styles.auditList}>{selectedReviews.map((reviewItem) => <article key={reviewItem.id}><div><b>{STATUS_LABELS[reviewItem.decision] || reviewItem.decision}</b><span>{formatDate(reviewItem.createdAt)}</span></div><p>{reviewItem.notes || "未附备注"}</p></article>)}</div></details> : null}
              </div>

              <div className={styles.reviewDock}>
                {selectedLead.campaignId === "system:unassigned" ? <div className={styles.assignmentBox}>
                  <label>先分配到 Campaign
                    <select value={assignmentCampaignId} onChange={(event) => setAssignmentCampaignId(event.target.value)}>
                      <option value="">请选择目标 Campaign</option>
                      {businessCampaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}
                    </select>
                  </label>
                  <button type="button" className={styles.primaryButton} disabled={pending || !assignmentCampaignId} onClick={() => void assignSelectedLead()}>确认分配</button>
                </div> : null}
                <label>审核备注<input value={reviewNotes} onChange={(event) => setReviewNotes(event.target.value)} placeholder="淘汰时必须填写原因" /></label>
                {approvalGaps.length ? <div className={styles.gapSummary}><IconAlertTriangle size={17} /><span>{approvalGaps.slice(0, 3).join(" · ")}</span></div> : <div className={styles.readySummary}><IconCheck size={17} /><span>已满足批准闸门，仍需你做最终判断。</span></div>}
                <button type="button" className={styles.approveButton} onClick={() => review("approved")} disabled={pending || approvalGaps.length > 0}>
                  {approvalGaps.length ? "证据不足，暂不能批准" : "批准进入导出池"}
                </button>
                <button type="button" className={styles.rejectButton} onClick={() => review("rejected")} disabled={pending}><IconTrash size={18} />淘汰</button>
                <button type="button" className={styles.keepButton} onClick={() => review("needs_review")} disabled={pending}><IconClock size={17} />保留待审核</button>
                <details className={styles.reviewMaintenance}><summary>高级维护</summary><button type="button" className={styles.keepButton} onClick={() => void reverifySelectedLead()} disabled={pending || !selectedCompany.website}><IconRadar size={17} />重新核验官网与联系方式</button></details>
              </div>
            </>
          ) : <div className={styles.emptyState}><b>选择一家公司查看证据</b></div>}
        </aside>
      ) : null}
    </main>
  );
}
