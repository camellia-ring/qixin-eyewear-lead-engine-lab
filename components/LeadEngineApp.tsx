"use client";

import { IconFileExport, IconLetterQ, IconRadar, IconSettings, IconShieldLock, IconTargetArrow, IconUsers, IconX } from "@tabler/icons-react";
import { useLeadEngineState } from "@/hooks/useLeadEngineState";
import { AdvancedToolsView } from "./lead-engine/AdvancedToolsView";
import { AutomaticDiscoveryView } from "./lead-engine/AutomaticDiscoveryView";
import { CampaignView } from "./lead-engine/CampaignView";
import { ExportView } from "./lead-engine/ExportView";
import { LeadReviewView } from "./lead-engine/LeadReviewView";
import { VIEW_LABELS } from "./lead-engine/model";
import styles from "./LeadEngineApp.module.css";

export default function LeadEngineApp() {
  const state = useLeadEngineState();
  const { activeBusinessCampaigns, activeView, approvedCount, counts, error, notice, rejectedCount, statusFilter } = state;
  return <main className={styles.shell}>
    <p className={styles.srOnly}>可审计的销售机会。创建简化区域 Campaign，人工批准客户后通过受控移交进入网站 CRM。</p>
    <aside className={styles.sidebar}>
      <div className={styles.brand}><span className={styles.brandMark} aria-hidden="true"><IconLetterQ size={25} stroke={2.4} /></span><strong>眼镜客户开发引擎</strong></div>
      <nav className={styles.navigation} aria-label="开发引擎功能">
        <button type="button" className={activeView === "discovery" ? styles.navActive : ""} onClick={() => state.setActiveView("discovery")}><IconRadar size={20} /><span>自动发现</span></button>
        <button type="button" className={activeView === "review" ? styles.navActive : ""} onClick={() => { state.setActiveView("review"); state.setDrawerOpen(false); }}><IconUsers size={20} /><span>客户审核</span></button>
        <button type="button" className={activeView === "campaign" ? styles.navActive : ""} onClick={() => state.setActiveView("campaign")}><IconTargetArrow size={20} /><span>Campaign</span></button>
        <button type="button" className={activeView === "export" ? styles.navActive : ""} onClick={() => state.setActiveView("export")}><IconFileExport size={20} /><span>CRM 导出</span></button>
        <button type="button" className={activeView === "advanced" ? styles.navActive : ""} onClick={() => state.setActiveView("advanced")}><IconSettings size={20} /><span>高级工具</span></button>
      </nav>
      <div className={styles.sidebarFoot}><div className={styles.privateStatus}><IconShieldLock size={18} /><span><b>私有实验环境</b><small>无自动发送 · 仅批准后写入 CRM</small></span></div><button type="button" onClick={() => state.setActiveView("advanced")}><IconSettings size={20} /><span>高级工具与维护</span></button></div>
    </aside>
    <header className={styles.topBar}>
      <div className={styles.campaignSwitcher}><span>{activeView === "discovery" ? "全局自动发现" : VIEW_LABELS[activeView]}</span><strong>{activeView === "review" ? "统一客户库" : activeView === "discovery" ? `${activeBusinessCampaigns.length} 个运行中 Campaign` : "眼镜客户开发引擎"}</strong><small>{activeView === "discovery" ? "全局来源池核验后按各 Campaign 条件自动归类" : "私有环境 · 人工批准后进入 CRM"}</small></div>
      {activeView === "review" ? <div className={styles.summaryMetrics} aria-label="审核状态概览"><button type="button" className={statusFilter === "needs_review" ? styles.metricActive : ""} onClick={() => { state.setStatusFilter("needs_review"); state.setDrawerOpen(false); state.setPage(1); }}><span>待审核</span><b className={styles.metricBlue}>{counts.needs_review || 0}</b></button><button type="button" className={statusFilter === "rejected" ? styles.metricActive : ""} onClick={() => { state.setStatusFilter("rejected"); state.setDrawerOpen(false); state.setPage(1); }}><span>已淘汰</span><b className={styles.metricRed}>{rejectedCount}</b></button><button type="button" className={statusFilter === "approved" ? styles.metricActive : ""} onClick={() => { state.setStatusFilter("approved"); state.setDrawerOpen(false); state.setPage(1); }}><span>已批准</span><b className={styles.metricGreen}>{approvedCount}</b></button></div> : null}
    </header>
    {error ? <div className={styles.error} role="alert"><span>{error}</span><button type="button" aria-label="关闭错误提示" onClick={() => state.setError("")}><IconX size={18} /></button></div> : null}
    {notice ? <div className={styles.notice} role="status"><span>{notice}</span><button type="button" aria-label="关闭通知" onClick={() => state.setNotice("")}><IconX size={18} /></button></div> : null}
    {activeView === "discovery" ? <AutomaticDiscoveryView state={state} /> : null}
    {activeView === "review" ? <LeadReviewView state={state} /> : null}
    {activeView === "campaign" ? <CampaignView state={state} /> : null}
    {activeView === "export" ? <ExportView state={state} /> : null}
    {activeView === "advanced" ? <AdvancedToolsView state={state} /> : null}
  </main>;
}
