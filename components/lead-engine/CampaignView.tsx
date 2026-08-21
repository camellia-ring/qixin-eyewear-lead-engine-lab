import { IconPlus, IconTargetArrow } from "@tabler/icons-react";
import CampaignStrategyForm from "@/components/CampaignStrategyForm";
import type { LeadEngineState } from "@/hooks/useLeadEngineState";
import { STATUS_LABELS, VIEW_LABELS } from "./model";
import styles from "../LeadEngineApp.module.css";

export function CampaignView({ state }: { state: LeadEngineState }) {
  const { activeCampaign, activeCampaignId, businessCampaigns, campaignLabel, pending, workspace } = state;
  return <section className={styles.toolWorkspace} aria-label={VIEW_LABELS.campaign}>
    <div className={styles.toolHeader}><div><span className={styles.sectionKicker}>REGIONAL AI STRATEGY</span><h1>Campaign 管理</h1><p>Campaign 是一套区域开发策略：决定 AI 去哪里找、优先开发什么渠道，以及客户如何自动归类。公司资料、MOQ、规模和定位由 AI 标注在客户库，不再要求你建 Campaign 时填写。</p></div><IconTargetArrow size={34} /></div>
    <div className={styles.toolGrid}>
      <section className={styles.toolSection}>
        <h2>编辑 Campaign</h2>
        <label className={styles.field}>选择 Campaign<select value={activeCampaignId} onChange={(event) => state.setActiveCampaignId(event.target.value)}><option value="">尚未创建 Campaign</option>{businessCampaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}</select></label>
        {activeCampaign ? <>
          <div className={styles.campaignOverview}><div><span>策略</span><b>{activeCampaign.name}</b></div><div><span>范围</span><b>{campaignLabel}</b></div><div><span>状态</span><b>{STATUS_LABELS[activeCampaign.status] || activeCampaign.status}</b></div><div><span>客户记录</span><b>{workspace.leadCounts[activeCampaign.id]?.all || 0} 家</b></div></div>
          <label className={styles.field}>Campaign 状态<select value={activeCampaign.status} disabled={pending} onChange={(event) => void state.changeCampaignStatus(event.target.value)}><option value="draft">草稿</option><option value="active">运行中</option><option value="paused">暂停</option><option value="completed">已完成</option></select></label>
          <div className={styles.automationState}><b>AI 外联：尚未启用</b><span>当前自动化只覆盖公开来源发现、证据核验、客户标签与 Campaign 归类。回复即停、退信即停、退订即停等规则已预留；发信身份、频率和合规边界确认前不会发送邮件。</span></div>
          <details className={styles.formDisclosure} open><summary>编辑区域策略</summary><form className={styles.formGrid} onSubmit={state.updateCampaign} key={activeCampaign.id}><CampaignStrategyForm campaign={activeCampaign} /><button className={styles.primaryButton} type="submit" disabled={pending}>保存并重新匹配客户</button></form></details>
        </> : <p className={styles.muted}>尚未创建 Campaign。</p>}
      </section>
      <section className={styles.toolSection}><h2><IconPlus size={20} /> 新建 Campaign</h2><p className={styles.muted}>只选区域、产品、客户类型和优先级。名称、检索词与研究任务书由系统生成。</p><form className={styles.formGrid} onSubmit={state.createCampaign} key={`create-${businessCampaigns.length}`}><CampaignStrategyForm /><button className={styles.primaryButton} type="submit" disabled={pending}>创建 Campaign 草稿</button></form></section>
    </div>
  </section>;
}
