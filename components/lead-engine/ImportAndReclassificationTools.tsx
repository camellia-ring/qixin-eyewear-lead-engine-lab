import { IconRadar, IconShieldLock, IconUpload } from "@tabler/icons-react";
import type { LeadEngineState } from "@/hooks/useLeadEngineState";
import { formatDate } from "./model";
import styles from "../LeadEngineApp.module.css";

export function ImportAndReclassificationTools({ state }: { state: LeadEngineState }) {
  const {
    activeCampaign,
    activeCampaignId,
    campaignLabel,
    importReport,
    pending,
    reclassificationDryRun,
    workspace,
  } = state;
  const importRuns = workspace.imports.filter((run) => run.campaignId === activeCampaignId).slice(0, 8);

  return <details className={styles.advancedSection}>
    <summary><span><IconUpload size={20} />外部数据导入、服务器核验与历史 dry-run</span><small>外部结论默认不受信任</small></summary>
    <div className={styles.toolGrid}>
      <section className={styles.toolSection}>
        <h2>导入到所选 Campaign</h2>
        <p className={styles.muted}>{campaignLabel}</p>
        <p className={styles.muted}>外部 hard gate、评分和覆盖率只保存为审计输入。新记录统一进入待审核，必须先用服务器重新核验官网、角色、产品、评分和 55% 覆盖率。</p>
        <div className={styles.templateLinks}><a href="/qixin-lead-engine-template.csv" download>下载 CSV 模板</a><a href="/qixin-lead-engine-template.json" download>下载 JSON 模板</a></div>
        <form className={styles.importForm} onSubmit={state.importFile}>
          <label className={styles.fileField}>选择外部研究或恢复文件<input name="file" type="file" accept=".csv,.json,text/csv,application/json" required disabled={!activeCampaignId || activeCampaign?.status !== "active" || pending} /></label>
          <button className={styles.primaryButton} type="submit" disabled={!activeCampaignId || activeCampaign?.status !== "active" || pending}>{pending ? "正在处理…" : activeCampaign?.status !== "active" ? "先把 Campaign 设为运行中" : "导入并标记待服务器核验"}</button>
        </form>
        {importReport ? <div className={styles.importReport}><b>写入 {importReport.imported} 条待核验记录，跳过 {importReport.skipped} 条</b>{importReport.results?.filter((item) => item.status !== "imported").slice(0, 5).map((item) => <span key={String(item.row)}>第 {String(item.row)} 行：{String(item.error || item.status)}</span>)}</div> : null}
      </section>

      <section className={styles.toolSection}>
        <h2>导入审计</h2>
        <div className={styles.auditList}>{importRuns.map((run) => <article key={run.id}><div><b>{run.originalFilename || "结构化导入"}</b><span>{formatDate(run.createdAt)}</span></div><strong>{run.importedCount}/{run.rowCount} 写入</strong></article>)}{!importRuns.length ? <p className={styles.muted}>尚无导入记录。</p> : null}</div>
        <div className={styles.guardrails}><b><IconShieldLock size={18} />明确禁止</b><span>信任外部 pass 或 Agent 评分</span><span>无授权搜索或额度消耗</span><span>邮箱猜测与自动补全</span><span>自动生成或发送开发信</span><span>直接写生产 CRM</span></div>
      </section>

      <section className={[styles.toolSection, styles.fieldWide].join(" ")}>
        <div className={styles.sectionTitleRow}><div><h2><IconRadar size={20} />rejected / near_match 客户只读重分类预演</h2><p className={styles.muted}>只读取现有标签和摘要，不访问官网、不重评分、不修改状态、Campaign、证据或审核历史。</p></div><button className={styles.secondaryButton} type="button" disabled={pending} onClick={() => void state.loadReclassificationDryRun()}>生成 dry-run 报告</button></div>
        {reclassificationDryRun ? <div className={styles.dryRunReport}>
          <div className={styles.runMetrics}><span>纳入 <b>{reclassificationDryRun.considered}</b></span><span>可能候选 <b>{reclassificationDryRun.possibleCandidates}</b></span><span>需人工确认 <b>{reclassificationDryRun.manualReview}</b></span><span>仍排除 <b>{reclassificationDryRun.stillExcluded}</b></span><span>重复 <b>{reclassificationDryRun.duplicates}</b></span></div>
          <div className={styles.dryRunColumns}>
            <article><b>主要新增商业角色</b><p>{reclassificationDryRun.topBusinessRoles.map((item) => `${item.label} ${item.count}`).join(" · ") || "现有记录未识别"}</p></article>
            <article><b>主要新增产品方向</b><p>{reclassificationDryRun.topProductDirections.map((item) => `${item.label} ${item.count}`).join(" · ") || "现有记录未识别"}</p></article>
            <article><b>仍被排除的原因</b><p>{reclassificationDryRun.topExclusionReasons.map((item) => `${item.label} ${item.count}`).join(" · ") || "无明确排除原因"}</p></article>
          </div>
          <p className={styles.muted}>{reclassificationDryRun.limitations}</p>
        </div> : <p className={styles.muted}>尚未生成报告。此入口永远不会批量重新核验或改写生产历史客户。</p>}
      </section>
    </div>
  </details>;
}
