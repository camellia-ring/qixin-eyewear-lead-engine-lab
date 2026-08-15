import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  campaigns,
  campaignLeads,
  leadScoreDimensions,
  leadScoreRuns,
  prospectCompanies,
} from "@/db/schema";
import {
  campaignMatchesCompany,
  campaignProductTracks,
  UNASSIGNED_CAMPAIGN_ID,
} from "@/lib/campaign-routing";
import { ensureUnassignedCampaign } from "@/lib/system-campaign";

function matchReason(campaign: typeof campaigns.$inferSelect, company: typeof prospectCompanies.$inferSelect) {
  const products = campaignProductTracks(campaign).join(", ");
  return `证据标签匹配：${company.country || "国家待核验"}；${products}；${company.customerType || "客户类型待核验"}`;
}

async function cloneLatestScoreRun(templateLeadId: string, leadId: string) {
  const db = getDb();
  const [scoreRun] = await db.select().from(leadScoreRuns)
    .where(eq(leadScoreRuns.leadId, templateLeadId)).orderBy(desc(leadScoreRuns.createdAt)).limit(1);
  if (!scoreRun) return;
  const dimensions = await db.select().from(leadScoreDimensions).where(eq(leadScoreDimensions.scoreRunId, scoreRun.id));
  const scoreRunId = crypto.randomUUID();
  await db.insert(leadScoreRuns).values({
    id: scoreRunId,
    leadId,
    rubricVersion: scoreRun.rubricVersion,
    totalScore: scoreRun.totalScore,
    grade: scoreRun.grade,
    evidenceCoverage: scoreRun.evidenceCoverage,
    overallConfidence: scoreRun.overallConfidence,
    modelIdentifier: `${scoreRun.modelIdentifier}:campaign_rematch`,
  });
  if (dimensions.length) {
    const inserts = dimensions.map((dimension) => db.insert(leadScoreDimensions).values({
      id: crypto.randomUUID(),
      scoreRunId,
      dimension: dimension.dimension,
      score: dimension.score,
      maxScore: dimension.maxScore,
      positiveReason: dimension.positiveReason,
      negativeReason: dimension.negativeReason,
      evidenceIdsJson: dimension.evidenceIdsJson,
    }));
    await db.batch([inserts[0], ...inserts.slice(1)]);
  }
}

async function createMembership(
  campaign: typeof campaigns.$inferSelect,
  company: typeof prospectCompanies.$inferSelect,
  template: typeof campaignLeads.$inferSelect,
  assignmentType: "automatic" | "system",
) {
  const db = getDb();
  const leadId = crypto.randomUUID();
  const unassigned = campaign.id === UNASSIGNED_CAMPAIGN_ID;
  const now = new Date().toISOString();
  await db.insert(campaignLeads).values({
    id: leadId,
    campaignId: campaign.id,
    companyId: company.id,
    qualificationResult: unassigned && template.qualificationResult === "qualified" ? "near_match" : template.qualificationResult,
    workflowStatus: template.workflowStatus,
    productTrack: campaignProductTracks(campaign)[0] || template.productTrack,
    recommendedProductsJson: template.recommendedProductsJson,
    riskSummary: unassigned
      ? "客户资料已进入全局客户库，但没有可靠匹配运行中的区域 Campaign；需要补充标签或人工分配。"
      : template.riskSummary,
    hardGateStatus: unassigned && template.hardGateStatus === "pass" ? "needs_review" : template.hardGateStatus,
    hardGateReason: unassigned ? "未可靠匹配任何运行中的区域 Campaign" : template.hardGateReason,
    currentScore: template.currentScore,
    grade: template.grade,
    evidenceCoverage: template.evidenceCoverage,
    scoreConfidence: template.scoreConfidence,
    autoQualifiedAt: template.autoQualifiedAt,
    lastVerifiedAt: template.lastVerifiedAt,
    assignmentType,
    matchStatus: unassigned ? "unassigned" : "current",
    matchReason: unassigned ? "没有匹配的运行中区域策略" : matchReason(campaign, company),
    matchedAt: now,
  });
  await cloneLatestScoreRun(template.id, leadId);
  return leadId;
}

export async function refreshCompanyCampaignMemberships(companyId: string) {
  const db = getDb();
  const unassignedCampaign = await ensureUnassignedCampaign();
  const [company, activeCampaigns, memberships] = await Promise.all([
    db.select().from(prospectCompanies).where(eq(prospectCompanies.id, companyId)).limit(1).then((rows) => rows[0]),
    db.select().from(campaigns).where(eq(campaigns.status, "active")),
    db.select().from(campaignLeads).where(eq(campaignLeads.companyId, companyId)).orderBy(desc(campaignLeads.currentScore)),
  ]);
  if (!company || !memberships.length) return { companyId, matchedCampaignIds: [] as string[], added: 0, stale: 0 };
  const businessCampaigns = activeCampaigns.filter((campaign) => campaign.id !== UNASSIGNED_CAMPAIGN_ID);
  const matched = businessCampaigns
    .filter((campaign) => campaignMatchesCompany(campaign, company))
    .sort((left, right) => right.strategyPriority - left.strategyPriority || left.name.localeCompare(right.name));
  const matchedIds = new Set(matched.map((campaign) => campaign.id));
  const template = memberships.find((membership) => membership.campaignId === company.primaryCampaignId) || memberships[0];
  let added = 0;
  let stale = 0;
  const now = new Date().toISOString();

  for (const campaign of matched) {
    const existing = memberships.find((membership) => membership.campaignId === campaign.id);
    if (existing) {
      if (existing.assignmentType === "automatic" || existing.assignmentType === "system") {
        await db.update(campaignLeads).set({
          assignmentType: "automatic", matchStatus: "current", matchReason: matchReason(campaign, company),
          matchedAt: now, updatedAt: now,
        }).where(eq(campaignLeads.id, existing.id));
      }
    } else {
      await createMembership(campaign, company, template, "automatic");
      added += 1;
    }
  }

  for (const membership of memberships) {
    if (membership.assignmentType !== "automatic" || matchedIds.has(membership.campaignId)) continue;
    await db.update(campaignLeads).set({
      matchStatus: "stale", matchReason: "Campaign 条件或公司证据已变化；保留历史但不再作为当前匹配。",
      updatedAt: now,
    }).where(eq(campaignLeads.id, membership.id));
    stale += 1;
  }

  const unassigned = memberships.find((membership) => membership.campaignId === UNASSIGNED_CAMPAIGN_ID);
  if (matched.length) {
    if (unassigned && unassigned.assignmentType === "system") {
      await db.update(campaignLeads).set({ matchStatus: "stale", updatedAt: now }).where(eq(campaignLeads.id, unassigned.id));
    }
  } else if (unassigned) {
    await db.update(campaignLeads).set({ matchStatus: "unassigned", updatedAt: now }).where(eq(campaignLeads.id, unassigned.id));
  } else {
    await createMembership(unassignedCampaign, company, template, "system");
    added += 1;
  }

  const nonAutomaticCurrent = memberships.find((membership) =>
    membership.campaignId !== UNASSIGNED_CAMPAIGN_ID
    && membership.matchStatus !== "stale"
    && membership.assignmentType !== "automatic");
  const primaryCampaignId = matched[0]?.id || nonAutomaticCurrent?.campaignId || UNASSIGNED_CAMPAIGN_ID;
  await db.update(prospectCompanies).set({ primaryCampaignId, updatedAt: now })
    .where(eq(prospectCompanies.id, company.id));
  return { companyId, matchedCampaignIds: [...matchedIds], primaryCampaignId, added, stale };
}

export async function refreshAllCompanyCampaignMemberships() {
  const db = getDb();
  const companies = await db.select({ id: prospectCompanies.id }).from(prospectCompanies);
  const totals = { companies: companies.length, added: 0, stale: 0 };
  for (const company of companies) {
    const result = await refreshCompanyCampaignMemberships(company.id);
    totals.added += result.added;
    totals.stale += result.stale;
  }
  return totals;
}

export async function setPrimaryCampaign(companyId: string, campaignId: string) {
  const db = getDb();
  const [membership] = await db.select({ id: campaignLeads.id }).from(campaignLeads).where(and(
    eq(campaignLeads.companyId, companyId), eq(campaignLeads.campaignId, campaignId),
  )).limit(1);
  if (!membership) throw new Error("campaign_company_membership_missing");
  await db.update(prospectCompanies).set({ primaryCampaignId: campaignId, updatedAt: new Date().toISOString() })
    .where(eq(prospectCompanies.id, companyId));
}
