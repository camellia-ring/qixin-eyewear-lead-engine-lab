import { asc, desc } from "drizzle-orm";
import { getDb } from "@/db";
import {
  campaigns,
  campaignLeads,
  companyDomainLinks,
  companyDomains,
  crmExportRuns,
  discoveryRunItems,
  discoveryRuns,
  discoverySources,
  evidenceClaims,
  leadImportRuns,
  leadReviewDecisions,
  leadScoreDimensions,
  leadScoreRuns,
  leadSources,
  prospectCompanies,
  prospectContacts,
} from "@/db/schema";
import { apiFailure } from "@/lib/api";
import { buildSearchKeywords, researchBrief } from "@/lib/lead-engine";

export async function GET() {
  try {
    const db = getDb();
    const [
      campaignRows,
      leadRows,
      companyRows,
      contactRows,
      domainRows,
      domainLinkRows,
      sourceRows,
      claimRows,
      scoreRunRows,
      scoreDimensionRows,
      reviewRows,
      importRows,
      exportRows,
      discoverySourceRows,
      discoveryRunRows,
      discoveryItemRows,
    ] = await Promise.all([
      db.select().from(campaigns).orderBy(desc(campaigns.updatedAt)),
      db.select().from(campaignLeads).orderBy(desc(campaignLeads.currentScore), desc(campaignLeads.updatedAt)).limit(500),
      db.select().from(prospectCompanies).orderBy(asc(prospectCompanies.companyName)).limit(500),
      db.select().from(prospectContacts).orderBy(desc(prospectContacts.isPrimary), asc(prospectContacts.fullName)).limit(1000),
      db.select().from(companyDomains).orderBy(asc(companyDomains.normalizedDomain)).limit(1000),
      db.select().from(companyDomainLinks).limit(1500),
      db.select().from(leadSources).orderBy(desc(leadSources.retrievedAt)).limit(2000),
      db.select().from(evidenceClaims).orderBy(desc(evidenceClaims.createdAt)).limit(3000),
      db.select().from(leadScoreRuns).orderBy(desc(leadScoreRuns.createdAt)).limit(1000),
      db.select().from(leadScoreDimensions).limit(7000),
      db.select().from(leadReviewDecisions).orderBy(desc(leadReviewDecisions.createdAt)).limit(1500),
      db.select().from(leadImportRuns).orderBy(desc(leadImportRuns.createdAt)).limit(500),
      db.select().from(crmExportRuns).orderBy(desc(crmExportRuns.createdAt)).limit(500),
      db.select().from(discoverySources).orderBy(desc(discoverySources.updatedAt)).limit(500),
      db.select().from(discoveryRuns).orderBy(desc(discoveryRuns.createdAt)).limit(500),
      db.select().from(discoveryRunItems).orderBy(desc(discoveryRunItems.createdAt)).limit(2000),
    ]);
    return Response.json({
      campaigns: campaignRows.map((campaign) => ({
        ...campaign,
        searchKeywords: buildSearchKeywords(campaign),
        researchBrief: researchBrief(campaign),
      })),
      leads: leadRows,
      companies: companyRows,
      contacts: contactRows,
      domains: domainRows,
      domainLinks: domainLinkRows,
      sources: sourceRows,
      claims: claimRows,
      scoreRuns: scoreRunRows,
      scoreDimensions: scoreDimensionRows,
      reviews: reviewRows,
      imports: importRows,
      exports: exportRows,
      discoverySources: discoverySourceRows,
      discoveryRuns: discoveryRunRows,
      discoveryItems: discoveryItemRows,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiFailure(error);
  }
}
