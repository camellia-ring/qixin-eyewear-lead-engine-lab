import { and, desc, eq, ne } from "drizzle-orm";
import { getDb } from "@/db";
import {
  campaignLeads,
  campaigns,
  crmHandoffAttempts,
  leadReviewDecisions,
  prospectCompanies,
} from "@/db/schema";
import { refreshCompanyCampaignMemberships } from "@/lib/campaign-membership";
import { buildApprovedCrmHandoff, loadCrmHandoffContext } from "@/lib/crm-handoff-context";
import { CRM_HANDOFF_CONTRACT_VERSION, sendCrmHandoff } from "@/lib/crm-handoff";

const CORRECTION_KEY = "assignment-correction:2026-08-27";
const VISIONLAND_COMPANY_ID = "5771bef4-6347-4d2a-a993-5788493f8814";
const VISIONLAND_HANDOFF_ID = `${CORRECTION_KEY}:visionland-crm-v2`;

export const EXPECTED_ASSIGNMENT_CORRECTIONS = [
  {
    decisionId: "b1e76e7d-03e0-4dbe-8da5-73cd374de293",
    leadId: "01a268d8-44b1-4ec1-8f5f-16ef344f3199",
    companyId: VISIONLAND_COMPANY_ID,
    campaignId: "c4d686a7-344c-434c-b50a-6e1e6358f0bd",
    createdAt: "2026-08-26 15:54:42",
    notes: "从待分配人工分配到 Campaign：欧洲 · Poland",
  },
  {
    decisionId: "70af4f2c-d7f2-4873-8921-33738f5e3205",
    leadId: "6225c754-7339-459a-aa5e-a2c28fa261d3",
    companyId: "5660909f-6a6a-41b3-a276-78005f47cbfd",
    campaignId: "587ffec3-fbff-4af2-b192-692a622fd13d",
    createdAt: "2026-08-26 16:02:29",
    notes: "从待分配人工分配到 Campaign：欧洲 · United Kingdom / Germany",
  },
  {
    decisionId: "506a8af3-8689-444c-b57b-dedfa8aec1ae",
    leadId: "a4fb049e-9ffb-4cf9-add5-06c8a5bb8346",
    companyId: "e8b88211-6ecd-48bd-8165-66fc134b6566",
    campaignId: "587ffec3-fbff-4af2-b192-692a622fd13d",
    createdAt: "2026-08-26 16:02:51",
    notes: "从待分配人工分配到 Campaign：欧洲 · United Kingdom / Germany",
  },
  {
    decisionId: "6dffce24-4688-495a-ab20-49b2f615657e",
    leadId: "d0ce2a26-802f-42e6-a409-26cd3d35b06b",
    companyId: "efbce4ee-b5a8-4c51-b925-7003ed2df6e8",
    campaignId: "587ffec3-fbff-4af2-b192-692a622fd13d",
    createdAt: "2026-08-26 16:03:08",
    notes: "从待分配人工分配到 Campaign：欧洲 · United Kingdom / Germany",
  },
] as const;

function auditNote(decisionId: string) {
  return `[${CORRECTION_KEY}:${decisionId}] 错误人工归属已转为历史；已重新运行证据自动归类。`;
}

async function inspectCorrection(expected: typeof EXPECTED_ASSIGNMENT_CORRECTIONS[number]) {
  const db = getDb();
  const [decisionRows, leadRows, companyRows, campaignRows, auditRows] = await Promise.all([
    db.select().from(leadReviewDecisions).where(eq(leadReviewDecisions.id, expected.decisionId)).limit(1),
    db.select().from(campaignLeads).where(eq(campaignLeads.id, expected.leadId)).limit(1),
    db.select().from(prospectCompanies).where(eq(prospectCompanies.id, expected.companyId)).limit(1),
    db.select().from(campaigns).where(eq(campaigns.id, expected.campaignId)).limit(1),
    db.select().from(leadReviewDecisions).where(eq(leadReviewDecisions.notes, auditNote(expected.decisionId))).limit(1),
  ]);
  const decision = decisionRows[0];
  const lead = leadRows[0];
  const company = companyRows[0];
  const campaign = campaignRows[0];
  const issues: string[] = [];
  if (!decision) issues.push("decision_missing");
  if (decision && (decision.leadId !== expected.leadId || decision.decision !== "needs_review"
    || decision.notes !== expected.notes || decision.createdAt !== expected.createdAt)) issues.push("decision_mismatch");
  if (!lead) issues.push("lead_missing");
  if (lead && (lead.companyId !== expected.companyId || lead.campaignId !== expected.campaignId)) issues.push("lead_scope_mismatch");
  if (lead && (lead.assignmentType !== "manual" || !new Set(["manual", "stale"]).has(lead.matchStatus))) issues.push("membership_state_mismatch");
  if (!company) issues.push("company_missing");
  if (!campaign) issues.push("campaign_missing");
  return {
    decisionId: expected.decisionId,
    leadId: expected.leadId,
    companyId: expected.companyId,
    companyName: company?.companyName || null,
    country: company?.country || null,
    campaignId: expected.campaignId,
    campaignName: campaign?.name || null,
    originalCreatedAt: expected.createdAt,
    status: issues.length ? "mismatch" : auditRows.length ? "already_corrected" : "ready",
    issues,
    currentMembershipStatus: lead?.matchStatus || null,
  };
}

export async function getAssignmentCorrectionPreview() {
  const rows = await Promise.all(EXPECTED_ASSIGNMENT_CORRECTIONS.map(inspectCorrection));
  return {
    mode: "dry_run" as const,
    correctionKey: CORRECTION_KEY,
    exactWhitelistSize: EXPECTED_ASSIGNMENT_CORRECTIONS.length,
    readyToApply: rows.every((row) => row.status !== "mismatch"),
    rows,
  };
}

async function correctMembership(expected: typeof EXPECTED_ASSIGNMENT_CORRECTIONS[number]) {
  const db = getDb();
  const inspected = await inspectCorrection(expected);
  if (inspected.status === "mismatch") throw new Error(`assignment_correction_mismatch:${expected.decisionId}:${inspected.issues.join(",")}`);
  if (inspected.status === "already_corrected") return { ...inspected, applied: false };

  const [lead] = await db.select().from(campaignLeads).where(eq(campaignLeads.id, expected.leadId)).limit(1);
  const [company] = await db.select().from(prospectCompanies).where(eq(prospectCompanies.id, expected.companyId)).limit(1);
  if (!lead || !company) throw new Error(`assignment_correction_target_missing:${expected.decisionId}`);
  const now = new Date().toISOString();
  const reasonWasCampaignOnly = /^人工依据证据分配到 Campaign：/.test(lead.hardGateReason || "");
  const riskWasCampaignOnly = /Campaign|人工分配|待分配/.test(lead.riskSummary || "");
  await db.update(campaignLeads).set({
    matchStatus: "stale",
    matchReason: `错误人工归属已撤销并保留为历史；原审计 ${expected.decisionId}`,
    hardGateReason: reasonWasCampaignOnly
      ? (company.analysisSummary || "强制准入结果来自企业证据；Campaign 不参与准入。").slice(0, 3000)
      : lead.hardGateReason,
    riskSummary: riskWasCampaignOnly
      ? "原错误 Campaign 前置提示已移除；Campaign 不参与准入或人工审核结果。"
      : lead.riskSummary,
    updatedAt: now,
  }).where(and(
    eq(campaignLeads.id, expected.leadId),
    eq(campaignLeads.companyId, expected.companyId),
    eq(campaignLeads.campaignId, expected.campaignId),
  ));
  const campaignRefresh = await refreshCompanyCampaignMemberships(expected.companyId);
  await db.insert(leadReviewDecisions).values({
    id: crypto.randomUUID(),
    leadId: expected.leadId,
    decision: "needs_review",
    notes: auditNote(expected.decisionId),
    decidedBy: "system:assignment-correction",
    createdAt: now,
  });
  return { ...await inspectCorrection(expected), applied: true, campaignRefresh };
}

async function synchronizeVisionlandToCrm() {
  const db = getDb();
  const companyLeads = await db.select().from(campaignLeads)
    .where(and(eq(campaignLeads.companyId, VISIONLAND_COMPANY_ID), ne(campaignLeads.matchStatus, "stale")))
    .orderBy(desc(campaignLeads.reviewedAt), desc(campaignLeads.updatedAt));
  const lead = companyLeads.find((item) => item.workflowStatus === "approved" && item.reviewedAt);
  const [company] = await db.select().from(prospectCompanies)
    .where(eq(prospectCompanies.id, VISIONLAND_COMPANY_ID)).limit(1);
  if (!lead || !company) throw new Error("visionland_approved_customer_missing");

  const context = await loadCrmHandoffContext(company, lead);
  const payload = buildApprovedCrmHandoff({
    company,
    lead,
    context,
    handoffId: VISIONLAND_HANDOFF_ID,
    approvedAt: lead.reviewedAt!,
    reviewNotes: "Campaign 误归属已纠正；CRM 客户身份、阶段与业务记录保持不变。",
  });
  const [existingAttempt] = await db.select().from(crmHandoffAttempts)
    .where(eq(crmHandoffAttempts.handoffId, VISIONLAND_HANDOFF_ID)).limit(1);
  if (existingAttempt?.status === "succeeded") {
    return { status: "already_synchronized" as const, customerId: existingAttempt.customerId };
  }
  const attemptId = existingAttempt?.id || crypto.randomUUID();
  if (existingAttempt) {
    await db.update(crmHandoffAttempts).set({
      leadId: lead.id,
      contractVersion: CRM_HANDOFF_CONTRACT_VERSION,
      payloadJson: JSON.stringify(payload),
      status: "pending",
      errorMessage: null,
      updatedAt: new Date().toISOString(),
    }).where(eq(crmHandoffAttempts.id, attemptId));
  } else {
    await db.insert(crmHandoffAttempts).values({
      id: attemptId,
      handoffId: VISIONLAND_HANDOFF_ID,
      leadId: lead.id,
      companyId: company.id,
      contractVersion: CRM_HANDOFF_CONTRACT_VERSION,
      payloadJson: JSON.stringify(payload),
    });
  }
  try {
    const result = await sendCrmHandoff(payload);
    await db.update(crmHandoffAttempts).set({
      status: "succeeded",
      httpStatus: result.httpStatus,
      responseCode: result.status,
      customerId: result.customerId,
      errorMessage: null,
      updatedAt: new Date().toISOString(),
    }).where(eq(crmHandoffAttempts.id, attemptId));
    return result;
  } catch (error) {
    const failure = error as Error & { httpStatus?: number; responseCode?: string | null };
    await db.update(crmHandoffAttempts).set({
      status: "failed",
      httpStatus: failure.httpStatus || null,
      responseCode: failure.responseCode || null,
      errorMessage: failure.message.slice(0, 1000),
      updatedAt: new Date().toISOString(),
    }).where(eq(crmHandoffAttempts.id, attemptId));
    throw error;
  }
}

export async function applyAssignmentCorrections() {
  const preview = await getAssignmentCorrectionPreview();
  if (!preview.readyToApply) {
    const mismatches = preview.rows.filter((row) => row.status === "mismatch")
      .map((row) => `${row.decisionId}:${row.issues.join(",")}`).join(";");
    throw new Error(`assignment_correction_preflight_failed:${mismatches}`);
  }
  const rows = [];
  for (const expected of EXPECTED_ASSIGNMENT_CORRECTIONS) rows.push(await correctMembership(expected));
  const crmHandoff = await synchronizeVisionlandToCrm();
  return { mode: "applied" as const, correctionKey: CORRECTION_KEY, rows, crmHandoff };
}
