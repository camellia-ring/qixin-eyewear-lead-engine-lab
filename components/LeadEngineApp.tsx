"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  reviewedAt?: string; exportedAt?: string; createdAt: string;
};
type Company = {
  id: string; companyName: string; country?: string; city?: string; companyType?: string; businessModel?: string;
  website?: string; primaryDomain?: string; productsJson: string; brandsJson: string; wholesaleSignal?: string;
  privateLabelSignal?: string; oemSignal?: string; pricePosition?: string; companySize?: string;
  analysisSummary?: string; analysisConfidence: string; businessEmail?: string; contactChannel?: string;
  estimatedPurchaseVolume?: string; doNotContact: boolean; lastAnalyzedAt?: string;
};
type Contact = { id: string; companyId: string; fullName: string; jobTitle?: string; email?: string; whatsapp?: string; verificationStatus: string; sourceUrl?: string; isPrimary: boolean };
type Source = { id: string; companyId: string; leadId?: string; sourceUrl: string; sourceType: string; pageTitle?: string; retrievedAt: string; evidenceSummary?: string; confidence: string };
type Claim = { id: string; sourceId: string; companyId: string; leadId?: string; claimType: string; claimSummary: string; evidenceKind: string; confidence: string };
type ScoreRun = { id: string; leadId: string; rubricVersion: string; totalScore: number; grade: string; evidenceCoverage: number; overallConfidence: string; modelIdentifier: string; createdAt: string };
type ScoreDimension = { id: string; scoreRunId: string; dimension: string; score: number; maxScore: number; positiveReason?: string; negativeReason?: string; evidenceIdsJson: string };
type Review = { id: string; leadId: string; decision: string; notes?: string; decidedBy: string; createdAt: string };
type ImportRun = { id: string; campaignId: string; originalFilename?: string; rowCount: number; importedCount: number; skippedCount: number; status: string; createdAt: string };
type ExportRun = { id: string; campaignId: string; rowCount: number; createdAt: string };
type Workspace = {
  campaigns: Campaign[]; leads: Lead[]; companies: Company[]; contacts: Contact[]; sources: Source[]; claims: Claim[];
  scoreRuns: ScoreRun[]; scoreDimensions: ScoreDimension[]; reviews: Review[]; imports: ImportRun[]; exports: ExportRun[];
  domains: Array<{ id: string; normalizedDomain: string }>; domainLinks: Array<{ id: string; companyId: string; domainId: string; relationshipType: string }>;
};

const EMPTY_WORKSPACE: Workspace = { campaigns: [], leads: [], companies: [], contacts: [], sources: [], claims: [], scoreRuns: [], scoreDimensions: [], reviews: [], imports: [], exports: [], domains: [], domainLinks: [] };
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
  all: "全部机会", discovered: "新发现", analyzed: "已分析", qualified: "AI 合格", needs_review: "待人工审核", approved: "已批准", rejected: "已淘汰",
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

export default function LeadEngineApp() {
  const [workspace, setWorkspace] = useState<Workspace>(EMPTY_WORKSPACE);
  const [activeCampaignId, setActiveCampaignId] = useState("");
  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [countryFilter, setCountryFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
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

  const companyById = useMemo(() => new Map(workspace.companies.map((company) => [company.id, company])), [workspace.companies]);
  const activeCampaign = workspace.campaigns.find((campaign) => campaign.id === activeCampaignId) || null;
  const campaignLeads = useMemo(() => workspace.leads.filter((lead) => lead.campaignId === activeCampaignId), [workspace.leads, activeCampaignId]);
  const countries = useMemo(() => [...new Set(campaignLeads.map((lead) => companyById.get(lead.companyId)?.country).filter(Boolean) as string[])].sort(), [campaignLeads, companyById]);
  const companyTypes = useMemo(() => [...new Set(campaignLeads.map((lead) => companyById.get(lead.companyId)?.companyType).filter(Boolean) as string[])].sort(), [campaignLeads, companyById]);
  const filteredLeads = useMemo(() => campaignLeads.filter((lead) => {
    const company = companyById.get(lead.companyId);
    const term = search.trim().toLocaleLowerCase();
    return (statusFilter === "all" || lead.workflowStatus === statusFilter)
      && (gradeFilter === "all" || lead.grade === gradeFilter)
      && (countryFilter === "all" || company?.country === countryFilter)
      && (typeFilter === "all" || company?.companyType === typeFilter)
      && (!term || [company?.companyName, company?.country, company?.website, company?.companyType].some((value) => String(value || "").toLocaleLowerCase().includes(term)));
  }), [campaignLeads, companyById, countryFilter, gradeFilter, search, statusFilter, typeFilter]);
  const selectedLead = filteredLeads.find((lead) => lead.id === selectedLeadId) || filteredLeads[0] || null;
  const selectedCompany = selectedLead ? companyById.get(selectedLead.companyId) || null : null;
  const selectedContacts = selectedCompany ? workspace.contacts.filter((contact) => contact.companyId === selectedCompany.id) : [];
  const selectedSources = selectedLead ? workspace.sources.filter((source) => source.leadId === selectedLead.id) : [];
  const selectedClaims = selectedLead ? workspace.claims.filter((claim) => claim.leadId === selectedLead.id) : [];
  const selectedScoreRun = selectedLead ? workspace.scoreRuns.find((run) => run.leadId === selectedLead.id) || null : null;
  const selectedDimensions = selectedScoreRun ? workspace.scoreDimensions.filter((item) => item.scoreRunId === selectedScoreRun.id) : [];
  const selectedReviews = selectedLead ? workspace.reviews.filter((review) => review.leadId === selectedLead.id) : [];
  const selectedDomains = selectedCompany ? workspace.domainLinks.filter((link) => link.companyId === selectedCompany.id).map((link) => workspace.domains.find((domain) => domain.id === link.domainId)?.normalizedDomain).filter(Boolean) : [];
  const counts = Object.fromEntries(STATUS_FILTERS.map((status) => [status, status === "all" ? campaignLeads.length : campaignLeads.filter((lead) => lead.workflowStatus === status).length]));
  const gradeCounts = Object.fromEntries(["S", "A", "B", "C", "Reject"].map((grade) => [grade, campaignLeads.filter((lead) => lead.grade === grade).length]));
  const approvedCount = Number(counts.approved || 0);
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

  return (
    <main className={styles.app}>
      <header className={styles.hero}>
        <div className={styles.brand}><span>Q</span><div><b>QIXIN</b><small>LEAD ENGINE LAB</small></div></div>
        <div className={styles.heroCopy}><span className={styles.eyebrow}>独立实验环境 · 证据链 · 人工闸门</span><h1>把“找到公司”变成<br />可审计的销售机会。</h1><p>Company 与 Campaign Lead 分离，来源、判断、评分版本和人工决定全程留痕。只有已批准机会才能导出为现有 CRM 接受的 CSV。</p></div>
        <div className={styles.isolation}><span>隔离状态</span><b>生产系统未连接</b><p>独立代码 · 独立 D1 · 无发送能力</p></div>
      </header>

      <section className={styles.controlStrip}>
        <label>当前 Campaign<select value={activeCampaignId} onChange={(event) => { setActiveCampaignId(event.target.value); setSelectedLeadId(""); }}><option value="">尚未创建 Campaign</option>{workspace.campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}</select></label>
        {activeCampaign ? <div className={styles.campaignMeta}><span>{PRODUCT_LABELS[activeCampaign.productTrack]}</span><span>{activeCampaign.targetMarkets || jsonList(activeCampaign.targetCountriesJson).join(" / ") || "市场待定义"}</span><span>目标 {activeCampaign.targetCount} 家</span><span>{activeCampaign.status}</span><select aria-label="Campaign 状态" value={activeCampaign.status} disabled={pending} onChange={(event) => void changeCampaignStatus(event.target.value)}><option value="draft">草稿</option><option value="active">运行中</option><option value="paused">暂停</option><option value="completed">已完成</option></select></div> : null}
        <details className={styles.createCampaign} open={!workspace.campaigns.length}><summary>新建完整 Campaign</summary><form onSubmit={createCampaign}>
          <input name="name" required maxLength={160} placeholder="Campaign 名称" />
          <select name="productTrack" defaultValue="optical_frames">{PRODUCT_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          <input name="targetCountries" placeholder="国家：Germany, UK" />
          <input name="targetMarkets" placeholder="市场说明" />
          <input name="productTypes" placeholder="产品类型，以分号分隔" />
          <input name="customerTypes" defaultValue="Importer; Distributor; Wholesaler; Eyewear Brand; Private Label Brand" placeholder="客户类型" />
          <input name="targetCount" type="number" min="1" max="500" defaultValue="30" aria-label="目标公司数量" />
          <input name="moqFit" placeholder="MOQ 适配" />
          <input name="companySize" placeholder="客户规模" />
          <input name="positioning" placeholder="产品定位" />
          <input name="exclusions" placeholder="排除类型，以分号分隔" />
          <button type="submit" disabled={pending}>创建 Campaign 草稿</button>
        </form></details>
      </section>

      {error ? <div className={styles.error} role="alert">{error}</div> : null}
      {notice ? <div className={styles.notice} role="status">{notice}</div> : null}

      <section className={styles.metrics} aria-busy={loading}>
        <article><span>Campaign</span><b>{workspace.campaigns.length}</b><p>独立任务与产品赛道</p></article>
        <article><span>当前机会</span><b>{campaignLeads.length}</b><p>{activeCampaign ? `目标进度 ${campaignLeads.length}/${activeCampaign.targetCount}` : "先创建任务"}</p></article>
        <article><span>合格机会</span><b>{Number(counts.qualified || 0) + approvedCount}</b><p>S {gradeCounts.S || 0} · A {gradeCounts.A || 0} · B {gradeCounts.B || 0}</p></article>
        <article><span>待人工审核</span><b>{counts.needs_review || 0}</b><p>强制准入、证据与评分仍需人判断</p></article>
        <article className={styles.metricAccent}><span>已批准可导出</span><b>{approvedCount}</b><p>唯一允许离开实验环境的集合</p></article>
      </section>

      {activeCampaign ? <section className={styles.researchStudio}>
        <div><span className={styles.eyebrow}>00 / CAMPAIGN RESEARCH PLAN</span><h2>本地语言检索词与 Codex 标准任务书</h2><p>只生成研究计划，不会自动搜索、抓取、消耗 Apollo 额度或访问个人联系方式。</p><button type="button" onClick={() => downloadText(`${activeCampaign.name}-research-brief.md`, activeCampaign.researchBrief)}>下载研究任务书</button><details className={styles.campaignEdit} key={activeCampaign.id}><summary>编辑 Campaign 条件</summary><form onSubmit={updateCampaign}><input name="name" required defaultValue={activeCampaign.name} /><select name="productTrack" defaultValue={activeCampaign.productTrack}>{PRODUCT_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><input name="targetCountries" defaultValue={jsonList(activeCampaign.targetCountriesJson).join("; ")} placeholder="目标国家" /><input name="targetMarkets" defaultValue={activeCampaign.targetMarkets} placeholder="市场说明" /><input name="productTypes" defaultValue={jsonList(activeCampaign.productTypesJson).join("; ")} placeholder="产品类型" /><input name="customerTypes" defaultValue={jsonList(activeCampaign.customerTypesJson).join("; ")} placeholder="客户类型" /><input name="targetCount" type="number" min="1" max="500" defaultValue={activeCampaign.targetCount} /><input name="moqFit" defaultValue={activeCampaign.moqFit || ""} placeholder="MOQ 适配" /><input name="companySize" defaultValue={activeCampaign.companySize || ""} placeholder="客户规模" /><input name="positioning" defaultValue={activeCampaign.positioning || ""} placeholder="产品定位" /><input name="exclusions" defaultValue={jsonList(activeCampaign.exclusionsJson).join("; ")} placeholder="排除类型" /><button type="submit" disabled={pending}>保存并刷新研究计划</button></form></details></div>
        <ul>{activeCampaign.searchKeywords.slice(0, 10).map((item) => <li key={`${item.locale}-${item.keyword}`}><span>{item.locale}</span><b>{item.keyword}</b><small>{item.purpose}</small></li>)}</ul>
      </section> : null}

      <section className={styles.workflow}>
        <aside className={styles.importPanel}>
          <span className={styles.eyebrow}>01 / STRUCTURED INTAKE</span><h2>导入可追溯的研究结果</h2><p>支持 CSV 与 JSON；文件哈希作为幂等键，同一批次不会重复写入。每个评分维度必须带理由，来源必须带核验时间和可信度。</p>
          <div className={styles.templateLinks}><a href="/qixin-lead-engine-template.csv" download>CSV 模板</a><a href="/qixin-lead-engine-template.json" download>JSON 模板</a></div>
          <form className={styles.importForm} onSubmit={importFile}><input name="file" type="file" accept=".csv,.json,text/csv,application/json" required disabled={!activeCampaignId || activeCampaign?.status !== "active" || pending} /><button type="submit" disabled={!activeCampaignId || activeCampaign?.status !== "active" || pending}>{pending ? "正在处理…" : activeCampaign?.status !== "active" ? "先把 Campaign 设为运行中" : "导入当前 Campaign"}</button></form>
          {importReport ? <div className={styles.report}>写入 {importReport.imported} 条，跳过 {importReport.skipped} 条。{importReport.results?.filter((item) => item.status !== "imported").slice(0, 3).map((item) => <span key={String(item.row)}>第 {String(item.row)} 行：{String(item.error || item.status)}</span>)}</div> : null}
          <div className={styles.auditSummary}><b>最近批次</b>{workspace.imports.filter((run) => run.campaignId === activeCampaignId).slice(0, 3).map((run) => <span key={run.id}>{formatDate(run.createdAt)} · {run.importedCount}/{run.rowCount} 写入</span>)}{!workspace.imports.some((run) => run.campaignId === activeCampaignId) ? <span>尚无导入记录</span> : null}</div>
          <div className={styles.guardrails}><b>明确禁止</b><span>无授权搜索或额度消耗</span><span>邮箱猜测与自动补全</span><span>自动生成或发送开发信</span><span>直接写生产 CRM</span></div>
        </aside>

        <div className={styles.pipeline}>
          <div className={styles.pipelineHeader}><div><span className={styles.eyebrow}>02 / LEAD PIPELINE</span><h2>Company × Campaign Lead</h2></div><label>搜索<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="公司、国家、类型或网站" /></label></div>
          <div className={styles.filterSelects}><select value={countryFilter} onChange={(event) => setCountryFilter(event.target.value)} aria-label="国家筛选"><option value="all">全部国家</option>{countries.map((country) => <option key={country}>{country}</option>)}</select><select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} aria-label="客户类型筛选"><option value="all">全部客户类型</option>{companyTypes.map((type) => <option key={type}>{type}</option>)}</select><select value={gradeFilter} onChange={(event) => setGradeFilter(event.target.value)} aria-label="等级筛选"><option value="all">全部等级</option>{["S", "A", "B", "C", "Reject"].map((grade) => <option key={grade}>{grade}</option>)}</select></div>
          <div className={styles.filters} role="tablist" aria-label="工作流状态筛选">{STATUS_FILTERS.map((status) => <button key={status} type="button" role="tab" aria-selected={statusFilter === status} className={statusFilter === status ? styles.filterActive : ""} onClick={() => setStatusFilter(status)}><span>{STATUS_LABELS[status]}</span><b>{counts[status] || 0}</b></button>)}</div>
          {loading ? <div className={styles.empty}>正在读取独立实验数据库…</div> : null}
          {!loading && !activeCampaign ? <div className={styles.empty}><b>先创建第一个 Campaign</b><p>建议从一个产品赛道、20–30 家候选公司开始。</p></div> : null}
          {!loading && activeCampaign && !filteredLeads.length ? <div className={styles.empty}><b>当前筛选没有 Lead</b><p>下载研究任务书与模板，完成小批量研究后导入。</p></div> : null}
          {filteredLeads.length ? <ul className={styles.companyList}>{filteredLeads.map((lead) => { const company = companyById.get(lead.companyId); return <li key={lead.id}><button type="button" className={`${styles.companyCard} ${selectedLead?.id === lead.id ? styles.companyActive : ""}`} onClick={() => setSelectedLeadId(lead.id)} aria-pressed={selectedLead?.id === lead.id}><span className={`${styles.grade} ${styles[`grade${lead.grade}`] || ""}`}>{lead.grade}</span><span className={styles.companyCopy}><strong>{company?.companyName || "公司资料缺失"}</strong><span>{[company?.country, company?.companyType].filter(Boolean).join(" · ") || "市场与类型待补充"}</span><small>{STATUS_LABELS[lead.workflowStatus] || lead.workflowStatus} · 证据 {lead.evidenceCoverage}% · {lead.scoreConfidence}</small></span><span className={styles.totalScore}><b>{lead.currentScore}</b><small>/ 100</small></span></button></li>; })}</ul> : null}
        </div>

        <aside className={styles.detailPanel}>
          {selectedLead && selectedCompany ? <>
            <div className={styles.detailHeader}><div><span className={styles.eyebrow}>03 / EVIDENCE & HUMAN GATE</span><h2>{selectedCompany.companyName}</h2></div><span className={`${styles.gradeLarge} ${styles[`grade${selectedLead.grade}`] || ""}`}>{selectedLead.grade}</span></div>
            <div className={styles.detailMeta}><span>{STATUS_LABELS[selectedLead.workflowStatus] || selectedLead.workflowStatus}</span><span>Hard Gate: {selectedLead.hardGateStatus}</span><span>证据 {selectedLead.evidenceCoverage}%</span><span>可信度 {selectedLead.scoreConfidence}</span></div>
            {selectedLead.hardGateStatus === "fail" ? <div className={styles.disqualified}><b>强制淘汰</b><p>{selectedLead.hardGateReason || "未记录原因"}</p></div> : null}
            <section className={styles.scoreSection}><div className={styles.scoreHeading}><h3>评分版本 {selectedScoreRun?.rubricVersion || "未记录"}</h3><b>{selectedLead.currentScore} / 100</b></div><div className={styles.scoreGrid}>{Object.entries(SCORE_LIMITS).map(([field, max]) => { const dimension = selectedDimensions.find((item) => item.dimension === field); return <div key={field}><span>{SCORE_LABELS[field]}</span><div><i style={{ width: `${((dimension?.score || 0) / max) * 100}%` }} /></div><b>{dimension?.score || 0} / {max}</b></div>; })}</div><div className={styles.scoreReasons}>{selectedDimensions.map((item) => <article key={item.id}><b>{SCORE_LABELS[item.dimension] || item.dimension}</b>{item.positiveReason ? <p><span>＋</span>{item.positiveReason}</p> : null}{item.negativeReason ? <p><span>−</span>{item.negativeReason}</p> : null}</article>)}</div></section>
            <dl className={styles.facts}><div><dt>公司网站</dt><dd>{selectedCompany.website ? <a href={selectedCompany.website} target="_blank" rel="noreferrer">{selectedCompany.website}</a> : "未记录"}</dd></div><div><dt>域名身份</dt><dd>{selectedDomains.join(" · ") || "未记录"}</dd></div><div><dt>国家 / 城市</dt><dd>{[selectedCompany.country, selectedCompany.city].filter(Boolean).join(" · ") || "未记录"}</dd></div><div><dt>客户类型 / 模式</dt><dd>{[selectedCompany.companyType, selectedCompany.businessModel].filter(Boolean).join(" · ") || "未记录"}</dd></div><div><dt>公司产品 / 品牌</dt><dd>{[...jsonList(selectedCompany.productsJson), ...jsonList(selectedCompany.brandsJson)].join(" · ") || "未记录"}</dd></div><div><dt>推荐产品</dt><dd>{jsonList(selectedLead.recommendedProductsJson).join(" · ") || "未记录"}</dd></div><div><dt>规模 / 价格定位</dt><dd>{[selectedCompany.companySize, selectedCompany.pricePosition].filter(Boolean).join(" · ") || "未记录"}</dd></div><div><dt>预计采购量</dt><dd>{selectedCompany.estimatedPurchaseVolume || "未记录"}</dd></div><div><dt>商务联系渠道</dt><dd>{selectedCompany.businessEmail || selectedCompany.contactChannel || "未记录"}</dd></div><div><dt>最近分析</dt><dd>{formatDate(selectedCompany.lastAnalyzedAt)}</dd></div></dl>
            {selectedCompany.analysisSummary || selectedLead.riskSummary ? <section className={styles.summaryBlock}><h3>公司分析与风险</h3>{selectedCompany.analysisSummary ? <p>{selectedCompany.analysisSummary}</p> : null}{selectedLead.riskSummary ? <p><b>风险：</b>{selectedLead.riskSummary}</p> : null}</section> : null}
            <section className={styles.signalGrid}><article><span>批发信号</span><p>{selectedCompany.wholesaleSignal || "未知"}</p></article><article><span>Private Label</span><p>{selectedCompany.privateLabelSignal || "未知"}</p></article><article><span>OEM 信号</span><p>{selectedCompany.oemSignal || "未知"}</p></article></section>
            <section className={styles.evidence}><h3>来源与证据主张</h3>{selectedSources.map((source) => <a key={source.id} href={source.sourceUrl} target="_blank" rel="noreferrer"><span>{source.pageTitle || source.sourceType}</span><b>{source.confidence} · 打开来源 ↗</b><p>{source.evidenceSummary || "无来源摘要"}</p><small>核验于 {formatDate(source.retrievedAt)}</small></a>)}{!selectedSources.length ? <p>没有来源，不能批准。</p> : null}{selectedClaims.map((claim) => <article className={styles.claim} key={claim.id}><span>{claim.evidenceKind}</span><b>{claim.claimType}</b><p>{claim.claimSummary}</p><small>{claim.confidence}</small></article>)}</section>
            <section className={styles.contacts}><h3>候选联系人</h3>{selectedContacts.map((contact) => <article key={contact.id}><b>{contact.fullName}</b><span>{contact.jobTitle || "职位未核验"}</span><p>{contact.email || "邮箱未记录"} · {contact.verificationStatus}{contact.sourceUrl ? <> · <a href={contact.sourceUrl} target="_blank" rel="noreferrer">来源 ↗</a></> : null}</p></article>)}{!selectedContacts.length ? <p>没有联系人；公司级商务渠道仍可供人工核验。</p> : null}</section>
            <section className={styles.reviewBox}><h3>人工审核决定</h3>{approvalGaps.length ? <div className={styles.approvalGaps}>{approvalGaps.map((gap) => <span key={gap}>{gap}</span>)}</div> : <p className={styles.ready}>资料满足批准闸门，仍需你做最终判断。</p>}<textarea value={reviewNotes} onChange={(event) => setReviewNotes(event.target.value)} rows={3} placeholder="补充判断依据；淘汰时必须填写原因" /><div className={styles.reviewActions}><button type="button" onClick={() => review("needs_review")} disabled={pending}>退回人工复核</button><button type="button" className={styles.approve} onClick={() => review("approved")} disabled={pending || approvalGaps.length > 0}>批准进入导出池</button><button type="button" className={styles.reject} onClick={() => review("rejected")} disabled={pending}>淘汰</button></div></section>
            {selectedReviews.length ? <section className={styles.auditTrail}><h3>审核审计</h3>{selectedReviews.map((review) => <article key={review.id}><b>{STATUS_LABELS[review.decision] || review.decision}</b><span>{formatDate(review.createdAt)}</span><p>{review.notes || "未附备注"}</p></article>)}</section> : null}
          </> : <div className={styles.empty}>选择一个 Campaign Lead 查看公司资料、证据、评分版本和审核历史。</div>}
        </aside>
      </section>

      <section className={styles.transfer}><div><span className={styles.eyebrow}>04 / CONTROLLED CRM HANDOFF</span><h2>批准后才能生成 CRM 文件。</h2><p>导出会记录批次与 Lead 清单，但不会调用生产 CRM。下载后仍需在现有 CRM 导入页再次确认；“已导出”不等于“已进入 CRM”。</p><small>当前 Campaign 已产生 {workspace.exports.filter((run) => run.campaignId === activeCampaignId).length} 个导出批次。</small></div><button className={`${styles.exportButton} ${approvedCount ? "" : styles.exportDisabled}`} type="button" disabled={!approvedCount || pending} onClick={() => void exportApproved()}>导出 {approvedCount} 家已批准客户 <span>→</span></button></section>
      <footer className={styles.footer}><span>QIXIN LEAD ENGINE LAB · PRIVATE EXPERIMENT</span><p>无自动搜索、无自动发送、无生产 CRM 写入；所有来源和人工决定均保留审计。</p></footer>
    </main>
  );
}
