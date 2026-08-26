import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  campaignLeads,
  campaigns,
  evidenceClaims,
  leadScoreDimensions,
  leadScoreRuns,
  leadSources,
  prospectCompanies,
  prospectContacts,
} from "@/db/schema";
import { isSystemCampaignId } from "@/lib/campaign-routing";
import { buildCrmHandoffPayload } from "@/lib/crm-handoff";

type Company = typeof prospectCompanies.$inferSelect;
type Lead = typeof campaignLeads.$inferSelect;

export async function loadCrmHandoffContext(company: Company, lead: Lead) {
  const db = getDb();
  const [contacts, sources, claims, scoreRuns, membershipRows] = await Promise.all([
    db.select().from(prospectContacts).where(eq(prospectContacts.companyId, company.id))
      .orderBy(desc(prospectContacts.isPrimary)).limit(1),
    db.select().from(leadSources).where(eq(leadSources.companyId, company.id))
      .orderBy(desc(leadSources.retrievedAt)),
    db.select().from(evidenceClaims).where(eq(evidenceClaims.companyId, company.id)),
    db.select().from(leadScoreRuns).where(eq(leadScoreRuns.leadId, lead.id))
      .orderBy(desc(leadScoreRuns.createdAt)).limit(1),
    db.select({
      id: campaigns.id,
      name: campaigns.name,
      productTrack: campaigns.productTrack,
      assignmentType: campaignLeads.assignmentType,
      matchStatus: campaignLeads.matchStatus,
    }).from(campaignLeads).innerJoin(campaigns, eq(campaignLeads.campaignId, campaigns.id))
      .where(eq(campaignLeads.companyId, company.id)),
  ]);
  const scoreRun = scoreRuns[0] || null;
  const dimensions = scoreRun
    ? await db.select().from(leadScoreDimensions).where(eq(leadScoreDimensions.scoreRunId, scoreRun.id))
    : [];
  return { contacts, sources, claims, scoreRun, dimensions, membershipRows };
}

export function buildApprovedCrmHandoff(input: {
  company: Company;
  lead: Lead;
  context: Awaited<ReturnType<typeof loadCrmHandoffContext>>;
  handoffId: string;
  approvedAt: string;
  reviewNotes?: string | null;
}) {
  const { company, lead, context } = input;
  const source = context.sources.find((item) => item.sourceType !== "company_website") || context.sources[0];
  return buildCrmHandoffPayload({
    handoffId: input.handoffId,
    approvedAt: input.approvedAt,
    company,
    lead,
    campaigns: context.membershipRows.filter((membership) => !isSystemCampaignId(membership.id)),
    discovery: {
      sourceType: source?.sourceType || company.sourceType || "company_website",
      sourceName: source?.pageTitle || company.sourceName,
      sourceUrl: source?.sourceUrl || company.website,
    },
    evidence: {
      sourceCount: context.sources.length,
      observedClaimCount: context.claims.filter((claim) => claim.evidenceKind === "observed").length,
      lastVerifiedAt: lead.lastVerifiedAt || context.scoreRun?.createdAt || new Date().toISOString(),
    },
    contact: context.contacts[0] || null,
    reviewNotes: input.reviewNotes,
  });
}
