import { useState } from "react";
import { IconAlertTriangle, IconFileExport, IconPlayerPause, IconPlayerPlay, IconRadar, IconSettings, IconX } from "@tabler/icons-react";
import type { LeadEngineState } from "@/hooks/useLeadEngineState";
import { CompletionActivityChart } from "./CompletionActivityChart";
import { formatDate, VIEW_LABELS } from "./model";
import styles from "../LeadEngineApp.module.css";

export function AutomaticDiscoveryView({ state }: { state: LeadEngineState }) {
  const { activeBusinessCampaigns, discoverySourceById, discoveryStats, engine, globalDiscoveryRuns, globalSourceOverview, historyLoading, latestRun, openAlerts, pending, todayLedger, totalApprovedCount, workspace } = state;
  const [historyDays, setHistoryDays] = useState<30 | 90>(30);
  const latestSource = latestRun ? discoverySourceById.get(latestRun.sourceId) : null;
  const summary = discoveryStats.summary;
  async function changeHistoryDays(days: 30 | 90) {
    if (await state.loadDiscoveryHistory(days)) setHistoryDays(days);
  }
  return <section className={styles.toolWorkspace} aria-label={VIEW_LABELS.discovery}>
    <div className={styles.toolHeader}><div><span className={styles.sectionKicker}>CONTINUOUS DISCOVERY</span><h1>全局自动找客户</h1><p>无需先选择 Campaign。引擎运行且来源可用时持续发现，不设置每日数量目标；系统按全部运行中 Campaign 的国家、客户类型与产品证据自动归类。</p></div><IconRadar size={34} /></div>
    <section className={styles.engineDashboard}>
      <div className={styles.engineControl}><div><span>当前运行状态</span><b data-status={engine?.status || "stopped"}>{engine?.status === "running" ? "运行中" : engine?.status === "paused" ? "已暂停" : "已停止"}</b><small>时区：{engine?.timezone || "Asia/Shanghai"} · 启动只保存状态，首批由后台执行</small></div><div className={styles.engineActions}><button className={styles.primaryButton} type="button" disabled={pending || engine?.status === "running" || !activeBusinessCampaigns.length} onClick={() => void state.controlEngine("start")}><IconPlayerPlay size={18} />{pending ? "正在启动…" : "开始自动找客户"}</button><button className={styles.secondaryButton} type="button" disabled={pending || engine?.status !== "running"} onClick={() => void state.controlEngine("pause")}><IconPlayerPause size={18} />暂停</button><button className={styles.secondaryButton} type="button" disabled={pending || engine?.status !== "paused"} onClick={() => void state.controlEngine("resume")}><IconPlayerPlay size={18} />恢复</button><button className={styles.secondaryButton} type="button" disabled={pending || !engine || engine.status === "stopped"} onClick={() => void state.controlEngine("stop")}><IconX size={18} />停止</button></div></div>
      <div className={styles.engineMetrics}>
        <article className={styles.metricSuccess}><span>今日已完成</span><b>{summary.today}</b><small>今天首次自动合格并保存</small></article>
        <article><span>昨日已完成</span><b>{summary.yesterday}</b><small>昨日自然日的真实完成量</small></article>
        <article><span>累计已完成</span><b>{summary.total}</b><small>可追溯的唯一自动发现客户</small></article>
      </div>
      <div className={styles.periodMetrics} aria-label="当前周期完成客户数量">
        <article><span>本周</span><b>{summary.week}</b><small>{discoveryStats.periods.week.label}</small></article>
        <article><span>本月</span><b>{summary.month}</b><small>{discoveryStats.periods.month.label}</small></article>
        <article><span>本季度</span><b>{summary.quarter}</b><small>{discoveryStats.periods.quarter.label}</small></article>
        <article><span>本年</span><b>{summary.year}</b><small>{discoveryStats.periods.year.label}</small></article>
      </div>
      <div className={styles.engineTimeline}><span>最近运行：<b>{formatDate(engine?.lastRunAt)}</b></span><span>下次运行：<b>{formatDate(engine?.nextRunAt)}</b></span><span>当前来源：<b>{latestSource?.name || "等待下一批"}</b></span><span>来源范围：<b>{latestSource?.region || "全局来源池"}</b></span><span>归类方式：<b>核验后按全部运行中 Campaign 自动归类</b></span></div>
      {todayLedger?.availabilityNote || engine?.lastError ? <div className={styles.engineAlert}><IconAlertTriangle size={19} /><span>{todayLedger?.availabilityNote || engine?.lastError}</span></div> : null}
      {openAlerts.length ? <div className={styles.alertList}>{openAlerts.slice(0, 5).map((alert) => <article key={alert.id} data-severity={alert.severity}><b>{alert.severity === "critical" ? "重要告警" : "来源提醒"}</b><span>{alert.message}</span><small>{formatDate(alert.createdAt)}</small></article>)}</div> : null}
      <div className={styles.engineExports}><span>自动合格客户可在审核台按地区、国家、客户类型和产品分类查看；人工批准后才能导出。</span><button className={styles.secondaryButton} type="button" disabled={!totalApprovedCount} onClick={() => state.setActiveView("export")}><IconFileExport size={17} />前往 CRM 导出</button></div>
    </section>
    <section className={[styles.toolSection, styles.completionActivity].join(" ")}>
      <CompletionActivityChart days={historyDays} historyLoading={historyLoading} onDaysChange={changeHistoryDays} onLoadOlder={state.loadOlderDiscoveryHistory} previousBefore={discoveryStats.history.previousBefore} rows={discoveryStats.history.rows} />
    </section>
    <div className={styles.discoveryPrinciples}><article><b>预置官方来源免费运行</b><span>付费搜索和 GPT provider 有接口但默认关闭、无密钥也可运行</span></article><article><b>每批领取 20 个候选</b><span>公司级并发从 3 自动升至 5；限流、超时或错误升高时降至 2 或 1</span></article><article><b>人工批准仍是联系闸门</b><span>自动合格客户进入待审核，不发送邮件、不写生产 CRM</span></article></div>
    <section className={[styles.toolSection, styles.sourceOverview].join(" ")}><div className={styles.sectionTitleRow}><h2>来源运行概览</h2><button className={styles.secondaryButton} type="button" onClick={() => state.setActiveView("advanced")}><IconSettings size={17} />管理来源</button></div><div className={styles.sourceOverviewGrid}>{globalSourceOverview.map((source) => <article key={source.id}><div><b>{source.name}</b><span className={source.enabled && source.status === "active" ? styles.sourceActive : styles.sourcePaused}>{source.enabled && source.status === "active" ? `${source.tier}级 · 已启用` : "已暂停"}</span></div><p>{source.scopeLabel}</p><small>{source.region} · {source.cadence === "manual" ? "仅手动" : `下次：${formatDate(source.nextRunAt)}`}</small></article>)}{!globalSourceOverview.length ? <div className={styles.emptyCompact}><IconRadar size={28} /><b>尚未准备来源</b><span>启用 Campaign 后，引擎会按市场准备官方来源。</span></div> : null}</div></section>
    <section className={[styles.toolSection, styles.discoveryHistory].join(" ")}><div className={styles.sectionTitleRow}><h2>采集批次日志</h2><span className={styles.muted}>每一次访问、去重、排除和失败都会保留</span></div><div className={styles.runList}>{globalDiscoveryRuns.map((run) => { const source = discoverySourceById.get(run.sourceId); const runItems = workspace.discoveryItems.filter((item) => item.runId === run.id); return <article key={run.id}><div className={styles.runSummary}><div><b>{source?.name || "已删除来源"}</b><span>{source?.region || "全局来源池"} · {formatDate(run.startedAt)} · {run.trigger === "scheduled" ? "定时" : "手动"}</span></div><strong data-status={run.status}>{run.status === "completed" ? "完成" : run.status === "partial" ? "部分完成" : run.status === "failed" ? "失败" : "运行中"}</strong></div><div className={styles.runMetrics}><span>原始发现 <b>{run.rawDiscoveredCount ?? run.discoveredCount}</b></span><span>成功解析 <b>{run.parsedCount || 0}</b></span><span>官网核验 <b>{run.websiteVerifiedCount || 0}</b></span><span>有效联系 <b>{run.validContactCount || 0}</b></span><span>自动合格 <b>{run.qualifiedCount || 0}</b></span><span>重复 <b>{run.duplicateCount}</b></span><span>准入失败 <b>{run.mandatoryGateFailedCount || run.excludedCount}</b></span><span>采集失败 <b>{run.failedCount}</b></span></div>{run.errorSummary ? <pre className={styles.runError}>{run.errorSummary}</pre> : null}{runItems.length ? <details className={styles.runDetails}><summary>查看本批明细（{runItems.length}）</summary><div>{runItems.slice(0, 20).map((item) => <a key={item.id} href={item.websiteUrl} target="_blank" rel="noreferrer"><span>{item.outcome === "imported" ? "新增" : item.outcome === "duplicate" ? "重复" : item.outcome === "excluded" ? "排除" : "失败"}</span><b>{item.companyName || item.normalizedDomain}</b><small>{item.reason}</small></a>)}</div></details> : null}</article>; })}{!globalDiscoveryRuns.length ? <p className={styles.muted}>尚无采集批次。开始引擎后等待服务器定时运行；手工诊断入口位于高级工具。</p> : null}</div></section>
  </section>;
}
