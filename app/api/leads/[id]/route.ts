import { count, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  campaignLeads,
  companyDomainLinks,
  companyDomains,
  contactVerifications,
  evidenceClaims,
  leadReviewDecisions,
  leadScoreDimensions,
  leadScoreRuns,
  leadSources,
  prospectCompanies,
  prospectContacts,
} from "@/db/schema";
import { ApiError, apiFailure } from "@/lib/api";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const db = getDb();
    const [lead] = await db.select().from(campaignLeads).where(eq(campaignLeads.id, id)).limit(1);
    if (!lead) throw new ApiError(404, "lead_not_found");

    const [companyRows, sourceRows, claimRows, scoreRunRows, reviewRows, domainRows, contactCountRows, verificationRows] = await Promise.all([
      db.select().from(prospectCompanies).where(eq(prospectCompanies.id, lead.companyId)).limit(1),
      db.select().from(leadSources).where(eq(leadSources.leadId, id)).orderBy(desc(leadSources.retrievedAt)),
      db.select().from(evidenceClaims).where(eq(evidenceClaims.leadId, id)).orderBy(desc(evidenceClaims.createdAt)),
      db.select().from(leadScoreRuns).where(eq(leadScoreRuns.leadId, id)).orderBy(desc(leadScoreRuns.createdAt)).limit(1),
      db.select().from(leadReviewDecisions).where(eq(leadReviewDecisions.leadId, id)).orderBy(desc(leadReviewDecisions.createdAt)),
      db.select({
        id: companyDomains.id,
        normalizedDomain: companyDomains.normalizedDomain,
        relationshipType: companyDomainLinks.relationshipType,
      }).from(companyDomainLinks).innerJoin(companyDomains, eq(companyDomainLinks.domainId, companyDomains.id))
        .where(eq(companyDomainLinks.companyId, lead.companyId)),
      db.select({ value: count() }).from(prospectContacts).where(eq(prospectContacts.companyId, lead.companyId)),
      db.select().from(contactVerifications).where(eq(contactVerifications.leadId, id)).orderBy(desc(contactVerifications.verifiedAt)),
    ]);
    const company = companyRows[0];
    if (!company) throw new ApiError(404, "company_not_found");
    const scoreRun = scoreRunRows[0] || null;
    const scoreDimensions = scoreRun
      ? await db.select().from(leadScoreDimensions).where(eq(leadScoreDimensions.scoreRunId, scoreRun.id))
      : [];

    return Response.json({
      lead,
      company,
      sources: sourceRows,
      claims: claimRows,
      scoreRun,
      scoreDimensions,
      reviews: reviewRows,
      domains: domainRows,
      contactCount: Number(contactCountRows[0]?.value || 0),
      contactVerifications: verificationRows,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiFailure(error);
  }
}
