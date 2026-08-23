import { IconClock, IconExternalLink, IconSearch } from "@tabler/icons-react";
import type { LeadEngineState } from "@/hooks/useLeadEngineState";
import { companySignal, companyWebsiteUrl, customerTypeLabel, localizedCountry, STATUS_FILTERS, STATUS_LABELS, VIEW_LABELS } from "./model";
import { LeadReviewDrawer } from "./LeadReviewDrawer";
import { ScopeMultiFilter } from "./ScopeMultiFilter";
import styles from "../LeadEngineApp.module.css";

export function LeadReviewView({ state }: { state: LeadEngineState }) {
  const {
    approvedCount, companyTypes, contactFilter, countries, counts, countryFilter, drawerOpen,
    gradeFilter, leadLoading, leadPage, loading, page, pageCount, productDirections, productFilters,
    regionFilter, regions, rejectedCount, search, selectedLeadId, sortBy, sourceFilter, sourceTypes,
    specialFilter, statusFilter, typeFilters,
  } = state;
  const pageReset = (setter: (value: string) => void) => (event: React.ChangeEvent<HTMLSelectElement>) => { setter(event.target.value); state.setPage(1); };

  return <>
    <section className={[styles.reviewWorkspace, !drawerOpen && styles.workspaceExpanded].filter(Boolean).join(" ")} aria-label={VIEW_LABELS.review}>
      <div className={styles.reviewHeader}>
        <div className={styles.reviewTitleGroup}><div><h1>{statusFilter === "needs_review" ? "待审核客户" : STATUS_LABELS[statusFilter] || "客户审核"}</h1><p>统一客户库每家公司只显示一次；Campaign 只保留为开发策略与历史归属。</p></div></div>
        <details className={styles.filterDisclosure}><summary><IconSearch size={19} />更多筛选与搜索</summary><div className={styles.filterPanel}>
          <label className={styles.searchBox}><IconSearch size={20} aria-hidden="true" /><input value={search} onChange={(event) => { state.setSearch(event.target.value); state.setPage(1); }} placeholder="搜索公司、国家或类型" /></label>
          <div className={styles.filterBar}>
            <select value={statusFilter} onChange={pageReset(state.setStatusFilter)} aria-label="工作流状态筛选">{STATUS_FILTERS.map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}（{counts[status] || 0}）</option>)}</select>
            <select value={gradeFilter} onChange={pageReset(state.setGradeFilter)} aria-label="评分等级筛选"><option value="all">全部评分</option>{["S", "A", "B", "C", "Reject"].map((grade) => <option key={grade} value={grade}>{grade} 级</option>)}</select>
            <select value={contactFilter} onChange={pageReset(state.setContactFilter)} aria-label="联系方式状态筛选"><option value="all">全部联系状态</option><option value="valid">联系方式有效</option><option value="missing">无有效联系方式</option><option value="unverified">未核验</option></select>
            <select value={sourceFilter} onChange={pageReset(state.setSourceFilter)} aria-label="来源类型筛选"><option value="all">全部来源类型</option>{sourceTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select>
            <select value={specialFilter} onChange={pageReset(state.setSpecialFilter)} aria-label="特殊状态筛选"><option value="all">全部记录</option><option value="duplicate">仅重复</option><option value="dnc">仅禁止联系</option></select>
            <select value={sortBy} onChange={pageReset(state.setSortBy)} aria-label="排序"><option value="score_desc">评分从高到低</option><option value="score_asc">评分从低到高</option><option value="newest">最新发现</option><option value="company_asc">公司名称</option></select>
          </div>
          <span className={styles.resultCount}>找到 {leadPage.pagination.total} 家</span>
        </div></details>
      </div>

      <div className={styles.reviewScopeBar} aria-label="客户范围筛选">
        <span>客户范围</span>
        <label><small>地区</small><select value={regionFilter} onChange={(event) => { state.setRegionFilter(event.target.value); state.setCountryFilter("all"); state.setPage(1); }}><option value="all">全部地区</option>{regions.map((region) => <option key={region.value} value={region.value}>{region.label}</option>)}</select></label>
        <label><small>国家</small><select value={countryFilter} onChange={pageReset(state.setCountryFilter)}><option value="all">全部国家</option>{countries.map((country) => <option key={country} value={country}>{localizedCountry(country)}</option>)}</select></label>
        <ScopeMultiFilter label="客户类型/商业角色" options={companyTypes} selected={typeFilters} onChange={(values) => { state.setTypeFilters(values); state.setPage(1); }} />
        <ScopeMultiFilter label="产品分类" options={productDirections} selected={productFilters} onChange={(values) => { state.setProductFilters(values); state.setPage(1); }} />
        <b>{leadPage.pagination.total} 家</b>
      </div>

      <div className={styles.reviewStatusTabs} aria-label="手机审核状态"><button type="button" data-active={statusFilter === "needs_review"} onClick={() => { state.setStatusFilter("needs_review"); state.setPage(1); }}>待审核 <b>{counts.needs_review || 0}</b></button><button type="button" data-active={statusFilter === "rejected"} onClick={() => { state.setStatusFilter("rejected"); state.setPage(1); }}>已淘汰 <b>{rejectedCount}</b></button><button type="button" data-active={statusFilter === "approved"} onClick={() => { state.setStatusFilter("approved"); state.setPage(1); }}>已批准 <b>{approvedCount}</b></button></div>
      <div className={styles.tableFrame} aria-busy={loading || leadLoading}>
        <div className={styles.tableScroll}><table className={styles.leadTable}><thead><tr><th>公司</th><th>类型</th><th>国家</th><th>评分</th><th>证据覆盖</th><th>关键采购信号</th><th>风险</th><th>状态</th></tr></thead><tbody>{leadPage.rows.map((lead) => { const websiteUrl = companyWebsiteUrl(lead); const isSelected = selectedLeadId === lead.leadId && drawerOpen; return <tr key={lead.leadId} className={isSelected ? styles.rowSelected : ""} aria-selected={isSelected}><td><div className={styles.companyCell}>{websiteUrl ? <a className={styles.companyWebsite} href={websiteUrl} target="_blank" rel="noopener noreferrer" title={`打开 ${lead.companyName || "公司"} 官网`}><strong>{lead.companyName || "公司资料缺失"}<IconExternalLink size={14} aria-hidden="true" /></strong><small>{lead.primaryDomain || lead.website}</small></a> : <span className={styles.companyUnavailable}><strong>{lead.companyName || "公司资料缺失"}</strong><small>官网待核验</small></span>}<button type="button" className={styles.evidenceButton} onClick={() => state.openLead(lead.leadId)}>查看证据与审核</button></div></td><td>{customerTypeLabel(lead)}</td><td>{localizedCountry(lead.country)}</td><td><b className={styles.scoreValue}>{lead.score}</b></td><td><b className={styles.coverageValue}>{lead.evidenceCoverage}%</b></td><td><span className={styles.signalText} title={companySignal(lead)}>{companySignal(lead)}</span></td><td><span className={lead.hardGateStatus === "fail" ? styles.riskHigh : styles.riskMedium}>{lead.hardGateStatus === "fail" ? "高" : "中等"}</span></td><td><span className={styles.statusBadge}>{STATUS_LABELS[lead.workflowStatus] || lead.workflowStatus}</span></td></tr>; })}</tbody></table></div>
        <div className={styles.mobileLeadList} aria-label="客户卡片列表">{leadPage.rows.map((lead) => <article key={lead.leadId} className={selectedLeadId === lead.leadId && drawerOpen ? styles.mobileLeadSelected : ""}><button type="button" onClick={() => state.openLead(lead.leadId)} aria-label={`查看 ${lead.companyName} 的证据与审核`}><div className={styles.mobileLeadHead}><div><b>{lead.companyName}</b><span>{lead.primaryDomain || localizedCountry(lead.country)}</span></div><strong>{lead.score}</strong></div><div className={styles.mobileLeadMeta}><span>{customerTypeLabel(lead)}</span><span>证据 {lead.evidenceCoverage}%</span><span>{STATUS_LABELS[lead.workflowStatus] || lead.workflowStatus}</span></div><p>{companySignal(lead)}</p><small>点按查看证据与审核</small></button></article>)}</div>
        {loading || leadLoading ? <div className={styles.emptyState}><IconClock size={26} /><b>正在读取私有数据库…</b></div> : null}
        {!loading && !leadLoading && !leadPage.rows.length ? <div className={styles.emptyState}><IconSearch size={28} /><b>{statusFilter === "needs_review" && rejectedCount ? "当前客户范围暂无待审核客户" : "当前筛选没有客户"}</b><p>{statusFilter === "needs_review" && rejectedCount ? `当前范围有 ${rejectedCount} 家已淘汰客户，可查看未通过原因。` : "调整地区、国家、客户类型、产品分类或清除筛选后再查看。"}</p>{statusFilter === "needs_review" && rejectedCount ? <button type="button" onClick={() => { state.setStatusFilter("rejected"); state.setPage(1); }}>查看 {rejectedCount} 家已淘汰客户</button> : <button type="button" onClick={state.clearFilters}>清除筛选</button>}</div> : null}
        {!loading && !leadLoading && leadPage.rows.length ? <div className={styles.pagination}><span>第 {Math.min(page, pageCount)} / {pageCount} 页 · 共 {leadPage.pagination.total} 家</span><div><button type="button" disabled={page <= 1} onClick={() => state.setPage((value) => Math.max(1, value - 1))}>上一页</button><button type="button" disabled={page >= pageCount} onClick={() => state.setPage((value) => Math.min(pageCount, value + 1))}>下一页</button></div></div> : null}
      </div>
    </section>
    {drawerOpen ? <LeadReviewDrawer state={state} /> : null}
  </>;
}
