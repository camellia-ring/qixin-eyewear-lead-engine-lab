import { IconCalendarStats, IconChevronLeft, IconChevronRight, IconClock, IconExternalLink, IconSearch } from "@tabler/icons-react";
import type { LeadEngineState } from "@/hooks/useLeadEngineState";
import { reportingPeriod } from "@/lib/reporting-period";
import { companySignal, companyWebsiteUrl, customerTypeLabel, localizedCountry, STATUS_LABELS, VIEW_LABELS } from "./model";
import { LeadReviewDrawer } from "./LeadReviewDrawer";
import { ScopeMultiFilter } from "./ScopeMultiFilter";
import styles from "../LeadEngineApp.module.css";

const COMPLETION_PERIODS = [
  ["all", "全部"],
  ["week", "周"],
  ["month", "月"],
  ["quarter", "季度"],
  ["year", "年"],
] as const;

export function LeadReviewView({ state }: { state: LeadEngineState }) {
  const {
    companyTypes, contactFilter, countries, countryFilter, drawerOpen,
    gradeFilter, leadLoading, leadPage, loading, page, pageCount, productDirections, productFilters,
    regionFilter, regions, reviewState, reviewedCount, search, selectedLeadId, sortBy, sourceFilter, sourceTypes,
    specialFilter, typeFilters, unreviewedCount, completionAnchor, completionPeriod,
  } = state;
  const pageReset = (setter: (value: string) => void) => (event: React.ChangeEvent<HTMLSelectElement>) => { setter(event.target.value); state.setPage(1); };
  const completionLabel = completionPeriod === "all" ? "全部时间" : reportingPeriod(completionPeriod, completionAnchor).label;

  return <>
    <section className={[styles.reviewWorkspace, styles.workspaceExpanded].join(" ")} aria-label={VIEW_LABELS.review}>
      <div className={styles.reviewHeader}>
        <div className={styles.reviewTitleGroup}><p>统一客户库每家公司只显示一次；Campaign 只保留为开发策略与历史归属。</p></div>
        <details className={styles.filterDisclosure}><summary><IconSearch size={19} />更多筛选与搜索</summary><div className={styles.filterPanel}>
          <label className={styles.searchBox}><IconSearch size={20} aria-hidden="true" /><input value={search} onChange={(event) => { state.setSearch(event.target.value); state.setPage(1); }} placeholder="搜索公司、国家或类型" /></label>
          <div className={styles.filterBar}>
            <select value={gradeFilter} onChange={pageReset(state.setGradeFilter)} aria-label="评分等级筛选"><option value="all">全部评分</option>{["S", "A", "B", "C", "Reject"].map((grade) => <option key={grade} value={grade}>{grade} 级</option>)}</select>
            <select value={contactFilter} onChange={pageReset(state.setContactFilter)} aria-label="联系方式状态筛选"><option value="all">全部联系状态</option><option value="valid">联系方式有效</option><option value="missing">无有效联系方式</option><option value="unverified">未核验</option></select>
            <select value={sourceFilter} onChange={pageReset(state.setSourceFilter)} aria-label="来源类型筛选"><option value="all">全部来源类型</option>{sourceTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select>
            <select value={specialFilter} onChange={pageReset(state.setSpecialFilter)} aria-label="特殊状态筛选"><option value="all">全部记录</option><option value="duplicate">仅重复</option><option value="dnc">仅禁止联系</option></select>
            <select value={sortBy} onChange={pageReset(state.setSortBy)} aria-label="排序"><option value="score_desc">评分从高到低</option><option value="score_asc">评分从低到高</option><option value="newest">最新发现</option><option value="company_asc">公司名称</option></select>
          </div>
          <span className={styles.resultCount}>找到 {leadPage.pagination.total} 家</span>
        </div></details>
      </div>

      <section className={styles.completionFilterBar} aria-label="完成时间筛选">
        <div className={styles.completionFilterTitle}><IconCalendarStats size={19} /><div><span>完成时间</span><small>先选时间，再按客户范围细筛</small></div></div>
        <div className={styles.completionPeriodTabs}>{COMPLETION_PERIODS.map(([value, label]) => <button key={value} type="button" data-active={completionPeriod === value} onClick={() => state.selectCompletionPeriod(value)}>{label}</button>)}</div>
        <div className={styles.completionPeriodNavigator}>
          <button type="button" disabled={completionPeriod === "all"} aria-label="上一周期" onClick={() => state.shiftCompletionPeriod(-1)}><IconChevronLeft size={18} /></button>
          <div><b>{completionLabel}</b><small>{completionPeriod === "all" ? "包含现有客户全集" : "仅显示该周期自动完成客户"}</small></div>
          <button type="button" disabled={completionPeriod === "all"} aria-label="下一周期" onClick={() => state.shiftCompletionPeriod(1)}><IconChevronRight size={18} /></button>
          {completionPeriod !== "all" ? <button className={styles.currentPeriodButton} type="button" onClick={state.resetCompletionPeriod}>回到本期</button> : null}
        </div>
        <strong>{leadPage.pagination.total} 家</strong>
      </section>

      <div className={styles.reviewScopeBar} aria-label="客户范围筛选">
        <span>客户范围</span>
        <label><small>地区</small><select value={regionFilter} onChange={(event) => { state.setRegionFilter(event.target.value); state.setCountryFilter("all"); state.setPage(1); }}><option value="all">全部地区</option>{regions.map((region) => <option key={region.value} value={region.value}>{region.label}</option>)}</select></label>
        <label><small>国家</small><select value={countryFilter} onChange={pageReset(state.setCountryFilter)}><option value="all">全部国家</option>{countries.map((country) => <option key={country} value={country}>{localizedCountry(country)}</option>)}</select></label>
        <ScopeMultiFilter label="客户类型/商业角色" options={companyTypes} selected={typeFilters} onChange={(values) => { state.setTypeFilters(values); state.setPage(1); }} />
        <ScopeMultiFilter label="产品分类" options={productDirections} selected={productFilters} onChange={(values) => { state.setProductFilters(values); state.setPage(1); }} />
        <button type="button" className={styles.reviewStateToggle} aria-pressed={reviewState === "reviewed"} onClick={() => { state.setReviewState(reviewState === "unreviewed" ? "reviewed" : "unreviewed"); state.setDrawerOpen(false); state.setPage(1); }}>{reviewState === "unreviewed" ? `未审核 ${unreviewedCount}` : `已审核 ${reviewedCount}`}</button>
        <b>当前范围 {leadPage.pagination.total} 家</b>
      </div>

      <div className={styles.tableFrame} aria-busy={loading || leadLoading}>
        <div className={styles.tableScroll}><table className={styles.leadTable}><thead><tr><th>公司</th><th>类型</th><th>国家</th><th>评分</th><th>证据覆盖</th><th>关键采购信号</th><th>风险</th><th>状态</th><th className={styles.actionColumn}>操作</th></tr></thead><tbody>{leadPage.rows.map((lead) => { const websiteUrl = companyWebsiteUrl(lead); const isSelected = selectedLeadId === lead.leadId && drawerOpen; return <tr key={lead.leadId} className={isSelected ? styles.rowSelected : ""} aria-selected={isSelected}><td><div className={styles.companyCell}>{websiteUrl ? <a className={styles.companyWebsite} href={websiteUrl} target="_blank" rel="noopener noreferrer" title={`打开 ${lead.companyName || "公司"} 官网`}><strong>{lead.companyName || "公司资料缺失"}<IconExternalLink size={14} aria-hidden="true" /></strong><small>{lead.primaryDomain || lead.website}</small></a> : <span className={styles.companyUnavailable}><strong>{lead.companyName || "公司资料缺失"}</strong><small>官网待核验</small></span>}</div></td><td>{customerTypeLabel(lead)}</td><td>{localizedCountry(lead.country)}</td><td><b className={styles.scoreValue}>{lead.score}</b></td><td><b className={styles.coverageValue}>{lead.evidenceCoverage}%</b></td><td><span className={styles.signalText} title={companySignal(lead)}>{companySignal(lead)}</span></td><td><span className={lead.hardGateStatus === "fail" ? styles.riskHigh : styles.riskMedium}>{lead.hardGateStatus === "fail" ? "高" : "中等"}</span></td><td><span className={styles.statusBadge} data-status={lead.workflowStatus}>{STATUS_LABELS[lead.workflowStatus] || lead.workflowStatus}</span></td><td className={styles.actionCell}><button type="button" className={styles.evidenceButton} onClick={() => state.openLead(lead.leadId)}>查看证据与审核</button></td></tr>; })}</tbody></table></div>
        <div className={styles.mobileLeadList} aria-label="客户卡片列表">{leadPage.rows.map((lead) => <article key={lead.leadId} className={selectedLeadId === lead.leadId && drawerOpen ? styles.mobileLeadSelected : ""}><button type="button" onClick={() => state.openLead(lead.leadId)} aria-label={`查看 ${lead.companyName} 的证据与审核`}><div className={styles.mobileLeadHead}><div><b>{lead.companyName}</b><span>{lead.primaryDomain || localizedCountry(lead.country)}</span></div><strong>{lead.score}</strong></div><div className={styles.mobileLeadMeta}><span>{customerTypeLabel(lead)}</span><span>证据 {lead.evidenceCoverage}%</span><span className={styles.mobileStatusBadge} data-status={lead.workflowStatus}>{STATUS_LABELS[lead.workflowStatus] || lead.workflowStatus}</span></div><p>{companySignal(lead)}</p><small>点按查看证据与审核</small></button></article>)}</div>
        {loading || leadLoading ? <div className={styles.emptyState}><IconClock size={26} /><b>正在读取私有数据库…</b></div> : null}
        {!loading && !leadLoading && !leadPage.rows.length ? <div className={styles.emptyState}><IconSearch size={28} /><b>当前时间与客户范围暂无{reviewState === "unreviewed" ? "未审核" : "已审核"}客户</b><p>调整完成时间、客户范围或清除筛选后再查看。</p><button type="button" onClick={state.clearFilters}>清除筛选</button></div> : null}
        {!loading && !leadLoading && leadPage.rows.length ? <div className={styles.pagination}><span>第 {Math.min(page, pageCount)} / {pageCount} 页 · 共 {leadPage.pagination.total} 家</span><div><button type="button" disabled={page <= 1} onClick={() => state.setPage((value) => Math.max(1, value - 1))}>上一页</button><button type="button" disabled={page >= pageCount} onClick={() => state.setPage((value) => Math.min(pageCount, value + 1))}>下一页</button></div></div> : null}
      </div>
    </section>
    {drawerOpen ? <LeadReviewDrawer state={state} /> : null}
  </>;
}
