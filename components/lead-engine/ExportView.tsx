import { IconDownload, IconFileExport } from "@tabler/icons-react";
import type { LeadEngineState } from "@/hooks/useLeadEngineState";
import { formatDate, VIEW_LABELS } from "./model";
import styles from "../LeadEngineApp.module.css";

export function ExportView({ state }: { state: LeadEngineState }) {
  const { businessCampaigns, exportApprovedCount, exportCampaignId, pending, workspace } = state;
  const audit = workspace.exports.filter((run) => run.campaignId === exportCampaignId);
  return <section className={styles.toolWorkspace} aria-label={VIEW_LABELS.export}>
    <div className={styles.toolHeader}><div><span className={styles.sectionKicker}>CONTROLLED CRM HANDOFF</span><h1>CRM 导出</h1><p>只有人工批准并通过准入门槛的公司才能生成兼容文件。</p></div><IconFileExport size={34} /></div>
    <label className={styles.contextPicker}>导出 Campaign<select value={exportCampaignId} onChange={(event) => state.setExportCampaignId(event.target.value)}><option value="">请选择 Campaign</option>{businessCampaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}</select></label>
    <section className={styles.exportPanel}><div className={styles.exportCount}><span>当前可导出</span><b>{exportApprovedCount}</b><small>家已批准客户</small></div><div className={styles.exportCopy}><h2>{exportApprovedCount ? "导出已批准客户" : "暂无可导出客户"}</h2><p>导出只生成 CRM 兼容 CSV 并记录批次，不会调用或写入生产 CRM。下载后仍需人工确认导入。</p><button className={styles.primaryButton} type="button" disabled={!exportApprovedCount || pending} onClick={() => void state.exportApproved()}><IconDownload size={18} />导出 {exportApprovedCount} 家已批准客户</button></div></section>
    <section className={styles.toolSection}><h2>导出审计</h2><div className={styles.auditList}>{audit.map((run) => <article key={run.id}><div><b>CRM 兼容 CSV</b><span>{formatDate(run.createdAt)}</span></div><strong>{run.rowCount} 家</strong></article>)}{!audit.length ? <p className={styles.muted}>尚无导出记录。</p> : null}</div></section>
  </section>;
}
