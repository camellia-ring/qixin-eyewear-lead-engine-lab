"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SCORE_LIMITS } from "@/lib/lead-engine";
import styles from "./LeadEngineApp.module.css";

type Campaign = {
  id: string;
  name: string;
  productTrack: string;
  targetMarkets: string;
  targetCount: number;
  status: string;
};

type Company = {
  id: string;
  campaignId: string;
  companyName: string;
  website?: string;
  country?: string;
  customerType?: string;
  productTrack: string;
  productInterests: string;
  estimatedPurchaseVolume?: string;
  businessEmail?: string;
  contactChannel?: string;
  sourceUrl?: string;
  evidenceSummary?: string;
  totalScore: number;
  grade: string;
  reviewStatus: string;
  disqualificationReason?: string;
  doNotContact: boolean;
  lastVerifiedAt?: string;
  [key: string]: unknown;
};

type Contact = {
  id: string;
  companyId: string;
  fullName: string;
  jobTitle?: string;
  email?: string;
  verificationStatus: string;
  sourceUrl?: string;
  isPrimary: boolean;
};

type Evidence = {
  id: string;
  companyId: string;
  evidenceType: string;
  title: string;
  sourceUrl: string;
  observedValue?: string;
  capturedAt: string;
};

type Workspace = {
  campaigns: Campaign[];
  companies: Company[];
  contacts: Contact[];
  evidence: Evidence[];
  reviews: Array<{ id: string; companyId: string; decision: string; notes?: string; createdAt: string }>;
};

const EMPTY_WORKSPACE: Workspace = { campaigns: [], companies: [], contacts: [], evidence: [], reviews: [] };
const STATUS_FILTERS = ["all", "new", "needs_research", "ready_for_review", "approved", "rejected"];
const SCORE_LABELS: Record<string, string> = {
  customerTypeScore: "客户类型与规模",
  productFitScore: "产品匹配",
  marketPriorityScore: "目标市场优先级",
  buyingSignalScore: "采购或进口迹象",
  wholesaleOemScore: "批发 / OEM 迹象",
  contactQualityScore: "联系人质量",
  evidenceQualityScore: "证据完整度",
  recentSignalScore: "近期业务信号",
};
const STATUS_LABELS: Record<string, string> = {
  all: "全部候选",
  new: "新导入",
  needs_research: "待补研究",
  ready_for_review: "待审核",
  approved: "已批准",
  rejected: "已淘汰",
};
const PRODUCT_LABELS: Record<string, string> = {
  optical_lenses: "光学镜片",
  safety_lenses: "安全与防护镜片",
};
const HEADER_MAP: Record<string, string> = {
  company_name: "companyName",
  website: "website",
  country: "country",
  customer_type: "customerType",
  product_track: "productTrack",
  product_interests: "productInterests",
  estimated_purchase_volume: "estimatedPurchaseVolume",
  business_email: "businessEmail",
  contact_channel: "contactChannel",
  contact_name: "contactName",
  contact_role: "contactRole",
  contact_email: "contactEmail",
  whatsapp: "whatsapp",
  contact_verification: "contactVerification",
  source_url: "sourceUrl",
  evidence_summary: "evidenceSummary",
  last_verified_at: "lastVerifiedAt",
  disqualification_reason: "disqualificationReason",
  customer_type_score: "customerTypeScore",
  product_fit_score: "productFitScore",
  market_priority_score: "marketPriorityScore",
  buying_signal_score: "buyingSignalScore",
  wholesale_oem_score: "wholesaleOemScore",
  contact_quality_score: "contactQualityScore",
  evidence_quality_score: "evidenceQualityScore",
  recent_signal_score: "recentSignalScore",
};

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: "same-origin",
    cache: "no-store",
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers || {}) },
  });
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
  if (!headers.includes("company_name") || !headers.includes("source_url")) throw new Error("CSV 必须包含 company_name 和 source_url");
  return rows.slice(1).map((cells) => Object.fromEntries(headers.map((header, index) => {
    const field = HEADER_MAP[header] || header;
    const raw = cells[index]?.trim() || "";
    return [field, field.endsWith("Score") ? Number(raw || 0) : raw];
  })));
}

function formatDate(value?: string) {
  if (!value) return "未记录";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium" }).format(date);
}

export default function LeadEngineApp() {
  const [workspace, setWorkspace] = useState<Workspace>(EMPTY_WORKSPACE);
  const [activeCampaignId, setActiveCampaignId] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [importReport, setImportReport] = useState<{ imported: number; skipped: number } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api<Workspace>("/api/workspace");
      setWorkspace(data);
      setActiveCampaignId((current) => data.campaigns.some((item: Campaign) => item.id === current) ? current : data.campaigns[0]?.id || "");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "无法加载独立实验数据库");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const activeCampaign = workspace.campaigns.find((campaign) => campaign.id === activeCampaignId) || null;
  const campaignCompanies = useMemo(() => workspace.companies.filter((company) => company.campaignId === activeCampaignId), [workspace.companies, activeCampaignId]);
  const filteredCompanies = useMemo(() => campaignCompanies.filter((company) => {
    const filterMatch = statusFilter === "all" || company.reviewStatus === statusFilter;
    const term = search.trim().toLocaleLowerCase();
    const searchMatch = !term || [company.companyName, company.country, company.website, company.customerType].some((value) => String(value || "").toLocaleLowerCase().includes(term));
    return filterMatch && searchMatch;
  }), [campaignCompanies, search, statusFilter]);
  const selected = filteredCompanies.find((company) => company.id === selectedCompanyId) || filteredCompanies[0] || null;

  const counts = Object.fromEntries(STATUS_FILTERS.map((status) => [status, status === "all" ? campaignCompanies.length : campaignCompanies.filter((company) => company.reviewStatus === status).length]));
  const approvedCount = Number(counts.approved || 0);
  const gradeACount = campaignCompanies.filter((company) => company.grade === "A" && company.reviewStatus !== "rejected").length;

  async function createCampaign(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setPending(true); setError(""); setNotice("");
    try {
      const result = await api<{ campaign: Campaign }>("/api/campaigns", { method: "POST", body: JSON.stringify({
        name: data.get("name"), productTrack: data.get("productTrack"), targetMarkets: data.get("targetMarkets"), targetCount: Number(data.get("targetCount") || 30),
      }) });
      form.reset();
      await load();
      setActiveCampaignId(result.campaign.id);
      setNotice("Campaign 已创建。它只存在于独立实验数据库中。");
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "创建失败"); }
    finally { setPending(false); }
  }

  async function importCsv(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeCampaignId) return;
    const form = event.currentTarget;
    const file = new FormData(form).get("file");
    if (!(file instanceof File) || !file.size) return;
    setPending(true); setError(""); setNotice(""); setImportReport(null);
    try {
      const records = recordsFromCsv(await file.text());
      const result = await api<{ imported: number; skipped: number }>("/api/import", { method: "POST", body: JSON.stringify({ campaignId: activeCampaignId, records }) });
      setImportReport({ imported: result.imported, skipped: result.skipped });
      setNotice(`结构化导入完成：写入 ${result.imported} 条，跳过 ${result.skipped} 条。`);
      form.reset();
      await load();
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "导入失败"); }
    finally { setPending(false); }
  }

  async function review(decision: string) {
    if (!selected) return;
    if (decision === "rejected" && !reviewNotes.trim()) { setError("淘汰客户前必须填写原因。"); return; }
    setPending(true); setError(""); setNotice("");
    try {
      await api<{ companyId: string; decision: string }>("/api/reviews", { method: "POST", body: JSON.stringify({ companyId: selected.id, decision, notes: reviewNotes }) });
      setReviewNotes("");
      setNotice(`审核结果已保存：${STATUS_LABELS[decision]}。没有写入生产 CRM。`);
      await load();
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "审核未完成"); }
    finally { setPending(false); }
  }

  const selectedContacts = selected ? workspace.contacts.filter((contact) => contact.companyId === selected.id) : [];
  const selectedEvidence = selected ? workspace.evidence.filter((item) => item.companyId === selected.id) : [];

  return (
    <main className={styles.app}>
      <header className={styles.hero}>
        <div className={styles.brand}><span>Q</span><div><b>QIXIN</b><small>LEAD ENGINE LAB</small></div></div>
        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}>独立实验环境 · 人工审核闸门</span>
          <h1>把“找到公司”变成<br />一份可信的候选名单。</h1>
          <p>结构化导入、保存来源证据、拆解评分、人工审核。只有已批准记录才能导出为现有 CRM 接受的 CSV。</p>
        </div>
        <div className={styles.isolation}><span>隔离状态</span><b>生产系统未连接</b><p>独立代码 · 独立 D1 · 无发送能力</p></div>
      </header>

      <section className={styles.controlStrip}>
        <label>当前 Campaign
          <select value={activeCampaignId} onChange={(event) => setActiveCampaignId(event.target.value)}>
            <option value="">尚未创建 Campaign</option>
            {workspace.campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}
          </select>
        </label>
        {activeCampaign ? <div className={styles.campaignMeta}><span>{PRODUCT_LABELS[activeCampaign.productTrack]}</span><span>{activeCampaign.targetMarkets || "市场待定义"}</span><span>目标 {activeCampaign.targetCount} 家</span></div> : null}
        <details className={styles.createCampaign} open={!workspace.campaigns.length}>
          <summary>新建 Campaign</summary>
          <form onSubmit={createCampaign}>
            <input name="name" required maxLength={160} placeholder="例如：欧洲光学镜片 30 家试运行" />
            <select name="productTrack" defaultValue="optical_lenses"><option value="optical_lenses">光学镜片</option><option value="safety_lenses">安全与防护镜片</option></select>
            <input name="targetMarkets" maxLength={500} placeholder="目标国家 / 地区" />
            <input name="targetCount" type="number" min="1" max="500" defaultValue="30" aria-label="目标公司数量" />
            <button type="submit" disabled={pending}>创建独立 Campaign</button>
          </form>
        </details>
      </section>

      {error ? <div className={styles.error} role="alert">{error}</div> : null}
      {notice ? <div className={styles.notice} role="status">{notice}</div> : null}

      <section className={styles.metrics} aria-busy={loading}>
        <article><span>候选公司</span><b>{campaignCompanies.length}</b><p>只属于当前实验 Campaign</p></article>
        <article><span>A 级候选</span><b>{gradeACount}</b><p>评分至少 75，仍需人工审核</p></article>
        <article><span>待审核</span><b>{counts.ready_for_review || 0}</b><p>证据已整理，等待人做判断</p></article>
        <article className={styles.metricAccent}><span>已批准可导出</span><b>{approvedCount}</b><p>唯一允许进入 CRM 的候选集</p></article>
      </section>

      <section className={styles.workflow}>
        <aside className={styles.importPanel}>
          <span className={styles.eyebrow}>01 / STRUCTURED INTAKE</span>
          <h2>只导入已研究的结构化记录</h2>
          <p>V1 不自动搜索、不抓取、不消耗 Apollo 额度。先用 Codex 或人工研究 20—30 家，再上传带来源与评分维度的 CSV。</p>
          <a className={styles.templateLink} href="/qixin-lead-engine-template.csv" download>下载 CSV 模板</a>
          <form className={styles.importForm} onSubmit={importCsv}>
            <input name="file" type="file" accept=".csv,text/csv" required disabled={!activeCampaignId || pending} />
            <button type="submit" disabled={!activeCampaignId || pending}>{pending ? "正在处理…" : "导入当前 Campaign"}</button>
          </form>
          {importReport ? <p className={styles.report}>最近导入：写入 {importReport.imported} 条，跳过 {importReport.skipped} 条。</p> : null}
          <div className={styles.guardrails}><b>V1 明确不做</b><span>自动找邮箱</span><span>自动生成开发信</span><span>自动发送邮件</span><span>直接写生产 CRM</span></div>
        </aside>

        <div className={styles.pipeline}>
          <div className={styles.pipelineHeader}>
            <div><span className={styles.eyebrow}>02 / REVIEW PIPELINE</span><h2>证据驱动的候选客户池</h2></div>
            <label>搜索候选<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="公司、国家、类型或网站" /></label>
          </div>
          <div className={styles.filters} role="tablist" aria-label="审核状态筛选">
            {STATUS_FILTERS.map((status) => <button key={status} type="button" role="tab" aria-selected={statusFilter === status} className={statusFilter === status ? styles.filterActive : ""} onClick={() => setStatusFilter(status)}><span>{STATUS_LABELS[status]}</span><b>{counts[status] || 0}</b></button>)}
          </div>
          {loading ? <div className={styles.empty}>正在读取独立实验数据库…</div> : null}
          {!loading && !activeCampaign ? <div className={styles.empty}><b>先创建第一个 Campaign</b><p>建议从一个产品赛道、20—30 家候选公司开始。</p></div> : null}
          {!loading && activeCampaign && !filteredCompanies.length ? <div className={styles.empty}><b>当前队列还没有候选公司</b><p>下载模板，完成小批量研究后再导入。</p></div> : null}
          {filteredCompanies.length ? <ul className={styles.companyList}>{filteredCompanies.map((company) => <li key={company.id}><button type="button" className={`${styles.companyCard} ${selected?.id === company.id ? styles.companyActive : ""}`} onClick={() => setSelectedCompanyId(company.id)} aria-pressed={selected?.id === company.id}><span className={`${styles.grade} ${styles[`grade${company.grade}`]}`}>{company.grade}</span><span className={styles.companyCopy}><strong>{company.companyName}</strong><span>{[company.country, company.customerType].filter(Boolean).join(" · ") || "市场与类型待补充"}</span><small>{STATUS_LABELS[company.reviewStatus] || company.reviewStatus}{company.disqualificationReason ? ` · ${company.disqualificationReason}` : ""}</small></span><span className={styles.totalScore}><b>{company.totalScore}</b><small>/ 100</small></span></button></li>)}</ul> : null}
        </div>

        <aside className={styles.detailPanel}>
          {selected ? <>
            <div className={styles.detailHeader}><div><span className={styles.eyebrow}>03 / HUMAN GATE</span><h2>{selected.companyName}</h2></div><span className={`${styles.gradeLarge} ${styles[`grade${selected.grade}`]}`}>{selected.grade}</span></div>
            <div className={styles.detailMeta}><span>{STATUS_LABELS[selected.reviewStatus] || selected.reviewStatus}</span><span>{PRODUCT_LABELS[selected.productTrack] || selected.productTrack}</span><span>{selected.country || "市场待补"}</span></div>
            {selected.disqualificationReason ? <div className={styles.disqualified}><b>硬性淘汰</b><p>{selected.disqualificationReason}</p></div> : null}
            <section className={styles.scoreSection}><div className={styles.scoreHeading}><h3>可解释评分</h3><b>{selected.totalScore} / 100</b></div><div className={styles.scoreGrid}>{Object.entries(SCORE_LIMITS).map(([field, max]) => <div key={field}><span>{SCORE_LABELS[field]}</span><div><i style={{ width: `${(Number(selected[field]) / max) * 100}%` }} /></div><b>{Number(selected[field])} / {max}</b></div>)}</div></section>
            <dl className={styles.facts}>
              <div><dt>公司网站</dt><dd>{selected.website ? <a href={selected.website} target="_blank" rel="noreferrer">{selected.website}</a> : "未记录"}</dd></div>
              <div><dt>客户类型</dt><dd>{selected.customerType || "未记录"}</dd></div>
              <div><dt>产品意向</dt><dd>{selected.productInterests || "未记录"}</dd></div>
              <div><dt>预计采购量</dt><dd>{selected.estimatedPurchaseVolume || "未记录"}</dd></div>
              <div><dt>商务联系渠道</dt><dd>{selected.businessEmail || selected.contactChannel || "未记录"}</dd></div>
              <div><dt>最近核验</dt><dd>{formatDate(selected.lastVerifiedAt)}</dd></div>
            </dl>
            <section className={styles.evidence}><h3>来源与证据</h3>{selectedEvidence.length ? selectedEvidence.map((item) => <a key={item.id} href={item.sourceUrl} target="_blank" rel="noreferrer"><span>{item.title}</span><b>打开来源 ↗</b><p>{item.observedValue || "导入记录未附证据摘要"}</p></a>) : <p>没有来源证据，不能批准进入 CRM。</p>}</section>
            <section className={styles.contacts}><h3>候选联系人</h3>{selectedContacts.length ? selectedContacts.map((contact) => <article key={contact.id}><b>{contact.fullName}</b><span>{contact.jobTitle || "职位未核验"}</span><p>{contact.email || "邮箱未核验"} · {contact.verificationStatus}</p></article>) : <p>尚未识别经过来源核验的联系人。</p>}</section>
            <section className={styles.reviewBox}><h3>人工审核决定</h3><textarea value={reviewNotes} onChange={(event) => setReviewNotes(event.target.value)} rows={3} placeholder="补充判断依据；淘汰时必须填写原因" /><div className={styles.reviewActions}><button type="button" onClick={() => review("needs_research")} disabled={pending}>退回补研究</button><button type="button" onClick={() => review("ready_for_review")} disabled={pending}>提交审核</button><button type="button" className={styles.approve} onClick={() => review("approved")} disabled={pending || selected.totalScore < 60 || Boolean(selected.disqualificationReason)}>批准进入导出池</button><button type="button" className={styles.reject} onClick={() => review("rejected")} disabled={pending}>淘汰</button></div></section>
          </> : <div className={styles.empty}>选择一个候选公司查看证据与评分。</div>}
        </aside>
      </section>

      <section className={styles.transfer}>
        <div><span className={styles.eyebrow}>04 / CONTROLLED HANDOFF</span><h2>人工批准后，才离开实验环境。</h2><p>导出文件与现有 CRM 的 CSV 导入字段兼容；下载本身不会修改生产系统，仍需你在 CRM 中再次确认导入。</p></div>
        <a className={`${styles.exportButton} ${approvedCount ? "" : styles.exportDisabled}`} href={approvedCount ? "/api/exports/crm" : undefined} aria-disabled={!approvedCount}>导出 {approvedCount} 家已批准客户 <span>→</span></a>
      </section>
      <footer className={styles.footer}><span>QIXIN LEAD ENGINE LAB · PRIVATE EXPERIMENT</span><p>没有自动搜索、自动发送或生产 CRM 写入能力。</p></footer>
    </main>
  );
}
