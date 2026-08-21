import { and, desc, eq } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
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

function membershipValues(
  campaign: typeof campaigns.$inferSelect,
  company: typeof prospectCompanies.$inferSelect,
  template: typeof campaignLeads.$inferSelect,
  assignmentType: "automatic" | "system",
  now = new Date().toISOString(),
) {
  const leadId = crypto.randomUUID();
  const unassigned = campaign.id === UNASSIGNED_CAMPAIGN_ID;
  return { leadId, values: {
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
  } };
}

type CompanyRefreshResult = {
  companyId: string;
  matchedCampaignIds: string[];
  primaryCampaignId?: string;
  added: number;
  stale: number;
};

async function refreshCampaignMemberships(companyId?: string) {
  const db = getDb();
  const [unassignedCampaign, companies, activeCampaigns, memberships, scoreRuns, scoreDimensions] = await Promise.all([
    ensureUnassignedCampaign(),
    companyId
      ? db.select().from(prospectCompanies).where(eq(prospectCompanies.id, companyId)).limit(1)
      : db.select().from(prospectCompanies),
    db.select().from(campaigns).where(eq(campaigns.status, "active")),
    companyId
      ? db.select().from(campaignLeads).where(eq(campaignLeads.companyId, companyId)).orderBy(desc(campaignLeads.currentScore))
      : db.select().from(campaignLeads).orderBy(desc(campaignLeads.currentScore)),
    db.select().from(leadScoreRuns).orderBy(desc(leadScoreRuns.createdAt)),
    db.select().from(leadScoreDimensions),
  ]);
  const businessCampaigns = activeCampaigns.filter((campaign) => campaign.id !== UNASSIGNED_CAMPAIGN_ID);
  const membershipsByCompany = new Map<string, Array<typeof campaignLeads.$inferSelect>>();
  for (const membership of memberships) {
    const companyMemberships = membershipsByCompany.get(membership.companyId) || [];
    companyMemberships.push(membership);
    membershipsByCompany.set(membership.companyId, companyMemberships);
  }
  const latestScoreByLead = new Map<string, typeof leadScoreRuns.$inferSelect>();
  for (const scoreRun of scoreRuns) {
    if (!latestScoreByLead.has(scoreRun.leadId)) latestScoreByLead.set(scoreRun.leadId, scoreRun);
  }
  const dimensionsByRun = new Map<string, Array<typeof leadScoreDimensions.$inferSelect>>();
  for (const dimension of scoreDimensions) {
    const dimensions = dimensionsByRun.get(dimension.scoreRunId) || [];
    dimensions.push(dimension);
    dimensionsByRun.set(dimension.scoreRunId, dimensions);
  }

  const operations: BatchItem<"sqlite">[] = [];
  const totals = { companies: companies.length, added: 0, stale: 0, writes: 0 };
  const results = new Map<string, CompanyRefreshResult>();
  const now = new Date().toISOString();

  function queueNewMembership(
    campaign: typeof campaigns.$inferSelect,
    company: typeof prospectCompanies.$inferSelect,
    template: typeof campaignLeads.$inferSelect,
    assignmentType: "automatic" | "system",
  ) {
    const { leadId, values } = membershipValues(campaign, company, template, assignmentType, now);
    operations.push(db.insert(campaignLeads).values(values));
    const scoreRun = latestScoreByLead.get(template.id);
    if (scoreRun) {
      const scoreRunId = crypto.randomUUID();
      operations.push(db.insert(leadScoreRuns).values({
        id: scoreRunId,
        leadId,
        rubricVersion: scoreRun.rubricVersion,
        totalScore: scoreRun.totalScore,
        grade: scoreRun.grade,
        evidenceCoverage: scoreRun.evidenceCoverage,
        overallConfidence: scoreRun.overallConfidence,
        modelIdentifier: `${scoreRun.modelIdentifier}:campaign_rematch`,
      }));
      for (const dimension of dimensionsByRun.get(scoreRun.id) || []) {
        operations.push(db.insert(leadScoreDimensions).values({
          id: crypto.randomUUID(),
          scoreRunId,
          dimension: dimension.dimension,
          score: dimension.score,
          maxScore: dimension.maxScore,
          positiveReason: dimension.positiveReason,
          negativeReason: dimension.negativeReason,
          evidenceIdsJson: dimension.evidenceIdsJson,
        }));
      }
    }
    totals.added += 1;
  }

  for (const company of companies) {
    const addedBefore = totals.added;
    const staleBefore = totals.stale;
    const companyMemberships = membershipsByCompany.get(company.id) || [];
    if (!companyMemberships.length) {
      results.set(company.id, { companyId: company.id, matchedCampaignIds: [], added: 0, stale: 0 });
      continue;
    }
    const matched = businessCampaigns
      .filter((campaign) => campaignMatchesCompany(campaign, company))
      .sort((left, right) => right.strategyPriority - left.strategyPriority || left.name.localeCompare(right.name));
    const matchedIds = new Set(matched.map((campaign) => campaign.id));
    const template = companyMemberships.find((membership) => membership.campaignId === company.primaryCampaignId) || companyMemberships[0];

    for (const campaign of matched) {
      const existing = companyMemberships.find((membership) => membership.campaignId === campaign.id);
      if (!existing) {
        queueNewMembership(campaign, company, template, "automatic");
        continue;
      }
      if (existing.assignmentType !== "automatic" && existing.assignmentType !== "system") continue;
      const reason = matchReason(campaign, company);
      if (existing.assignmentType === "automatic" && existing.matchStatus === "current" && existing.matchReason === reason) continue;
      operations.push(db.update(campaignLeads).set({
        assignmentType: "automatic",
        matchStatus: "current",
        matchReason: reason,
        matchedAt: now,
        updatedAt: now,
      }).where(eq(campaignLeads.id, existing.id)));
    }

    for (const membership of companyMemberships) {
      if (membership.assignmentType !== "automatic" || matchedIds.has(membership.campaignId) || membership.matchStatus === "stale") continue;
      operations.push(db.update(campaignLeads).set({
        matchStatus: "stale",
        matchReason: "Campaign 条件或公司证据已变化；保留历史但不再作为当前匹配。",
        updatedAt: now,
      }).where(eq(campaignLeads.id, membership.id)));
      totals.stale += 1;
    }

    const unassigned = companyMemberships.find((membership) => membership.campaignId === UNASSIGNED_CAMPAIGN_ID);
    if (matched.length) {
      if (unassigned?.assignmentType === "system" && unassigned.matchStatus !== "stale") {
        operations.push(db.update(campaignLeads).set({ matchStatus: "stale", updatedAt: now }).where(eq(campaignLeads.id, unassigned.id)));
      }
    } else if (unassigned) {
      if (unassigned.matchStatus !== "unassigned") {
        operations.push(db.update(campaignLeads).set({ matchStatus: "unassigned", updatedAt: now }).where(eq(campaignLeads.id, unassigned.id)));
      }
    } else {
      queueNewMembership(unassignedCampaign, company, template, "system");
    }

    const nonAutomaticCurrent = companyMemberships.find((membership) =>
      membership.campaignId !== UNASSIGNED_CAMPAIGN_ID
      && membership.matchStatus !== "stale"
      && membership.assignmentType !== "automatic");
    const primaryCampaignId = matched[0]?.id || nonAutomaticCurrent?.campaignId || UNASSIGNED_CAMPAIGN_ID;
    if (company.primaryCampaignId !== primaryCampaignId) {
      operations.push(db.update(prospectCompanies).set({ primaryCampaignId, updatedAt: now }).where(eq(prospectCompanies.id, company.id)));
    }
    results.set(company.id, {
      companyId: company.id,
      matchedCampaignIds: [...matchedIds],
      primaryCampaignId,
      added: totals.added - addedBefore,
      stale: totals.stale - staleBefore,
    });
  }

  for (let index = 0; index < operations.length; index += 80) {
    const chunk = operations.slice(index, index + 80);
    if (!chunk.length) continue;
    await db.batch([chunk[0], ...chunk.slice(1)] as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);
  }
  totals.writes = operations.length;
  return { totals, results };
}

export async function refreshCompanyCampaignMemberships(companyId: string) {
  const { results } = await refreshCampaignMemberships(companyId);
  return results.get(companyId) || { companyId, matchedCampaignIds: [], added: 0, stale: 0 };
}

export async function refreshAllCompanyCampaignMemberships() {
  const { totals } = await refreshCampaignMemberships();
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
