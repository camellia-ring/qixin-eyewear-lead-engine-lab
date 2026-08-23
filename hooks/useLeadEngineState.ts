import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { SCORE_LIMITS } from "@/lib/lead-engine";
import { GLOBAL_DISCOVERY_CAMPAIGN_ID, isSystemCampaignId } from "@/lib/campaign-routing";
import { isCurrentServerVerification } from "@/lib/import-policy";
import { approvalPolicyGaps } from "@/lib/qualification";
import { businessRoleOptions, productDirectionOptions } from "@/lib/customer-scope";
import { useAutoDismiss } from "./useAutoDismiss";
import { useLeadReviewFilters } from "./useLeadReviewFilters";
import {
  api, EMPTY_LEAD_PAGE, EMPTY_WORKSPACE, formList, STATUS_LABELS,
  type Campaign, type DiscoverySource, type LeadDetail, type LeadPage, type ReclassificationDryRun, type ViewKey, type Workspace,
} from "@/components/lead-engine/model";

const HEADER_MAP: Record<string, string> = {
  company_name: "companyName", company_type: "companyType", customer_types: "customerTypes", business_model: "businessModel", product_track: "productTrack",
  product_directions: "productDirections",
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

function parseCsv(source: string) {
  const rows: string[][] = []; let row: string[] = []; let value = ""; let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) { if (char === '"' && source[index + 1] === '"') { value += '"'; index += 1; } else if (char === '"') quoted = false; else value += char; }
    else if (char === '"') quoted = true;
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
  return rows.slice(1).map((cells) => Object.fromEntries(headers.map((header, index) => { const field = HEADER_MAP[header] || header; const raw = cells[index]?.trim() || ""; return [field, numeric.has(field) ? Number(raw || 0) : raw]; })));
}

function recordsFromJson(source: string) {
  const parsed = JSON.parse(source) as unknown;
  const records = Array.isArray(parsed) ? parsed : (parsed && typeof parsed === "object" ? (parsed as { records?: unknown }).records : null);
  if (!Array.isArray(records) || !records.length) throw new Error("JSON 必须包含非空 records 数组");
  return records;
}

async function sha256(value: string) { const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)); return [...new Uint8Array(digest)].map((item) => item.toString(16).padStart(2, "0")).join(""); }

export function useLeadEngineState() {
  const [workspace, setWorkspace] = useState<Workspace>(EMPTY_WORKSPACE);
  const [activeCampaignId, setActiveCampaignId] = useState("");
  const [exportCampaignId, setExportCampaignId] = useState("");
  const [selectedLeadId, setSelectedLeadId] = useState("");
  const {
    statusFilter, gradeFilter, regionFilter, countryFilter, typeFilters, productFilters, contactFilter,
    sourceFilter, specialFilter, sortBy, page, search, setStatusFilter, setGradeFilter,
    setRegionFilter, setCountryFilter, setTypeFilters, setProductFilters, setContactFilter, setSourceFilter,
    setSpecialFilter, setSortBy, setPage, setSearch, clearFilters,
  } = useLeadReviewFilters();
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
  const [reclassificationDryRun, setReclassificationDryRun] = useState<ReclassificationDryRun | null>(null);

  const clearNotice = useCallback(() => setNotice(""), []);
  useAutoDismiss(notice, clearNotice);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); setError("");
    try {
      const data = await api<Workspace>("/api/workspace"); setWorkspace(data);
      const selectable = data.campaigns.filter((item) => !isSystemCampaignId(item.id));
      setActiveCampaignId((current) => selectable.some((item) => item.id === current) ? current : selectable[0]?.id || "");
      setExportCampaignId((current) => selectable.some((item) => item.id === current) ? current : selectable[0]?.id || "");
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "无法加载独立实验数据库"); }
    finally { if (!silent) setLoading(false); }
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);
  useEffect(() => { if (workspace.engineState?.status !== "running") return; const timer = window.setInterval(() => { void load(true); setLeadRefreshKey((value) => value + 1); }, 30_000); return () => window.clearInterval(timer); }, [load, workspace.engineState?.status]);
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLeadLoading(true); const parameters = new URLSearchParams({ page: String(page), pageSize: "25" });
      if (statusFilter !== "all") parameters.set("status", statusFilter);
      if (gradeFilter !== "all") parameters.set("grade", gradeFilter); if (countryFilter !== "all") parameters.set("country", countryFilter);
      if (regionFilter !== "all") parameters.set("region", regionFilter);
      for (const type of typeFilters) parameters.append("customerType", type);
      for (const product of productFilters) parameters.append("productDirection", product);
      if (contactFilter !== "all") parameters.set("contactStatus", contactFilter); if (sourceFilter !== "all") parameters.set("sourceType", sourceFilter);
      if (specialFilter === "duplicate") parameters.set("duplicate", "true"); if (specialFilter === "dnc") parameters.set("doNotContact", "true");
      if (search.trim()) parameters.set("q", search.trim());
      if (sortBy === "score_asc") { parameters.set("sort", "score"); parameters.set("order", "asc"); }
      else if (sortBy === "company_asc") { parameters.set("sort", "company"); parameters.set("order", "asc"); }
      else if (sortBy === "newest") { parameters.set("sort", "firstDiscovered"); parameters.set("order", "desc"); }
      else { parameters.set("sort", "score"); parameters.set("order", "desc"); }
      void api<LeadPage>(`/api/leads?${parameters.toString()}`, { signal: controller.signal }).then((data) => { setLeadPage(data); setSelectedLeadId((current) => data.rows.some((row) => row.leadId === current) ? current : data.rows[0]?.leadId || ""); if (!data.rows.length) setDrawerOpen(false); }).catch((requestError) => { if (!(requestError instanceof DOMException && requestError.name === "AbortError")) setError(requestError instanceof Error ? requestError.message : "客户列表加载失败"); }).finally(() => { if (!controller.signal.aborted) setLeadLoading(false); });
    }, 220);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [contactFilter, countryFilter, gradeFilter, leadRefreshKey, page, productFilters, regionFilter, search, sortBy, sourceFilter, specialFilter, statusFilter, typeFilters]);
  useEffect(() => {
    if (!drawerOpen || !selectedLeadId) return;
    const controller = new AbortController(); const timer = window.setTimeout(() => { setDetailLoading(true); void api<LeadDetail>(`/api/leads/${selectedLeadId}`, { signal: controller.signal }).then(setLeadDetail).catch((requestError) => { if (!(requestError instanceof DOMException && requestError.name === "AbortError")) setError(requestError instanceof Error ? requestError.message : "客户详情加载失败"); }).finally(() => { if (!controller.signal.aborted) setDetailLoading(false); }); }, 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [drawerOpen, leadRefreshKey, selectedLeadId]);

  const businessCampaigns = useMemo(() => workspace.campaigns.filter((campaign) => !isSystemCampaignId(campaign.id)), [workspace.campaigns]);
  const activeBusinessCampaigns = businessCampaigns.filter((campaign) => campaign.status === "active");
  const activeCampaign = businessCampaigns.find((campaign) => campaign.id === activeCampaignId) || null;
  const exportCampaign = businessCampaigns.find((campaign) => campaign.id === exportCampaignId) || null;
  const counts = leadPage.facets.statusCounts;
  const campaignDiscoverySources = workspace.discoverySources.filter((source) => source.campaignId === activeCampaignId || source.campaignId === GLOBAL_DISCOVERY_CAMPAIGN_ID);
  const globalDiscoverySources = workspace.discoverySources.filter((source) => source.campaignId === GLOBAL_DISCOVERY_CAMPAIGN_ID || businessCampaigns.some((campaign) => campaign.id === source.campaignId));
  const globalDiscoveryRuns = workspace.discoveryRuns.filter((run) => run.campaignId === GLOBAL_DISCOVERY_CAMPAIGN_ID || businessCampaigns.some((campaign) => campaign.id === run.campaignId));
  const discoverySourceById = new Map(workspace.discoverySources.map((source) => [source.id, source]));
  const campaignById = new Map(workspace.campaigns.map((campaign) => [campaign.id, campaign]));
  const globalSourceOverview = [...new Set(globalDiscoverySources.map((source) => source.sourceUrl))].map((sourceUrl) => {
    const rows = globalDiscoverySources.filter((source) => source.sourceUrl === sourceUrl);
    const representative = rows.find((source) => source.enabled && source.status === "active") || rows[0];
    const isGlobalPool = rows.some((source) => source.campaignId === GLOBAL_DISCOVERY_CAMPAIGN_ID);
    return {
      ...representative,
      scopeLabel: isGlobalPool ? `${activeBusinessCampaigns.length} 个运行中 Campaign 共用` : "Campaign 专用来源",
    };
  });
  const selectedLead = leadDetail?.lead || null; const selectedCompany = leadDetail?.company || null;
  const approvalGaps = selectedLead && selectedCompany ? approvalPolicyGaps({
    campaignAssigned: selectedLead.campaignId !== "system:unassigned",
    hardGateStatus: selectedLead.hardGateStatus,
    score: selectedLead.currentScore,
    evidenceCoverage: selectedLead.evidenceCoverage,
    scoreConfidence: selectedLead.scoreConfidence,
    doNotContact: selectedCompany.doNotContact,
    sourceCount: leadDetail?.sources.length || 0,
    contactPresent: Boolean(selectedCompany.businessEmail || selectedCompany.contactChannel || leadDetail?.contactCount),
    scoreDimensionCount: leadDetail?.scoreDimensions.length || 0,
    expectedScoreDimensionCount: Object.keys(SCORE_LIMITS).length,
    serverVerified: isCurrentServerVerification(leadDetail?.scoreRun),
  }) : [];
  const campaignLeadCount = Number(workspace.leadCounts[activeCampaignId]?.all || 0);
  const campaignLabel = activeCampaign ? `${activeCampaign.name} · ${campaignLeadCount} 家` : "尚未选择 Campaign";
  const exportApprovedCount = Number(workspace.leadCounts[exportCampaignId]?.approved || 0);
  const totalApprovedCount = businessCampaigns.reduce((sum, campaign) => sum + Number(workspace.leadCounts[campaign.id]?.approved || 0), 0);
  const todayTarget = workspace.dailyTargets[0] || null; const engine = workspace.engineState;
  const todayRemaining = Math.max(0, (todayTarget?.targetCount || engine?.dailyTarget || 20) - (todayTarget?.qualifiedCount || 0));

  function beginAction() { setPending(true); setError(""); setNotice(""); }
  function actionError(requestError: unknown, fallback: string) { setError(requestError instanceof Error ? requestError.message : fallback); }
  function refreshLeads() { setLeadRefreshKey((value) => value + 1); }
  function openLead(leadId: string) { setSelectedLeadId(leadId); setLeadDetail(null); setDetailLoading(true); setDrawerOpen(true); }

  async function createCampaign(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); beginAction(); try { const result = await api<{ campaign: Campaign }>("/api/campaigns", { method: "POST", body: JSON.stringify({ regionKey: data.get("regionKey"), productTracks: formList(data, "productTracks"), targetCountries: formList(data, "targetCountries"), customerTypes: formList(data, "customerTypes"), strategyPriority: Number(data.get("strategyPriority") || 50), status: "draft" }) }); form.reset(); await load(); setActiveCampaignId(result.campaign.id); setNotice("区域 Campaign 草稿已创建；启用后 AI 会按地区分配来源，并把匹配客户自动归入该策略。"); } catch (error) { actionError(error, "创建失败"); } finally { setPending(false); } }
  async function changeCampaignStatus(status: string) { if (!activeCampaign) return; beginAction(); try { await api("/api/campaigns", { method: "PATCH", body: JSON.stringify({ id: activeCampaign.id, status }) }); await load(); setNotice(`Campaign 状态已更新为：${status}。`); } catch (error) { actionError(error, "状态更新失败"); } finally { setPending(false); } }
  async function updateCampaign(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!activeCampaign) return; const data = new FormData(event.currentTarget); beginAction(); try { const result = await api<{ campaign: Campaign; matchRefresh: { companies: number; added: number; stale: number } | null }>("/api/campaigns", { method: "PATCH", body: JSON.stringify({ id: activeCampaign.id, regionKey: data.get("regionKey"), productTracks: formList(data, "productTracks"), targetCountries: formList(data, "targetCountries"), customerTypes: formList(data, "customerTypes"), strategyPriority: Number(data.get("strategyPriority") || 50) }) }); void load(true); if (result.matchRefresh) refreshLeads(); setNotice(result.matchRefresh ? "Campaign 策略已更新；现有客户已按证据重新匹配，历史归属仍保留。" : "Campaign 已保存；策略条件未变化，无需重新匹配客户。"); } catch (error) { actionError(error, "Campaign 更新失败"); } finally { setPending(false); } }
  async function review(decision: string) { if (!selectedLead) return; if (decision === "rejected" && !reviewNotes.trim()) { setError("淘汰 Lead 前必须填写原因。"); return; } beginAction(); try { await api("/api/reviews", { method: "POST", body: JSON.stringify({ leadId: selectedLead.id, decision, notes: reviewNotes }) }); setReviewNotes(""); setDrawerOpen(false); await load(); refreshLeads(); setNotice(`审核决定已保存：${STATUS_LABELS[decision]}。没有写入生产 CRM。`); } catch (error) { actionError(error, "审核未完成"); } finally { setPending(false); } }
  async function exportApproved() { if (!exportCampaign || !exportApprovedCount) return; beginAction(); try { const response = await fetch("/api/exports/crm", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ campaignId: exportCampaign.id }) }); if (!response.ok) { const payload = await response.json().catch(() => ({})) as { message?: string; error?: string }; throw new Error(payload.message || payload.error || "导出未完成"); } const url = URL.createObjectURL(await response.blob()); const link = document.createElement("a"); link.href = url; link.download = "qixin-approved-leads.csv"; link.click(); URL.revokeObjectURL(url); await load(); setNotice("已生成 CRM 兼容文件并记录导出批次；仍需在生产 CRM 中再次人工确认导入。"); } catch (error) { actionError(error, "导出未完成"); } finally { setPending(false); } }
  async function addDiscoverySource(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!activeCampaignId) return; const form = event.currentTarget; const data = new FormData(form); beginAction(); try { await api("/api/discovery/sources", { method: "POST", body: JSON.stringify({ campaignId: activeCampaignId, name: data.get("name"), sourceUrl: data.get("sourceUrl"), cadence: data.get("cadence"), maxCandidates: Number(data.get("maxCandidates") || 10) }) }); form.reset(); await load(); setNotice("已保存你批准的公开来源。系统只会读取该来源及其中链接出的公开官网，不会扩展为全网搜索。"); } catch (error) { actionError(error, "来源添加失败"); } finally { setPending(false); } }
  async function toggleDiscoverySource(source: DiscoverySource) { beginAction(); try { await api("/api/discovery/sources", { method: "PATCH", body: JSON.stringify({ id: source.id, status: source.status === "active" ? "paused" : "active" }) }); await load(); setNotice(source.status === "active" ? "来源已暂停。" : "来源已恢复；下次到期后可由定时任务运行。"); } catch (error) { actionError(error, "来源状态更新失败"); } finally { setPending(false); } }
  async function runDiscovery(sourceId: string) { beginAction(); try { const result = await api<{ imported: number; qualified: number; duplicate: number; excluded: number; failed: number }>("/api/discovery/run", { method: "POST", body: JSON.stringify({ sourceId }) }); await load(); refreshLeads(); setNotice(`采集完成：自动筛选合格 ${result.qualified} 家，写入 ${result.imported} 家，重复 ${result.duplicate} 家，排除 ${result.excluded} 家，失败 ${result.failed} 家。没有自动批准或联系。`); } catch (error) { actionError(error, "采集运行失败"); } finally { setPending(false); } }
  async function reverifySelectedLead() { if (!selectedLead) return; beginAction(); try { const result = await api<{ qualified: boolean; score: number; evidenceCoverage: number; failures: string[] }>(`/api/leads/${selectedLead.id}/reverify`, { method: "POST", body: "{}" }); await load(); refreshLeads(); setNotice(result.qualified ? `重新核验通过：评分 ${result.score}，证据覆盖率 ${result.evidenceCoverage}%，仍需人工批准后才能联系。` : `重新核验完成但未通过准入：${result.failures.join("；")}`); } catch (error) { actionError(error, "重新核验失败"); } finally { setPending(false); } }
  async function assignSelectedLead() { if (!selectedLead || selectedLead.campaignId !== "system:unassigned" || !assignmentCampaignId) return; beginAction(); try { const result = await api<{ campaign: Campaign }>(`/api/leads/${selectedLead.id}/assign`, { method: "POST", body: JSON.stringify({ campaignId: assignmentCampaignId }) }); setDrawerOpen(false); setAssignmentCampaignId(""); await load(); refreshLeads(); const name = businessCampaigns.find((campaign) => campaign.id === result.campaign.id)?.name || result.campaign.name; setNotice(`客户已分配到 ${name}，仍保留为待审核状态。`); } catch (error) { actionError(error, "客户分配失败"); } finally { setPending(false); } }
  async function controlEngine(action: "start" | "pause" | "resume" | "stop" | "run_batch") { if (action === "start" && !activeBusinessCampaigns.length) { setError("请先启用至少一个 Campaign。"); return; } beginAction(); try { await api("/api/engine/control", { method: "POST", body: JSON.stringify({ action, dailyTarget: 20, timezone: "Asia/Shanghai" }) }); await load(); if (action === "start" || action === "run_batch") refreshLeads(); setNotice(action === "start" ? "自动找客户已启动；首批由后台执行，页面会自动刷新进度。" : action === "pause" ? "自动发现已暂停。" : action === "resume" ? "自动发现已恢复。" : action === "stop" ? "自动发现已停止；历史数据和日志保留。" : "已完成一轮受控补采批次。"); } catch (error) { actionError(error, "自动引擎操作失败"); } finally { setPending(false); } }
  async function importFile(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!activeCampaignId) return; const form = event.currentTarget; const file = new FormData(form).get("file"); if (!(file instanceof File) || !file.size) return; beginAction(); setImportReport(null); try { if (file.size > 2_000_000) throw new Error("导入文件不能超过 2 MB"); const content = await file.text(); const records = /\.json$/i.test(file.name) ? recordsFromJson(content) : recordsFromCsv(content); const result = await api<{ imported: number; skipped: number; results: Array<Record<string, unknown>>; replayed: boolean }>("/api/import", { method: "POST", body: JSON.stringify({ campaignId: activeCampaignId, records, originalFilename: file.name, idempotencyKey: await sha256(content) }) }); setImportReport(result); setNotice(result.replayed ? "该文件已经处理过，已返回原导入批次结果，没有重复写入。" : `结构化导入完成：写入 ${result.imported} 条待服务器重新核验记录，跳过 ${result.skipped} 条。`); form.reset(); await load(); refreshLeads(); } catch (error) { actionError(error, "导入失败"); } finally { setPending(false); } }
  async function loadReclassificationDryRun() { beginAction(); try { const result = await api<ReclassificationDryRun>("/api/reclassification/dry-run"); setReclassificationDryRun(result); setNotice("只读重分类报告已生成；没有访问官网或改写任何历史客户。"); } catch (error) { actionError(error, "只读重分类报告生成失败"); } finally { setPending(false); } }

  return {
    workspace, leadPage, leadDetail, businessCampaigns, activeBusinessCampaigns, activeCampaign, exportCampaign,
    activeCampaignId, exportCampaignId, selectedLeadId, activeView, drawerOpen,
    statusFilter, gradeFilter, regionFilter, countryFilter, typeFilters, productFilters, contactFilter, sourceFilter, specialFilter, sortBy, page, search,
    loading, leadLoading, detailLoading, pending, error, notice, reviewNotes, assignmentCampaignId, importReport, reclassificationDryRun,
    counts, regions: leadPage.facets.regions, countries: leadPage.facets.countries,
    companyTypes: [...new Set([...businessRoleOptions(), ...leadPage.facets.companyTypes])],
    productDirections: [...new Set([...productDirectionOptions(), ...leadPage.facets.productDirections])],
    sourceTypes: leadPage.facets.sourceTypes, pageCount: leadPage.pagination.pageCount,
    approvedCount: Number(counts.approved || 0), rejectedCount: Number(counts.rejected || 0), exportApprovedCount, totalApprovedCount,
    campaignDiscoverySources, globalDiscoveryRuns, discoverySourceById, campaignById, globalSourceOverview,
    engine, todayTarget, todayRemaining, openAlerts: workspace.discoveryAlerts.filter((alert) => !alert.resolvedAt), latestRun: globalDiscoveryRuns[0] || null,
    campaignLabel, approvalGaps,
    setActiveCampaignId, setExportCampaignId, setActiveView, setDrawerOpen, setStatusFilter, setGradeFilter,
    setRegionFilter, setCountryFilter, setTypeFilters, setProductFilters, setContactFilter, setSourceFilter, setSpecialFilter, setSortBy, setPage, setSearch,
    setReviewNotes, setAssignmentCampaignId, setNotice, setError,
    openLead, clearFilters, createCampaign, changeCampaignStatus, updateCampaign, review, exportApproved, addDiscoverySource,
    toggleDiscoverySource, runDiscovery, reverifySelectedLead, assignSelectedLead, controlEngine, importFile, loadReclassificationDryRun,
  };
}

export type LeadEngineState = ReturnType<typeof useLeadEngineState>;
