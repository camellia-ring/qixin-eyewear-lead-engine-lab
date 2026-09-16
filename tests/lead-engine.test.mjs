import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const uiFiles = [
  "../components/LeadEngineApp.tsx",
  "../components/lead-engine/AutomaticDiscoveryView.tsx",
  "../components/lead-engine/LeadReviewView.tsx",
  "../components/lead-engine/LeadReviewDrawer.tsx",
  "../components/lead-engine/CampaignView.tsx",
  "../components/lead-engine/ExportView.tsx",
  "../components/lead-engine/AdvancedToolsView.tsx",
  "../components/lead-engine/ImportAndReclassificationTools.tsx",
  "../components/lead-engine/ScopeMultiFilter.tsx",
  "../components/lead-engine/model.ts",
  "../hooks/useLeadEngineState.ts",
  "../hooks/useAutoDismiss.ts",
  "../hooks/useLeadReviewFilters.ts",
];

async function readLeadEngineUi() {
  return (await Promise.all(uiFiles.map((file) => readFile(new URL(file, import.meta.url), "utf8")))).join("\n");
}

test("builds the complete isolated Lead Engine shell", async () => {
  const [layout, page, ui] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readLeadEngineUi(),
  ]);
  assert.match(layout, /QIXIN Lead Engine Lab/);
  assert.match(page, /LeadEngineApp/);
  assert.match(ui, /全局自动找客户/);
  assert.match(ui, /私有环境 · 人工批准后进入 CRM/);
  assert.match(ui, /Campaign 管理/);
  assert.match(ui, /只有人工批准并通过准入门槛/);
  assert.match(ui, /开始自动找客户/);
  assert.doesNotMatch(`${layout}\n${page}\n${ui}`, /codex-preview|react-loading-skeleton|Your site is taking shape/i);
});

test("implements the normalized, evidence-first V1.2 model and treats imported verdicts as untrusted", async () => {
  const [schema, importRoute, importPolicy, workspaceRoute, reviewRoute, exportRoute, leadEngine, qualification] = await Promise.all([
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/import/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/import-policy.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/workspace/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/reviews/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/exports/crm/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/lead-engine.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/qualification.ts", import.meta.url), "utf8"),
  ]);
  for (const table of [
    "prospect_companies", "campaign_leads", "company_domains", "company_domain_links",
    "lead_sources", "evidence_claims", "lead_score_runs", "lead_score_dimensions",
    "lead_import_runs", "lead_review_decisions", "crm_export_runs", "crm_export_items", "crm_handoff_attempts",
  ]) assert.match(schema, new RegExp(table));
  assert.match(schema, /uq_campaign_lead_company/);
  assert.match(schema, /uq_lead_import_campaign_key/);
  assert.match(importRoute, /idempotencyKey/);
  assert.match(importRoute, /evidence_claim_required/);
  assert.match(importRoute, /score_reason_required/);
  assert.match(importRoute, /companyNamesLikelySame/);
  assert.match(importRoute, /importedLeadPendingVerification/);
  assert.match(importRoute, /claimType: "external_scope_input"/);
  assert.match(importRoute, /customerTypesJson: "\[\]"/);
  assert.match(importRoute, /productDirectionsJson: "\[\]"/);
  assert.match(importPolicy, /external_structured_assessment_untrusted/);
  assert.match(importPolicy, /hardGateStatus: "needs_review"/);
  assert.match(importPolicy, /currentScore: 0/);
  assert.match(workspaceRoute, /buildSearchKeywords/);
  assert.match(workspaceRoute, /researchBrief/);
  assert.match(reviewRoute, /approvalPolicyGaps/);
  assert.match(reviewRoute, /isCurrentServerVerification/);
  assert.match(reviewRoute, /observed_evidence_required/);
  assert.match(exportRoute, /workflowStatus, "approved"/);
  assert.match(exportRoute, /crmExportRuns/);
  assert.doesNotMatch(exportRoute, /fetch\(|CRM_API|Authorization/i);
  assert.match(leadEngine, /RUBRIC_VERSION = "qixin-v1\.2"/);
  assert.match(qualification, /MIN_EVIDENCE_COVERAGE = 55/);
  assert.match(leadEngine, /companyNamesLikelySame/);
  assert.match(leadEngine, /Local-language discovery/);
  assert.match(leadEngine, /observed \/ inferred \/ unknown/);
});

test("keeps Sites and storage isolated while CRM handoff uses the approved narrow contract", async () => {
  const [hosting, agents, packageJson, handoff, reviewRoute] = await Promise.all([
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
    readFile(new URL("../AGENTS.md", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../lib/crm-handoff.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/reviews/route.ts", import.meta.url), "utf8"),
  ]);
  const hostingConfig = JSON.parse(hosting);
  assert.equal(hostingConfig.project_id, "appgprj_6a7cee692ee48191bf4ce6ce38403734");
  assert.notEqual(hostingConfig.project_id, "appgprj_6a5a9a08d8048191994a626812231e80");
  assert.equal(hostingConfig.d1, "DB");
  assert.equal(hostingConfig.r2, null);
  assert.match(agents, /Do not directly access website D1\/R2/);
  assert.match(agents, /human-approved minimum customer handoff is the versioned, authenticated and idempotent production exception/);
  assert.match(handoff, /qixin\.approved-customer-handoff\.v2/);
  assert.match(handoff, /campaigns: Array/);
  assert.match(handoff, /discovery:/);
  assert.match(handoff, /CRM_HANDOFF_SECRET/);
  assert.match(handoff, /CRM_SITE_AUTH_TOKEN/);
  assert.match(handoff, /OAI-Sites-Authorization/);
  assert.match(handoff, /CUSTOMER_HTTP_WEBSITE_CRM/);
  assert.match(reviewRoute, /approvalPolicyGaps/);
  assert.match(reviewRoute, /sendCrmHandoff/);
  assert.match(reviewRoute, /crmHandoffAttempts/);
  assert.match(packageJson, /qixin-eyewear-lead-engine-lab/);
});

test("covers the complete broad eyewear scope in campaign research and CRM handoff", async () => {
  const [leadEngine, strategy, scope] = await Promise.all([
    readFile(new URL("../lib/lead-engine.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/campaign-strategy.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/customer-scope.ts", import.meta.url), "utf8"),
  ]);
  for (const [track, crmLabel] of [
    ["optical_frames", "Optical frames"],
    ["sunglasses", "Sunglasses"],
    ["reading_glasses", "Reading glasses"],
    ["blue_light_glasses", "Blue light glasses"],
    ["kids_eyewear", "Kids eyewear"],
    ["sports_eyewear", "Sports eyewear"],
    ["protective_eyewear", "Protective eyewear"],
    ["optical_lenses", "Optical lenses"],
    ["eyewear_accessories", "Eyewear accessories"],
  ]) {
    assert.match(scope, new RegExp(`${track}[\\s\\S]{0,500}${crmLabel}`));
    assert.match(strategy, new RegExp(`${track}:`));
  }
  for (const value of ["Brillenfassungen", "monturas ópticas", "oprawki okularowe", "إطارات نظارات طبية", "鼻托", "hinges", "cleaning"]) {
    assert.match(scope, new RegExp(value));
  }
  assert.match(leadEngine, /Local-language discovery/);
});

test("opens verified company websites safely without replacing evidence review", async () => {
  const ui = await readLeadEngineUi();
  assert.match(ui, /function companyWebsiteUrl/);
  assert.match(ui, /url\.protocol === "http:" \|\| url\.protocol === "https:"/);
  assert.match(ui, /target="_blank"/);
  assert.match(ui, /rel="noopener noreferrer"/);
  assert.match(ui, /查看证据与审核/);
});

test("uses simplified regional Campaigns, multi-label matching, and keeps outbound disabled", async () => {
  const [schema, campaignApi, membership, routing, leadsApi, strategyForm, ui] = await Promise.all([
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/campaigns/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/campaign-membership.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/campaign-routing.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/leads/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/CampaignStrategyForm.tsx", import.meta.url), "utf8"),
    readLeadEngineUi(),
  ]);
  for (const field of ["regionKey", "productTracksJson", "strategyPriority", "automationConfigJson", "customerTypesJson", "primaryCampaignId", "matchStatus"]) {
    assert.match(schema, new RegExp(field));
  }
  assert.match(campaignApi, /refreshAllCompanyCampaignMemberships/);
  assert.match(campaignApi, /routingChanged \? await refreshAllCompanyCampaignMemberships\(\) : null/);
  assert.match(membership, /db\.batch/);
  assert.doesNotMatch(membership, /for \(const company of companies\)[\s\S]{0,200}await refreshCompanyCampaignMemberships/);
  assert.match(routing, /campaignMatchesCompany/);
  assert.match(leadsApi, /primaryCampaignId/);
  assert.match(leadsApi, /productDirections/);
  assert.match(strategyForm, /产品赛道/);
  assert.match(strategyForm, /客户类型/);
  assert.match(strategyForm, /开发优先级/);
  assert.equal((strategyForm.match(/className=\{styles\.strategyChoiceActions\}/g) || []).length, 2);
  assert.match(ui, /aria-label="关闭通知"/);
  assert.match(ui, /8_000/);
  assert.match(ui, /AI 外联：尚未启用/);
  assert.doesNotMatch(`${campaignApi}\n${routing}`, /sendEmail|mailer|SMTP|resend\.emails/i);
});

test("loads review data page-by-page and keeps maintenance out of the primary mobile flow", async () => {
  const [workspace, leads, detail, ui, css] = await Promise.all([
    readFile(new URL("../app/api/workspace/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/leads/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/leads/[id]/route.ts", import.meta.url), "utf8"),
    readLeadEngineUi(),
    readFile(new URL("../components/LeadEngineApp.module.css", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(workspace, /leadScoreDimensions|evidenceClaims|prospectContacts/);
  assert.match(leads, /pageSize/);
  assert.match(leads, /statusCounts/);
  assert.match(leads, /selectedRegions/);
  assert.match(leads, /regions/);
  assert.match(detail, /scoreDimensions/);
  assert.match(detail, /inArray\(leadReviewDecisions\.leadId/);
  assert.match(ui, /高级工具/);
  assert.match(ui, /mobileLeadList/);
  assert.doesNotMatch(ui, /\/api\/discovery\/run-due|\/api\/exports\/leads/);
  assert.match(css, /grid-template-columns: repeat\(5/);
  assert.match(css, /safe-area-inset-bottom/);
  assert.match(ui, /审核通过并进入 CRM/);
  assert.match(css, /\.reviewDock \.approveButton \{ position: sticky/);
});

test("keeps desktop and mobile customer review on one continuous vertical scroll surface", async () => {
  const css = await readFile(new URL("../components/LeadEngineApp.module.css", import.meta.url), "utf8");
  assert.match(css, /\.reviewWorkspace\s*\{[^}]*overflow-y:\s*auto/s);
  assert.match(css, /\.tableFrame\s*\{[^}]*height:\s*auto[^}]*flex:\s*0 0 auto/s);
  assert.doesNotMatch(css, /\.tableFrame\s*\{[^}]*height:\s*min\(542px/s);
  assert.match(css, /@media \(max-width: 700px\)[\s\S]*\.mobileLeadList\s*\{[^}]*overflow:\s*visible/s);
});

test("puts review in a dedicated row action and opens a large stable review workspace", async () => {
  const [review, drawer, stateHook, css] = await Promise.all([
    readFile(new URL("../components/lead-engine/LeadReviewView.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/lead-engine/LeadReviewDrawer.tsx", import.meta.url), "utf8"),
    readFile(new URL("../hooks/useLeadEngineState.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/LeadEngineApp.module.css", import.meta.url), "utf8"),
  ]);
  assert.match(review, /<th className=\{styles\.actionColumn\}>操作<\/th>/);
  assert.match(review, /<td className=\{styles\.actionCell\}><button[^>]*className=\{styles\.evidenceButton\}/);
  assert.doesNotMatch(review, /className=\{styles\.companyCell\}[\s\S]{0,500}className=\{styles\.evidenceButton\}/);
  assert.match(drawer, /role="dialog" aria-modal="true"/);
  assert.match(css, /\.drawerBackdrop\s*\{[^}]*position:\s*fixed[^}]*inset:\s*0/s);
  assert.match(css, /\.drawer\s*\{[^}]*width:\s*min\(1180px[^}]*height:\s*min\(880px/s);
  assert.match(css, /\.evidenceButton\s*\{[^}]*min-height:\s*42px/s);
  assert.match(stateHook, /workspace\.engineState\?\.status !== "running" \|\| drawerOpen/);
  assert.doesNotMatch(stateHook, /void load\(true\);\s*if \(!drawerOpen\)/);
  assert.match(stateHook, /\[drawerOpen, load, workspace\.engineState\?\.status\]/);
});

test("keeps large multi-select filters within the D1 bind limit and reports missing schemas precisely", async () => {
  const [leadsRoute, api] = await Promise.all([
    readFile(new URL("../app/api/leads/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/api.ts", import.meta.url), "utf8"),
  ]);
  assert.match(leadsRoute, /IN \(SELECT value FROM json_each\(\$\{JSON\.stringify\(selected\)\}\)\)/);
  assert.doesNotMatch(leadsRoute, /selected\.map\(\(value\) => eq\(column, value\)\)/);
  assert.ok(api.includes("no such table:\\s*"));
  assert.doesNotMatch(api, /no such table\|prospect_companies/);
});

test("reviews the unified customer library by multi-select evidence dimensions rather than Campaign", async () => {
  const [review, stylesheet, stateHook, filters, scopeFilter, leadsRoute] = await Promise.all([
    readFile(new URL("../components/lead-engine/LeadReviewView.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/LeadEngineApp.module.css", import.meta.url), "utf8"),
    readFile(new URL("../hooks/useLeadEngineState.ts", import.meta.url), "utf8"),
    readFile(new URL("../hooks/useLeadReviewFilters.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/lead-engine/ScopeMultiFilter.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/leads/route.ts", import.meta.url), "utf8"),
  ]);
  for (const label of ["客户范围", "地区", "国家", "客户类型", "产品分类"]) assert.match(review, new RegExp(label));
  assert.match(review, /统一客户库每家公司只显示一次/);
  assert.doesNotMatch(review, /<h1>[^<]*(?:未审核|已审核)客户<\/h1>/);
  assert.match(review, /data-status=\{lead\.workflowStatus\}/);
  assert.match(stylesheet, /\.reviewStateToggle\s*\{[^}]*background:\s*#fff;/s);
  assert.match(stylesheet, /\.reviewStateToggle\[aria-pressed="true"\]\s*\{[^}]*background:\s*var\(--blue-soft\);/s);
  assert.match(stylesheet, /\.statusBadge\[data-status="approved"\][^{]*\{[^}]*background:\s*#e7f6ec;[^}]*color:\s*#1f7a43;/s);
  assert.match(stylesheet, /\.statusBadge\[data-status="rejected"\][^{]*\{[^}]*background:\s*#fee9e7;[^}]*color:\s*#b93a31;/s);
  assert.match(stylesheet, /\.statusBadge\s*\{[^}]*background:\s*#eaf2ff;[^}]*color:\s*var\(--blue\);/s);
  assert.doesNotMatch(stylesheet, /data-status="needs_review"/);
  assert.doesNotMatch(review, /reviewCampaignId|setReviewCampaignId|切换 Campaign|这个 Campaign/);
  assert.doesNotMatch(stateHook, /parameters\.set\("campaignId", reviewCampaignId\)/);
  assert.match(filters, /regionFilter/);
  assert.match(filters, /reviewState/);
  assert.doesNotMatch(filters, /statusFilter/);
  assert.match(filters, /typeFilters/);
  assert.match(filters, /productFilters/);
  assert.match(scopeFilter, />全选</);
  assert.match(scopeFilter, />清空</);
  assert.match(stateHook, /parameters\.append\("customerType"/);
  assert.match(stateHook, /parameters\.append\("productDirection"/);
  assert.match(leadsRoute, /json_each/);
  assert.match(leadsRoute, /reviewState === "unreviewed"/);
  assert.match(leadsRoute, /isNull\(campaignLeads\.reviewedAt\)/);
  assert.match(leadsRoute, /isNotNull\(campaignLeads\.reviewedAt\)/);
  assert.match(review, /reviewState === "unreviewed" \? "未审核" : "已审核"/);
  assert.doesNotMatch(review, /STATUS_FILTERS/);
});

test("keeps Campaign classification separate from qualification and human review", async () => {
  const [qualification, reviewRoute, assignRoute, membership, reverify, stateHook, drawer] = await Promise.all([
    readFile(new URL("../lib/qualification.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/reviews/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/leads/[id]/assign/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/campaign-membership.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/reverification.ts", import.meta.url), "utf8"),
    readFile(new URL("../hooks/useLeadEngineState.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/lead-engine/LeadReviewDrawer.tsx", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(`${qualification}\n${reviewRoute}`, /campaignAssigned|assign_campaign_before_approval/);
  assert.doesNotMatch(assignRoute, /productTrack:|qualificationResult:|hardGateStatus:|hardGateReason:|riskSummary:/);
  assert.doesNotMatch(membership, /qualificationResult: unassigned|hardGateStatus: unassigned|riskSummary: unassigned/);
  assert.match(membership, /reviewedBy: template\.reviewedBy/);
  assert.match(membership, /reviewedAt: template\.reviewedAt/);
  assert.match(reverify, /lead\.reviewedAt \? lead\.workflowStatus : "needs_review"/);
  assert.match(reverify, /ne\(campaignLeads\.matchStatus, "stale"\)/);
  assert.match(stateHook, /autoReverifyAttemptedRef\.current\.has/);
  assert.match(stateHook, /autoReverifyAttemptedRef\.current\.has\(detail\.company\.id\)/);
  assert.match(stateHook, /data\.rows\.find\(\(row\) => row\.companyId === selectedCompanyIdRef\.current\)/);
  assert.match(stateHook, /drawerOpenRef\.current && current \? current/);
  assert.match(stateHook, /\[drawerOpen, selectedLeadId\]/);
  assert.match(drawer, /资料核验完成，可以进行最终审核；当前仍为未审核。/);
  assert.match(drawer, /并非由 Campaign 发起发现/);
});

test("provides a dry-run exact-whitelist correction without deleting audit history", async () => {
  const [correction, route] = await Promise.all([
    readFile(new URL("../lib/assignment-correction.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/maintenance/assignment-correction/route.ts", import.meta.url), "utf8"),
  ]);
  for (const id of [
    "b1e76e7d-03e0-4dbe-8da5-73cd374de293",
    "70af4f2c-d7f2-4873-8921-33738f5e3205",
    "506a8af3-8689-444c-b57b-dedfa8aec1ae",
    "6dffce24-4688-495a-ab20-49b2f615657e",
  ]) assert.match(correction, new RegExp(id));
  assert.match(correction, /exactWhitelistSize/);
  assert.match(correction, /refreshCompanyCampaignMemberships/);
  assert.match(correction, /错误人工归属已转为历史/);
  assert.match(correction, /VISIONLAND_HANDOFF_ID/);
  assert.doesNotMatch(correction, /\.delete\(/);
  assert.match(route, /export async function GET/);
  assert.match(route, /body\.apply !== true/);
});

test("provides a read-only historical reclassification dry run", async () => {
  const [route, report, tools] = await Promise.all([
    readFile(new URL("../app/api/reclassification/dry-run/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/reclassification-dry-run.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/lead-engine/ImportAndReclassificationTools.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(route, /export async function GET/);
  assert.doesNotMatch(route, /\.insert\(|\.update\(|\.delete\(/);
  assert.match(report, /mode: "read_only"/);
  assert.match(report, /没有访问官网、没有改写评分/);
  assert.match(tools, /只读重分类预演/);
});

test("keeps each primary workspace in an independent component with client state hooks", async () => {
  const [shell, stateHook, dismissHook, filterHook] = await Promise.all([
    readFile(new URL("../components/LeadEngineApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../hooks/useLeadEngineState.ts", import.meta.url), "utf8"),
    readFile(new URL("../hooks/useAutoDismiss.ts", import.meta.url), "utf8"),
    readFile(new URL("../hooks/useLeadReviewFilters.ts", import.meta.url), "utf8"),
  ]);
  for (const component of ["AutomaticDiscoveryView", "LeadReviewView", "CampaignView", "ExportView", "AdvancedToolsView"]) {
    assert.match(shell, new RegExp(component));
  }
  assert.match(stateHook, /export function useLeadEngineState/);
  assert.match(dismissHook, /export function useAutoDismiss/);
  assert.match(filterHook, /export function useLeadReviewFilters/);
  assert.ok(shell.split(/\r?\n/).length < 100, "LeadEngineApp should remain a small composition shell");
});

test("provides a repeatable D1-compatible Campaign save benchmark", async () => {
  const [packageJson, benchmark, baseline] = await Promise.all([
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../scripts/benchmark-campaign-save.mjs", import.meta.url), "utf8"),
    readFile(new URL("../docs/performance/campaign-save-d1-baseline.md", import.meta.url), "utf8"),
  ]);
  assert.match(packageJson, /bench:campaign-save/);
  assert.match(benchmark, /campaignMatchesCompany/);
  assert.match(benchmark, /Math\.ceil\(operations\.length \/ 80\)/);
  assert.match(benchmark, /p50Ms/);
  assert.match(benchmark, /p95Ms/);
  assert.match(baseline, /5,000/);
  assert.match(baseline, /不是线上延迟声明/);
});
