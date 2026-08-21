import { count, desc, ne } from "drizzle-orm";
import { getDb } from "@/db";
import {
  campaigns,
  campaignLeads,
  crmExportRuns,
  dailyDiscoveryTargets,
  discoveryAlerts,
  discoveryRunAttempts,
  discoveryRunItems,
  discoveryRuns,
  discoverySources,
  engineState,
  leadImportRuns,
  parserVersions,
  sourceHealth,
} from "@/db/schema";
import { apiFailure } from "@/lib/api";
import { UNASSIGNED_CAMPAIGN_ID } from "@/lib/campaign-routing";
import { campaignStrategyName, isRegionKey } from "@/lib/campaign-strategy";
import { buildSearchKeywords, researchBrief, safeJsonList } from "@/lib/lead-engine";

export async function GET() {
  try {
    const db = getDb();
    const [
      campaignRows,
      leadCountRows,
      importRows,
      exportRows,
      discoverySourceRows,
      discoveryRunRows,
      discoveryItemRows,
      engineStateRows,
      dailyTargetRows,
      discoveryAttemptRows,
      sourceHealthRows,
      discoveryAlertRows,
      parserVersionRows,
    ] = await Promise.all([
      db.select().from(campaigns).orderBy(desc(campaigns.updatedAt)),
      db.select({
        campaignId: campaignLeads.campaignId,
        workflowStatus: campaignLeads.workflowStatus,
        value: count(),
      }).from(campaignLeads).where(ne(campaignLeads.matchStatus, "stale"))
        .groupBy(campaignLeads.campaignId, campaignLeads.workflowStatus),
      db.select().from(leadImportRuns).orderBy(desc(leadImportRuns.createdAt)).limit(200),
      db.select().from(crmExportRuns).orderBy(desc(crmExportRuns.createdAt)).limit(200),
      db.select().from(discoverySources).orderBy(desc(discoverySources.updatedAt)).limit(500),
      db.select().from(discoveryRuns).orderBy(desc(discoveryRuns.createdAt)).limit(200),
      db.select().from(discoveryRunItems).orderBy(desc(discoveryRunItems.createdAt)).limit(600),
      db.select().from(engineState).limit(1),
      db.select().from(dailyDiscoveryTargets).orderBy(desc(dailyDiscoveryTargets.targetDate)).limit(60),
      db.select().from(discoveryRunAttempts).orderBy(desc(discoveryRunAttempts.createdAt)).limit(300),
      db.select().from(sourceHealth).orderBy(desc(sourceHealth.checkedAt)).limit(300),
      db.select().from(discoveryAlerts).orderBy(desc(discoveryAlerts.createdAt)).limit(200),
      db.select().from(parserVersions).orderBy(desc(parserVersions.createdAt)).limit(100),
    ]);

    const leadCounts: Record<string, Record<string, number>> = {};
    for (const row of leadCountRows) {
      const campaignCounts = leadCounts[row.campaignId] || { all: 0 };
      campaignCounts[row.workflowStatus] = Number(row.value || 0);
      campaignCounts.all += Number(row.value || 0);
      leadCounts[row.campaignId] = campaignCounts;
    }

    return Response.json({
      campaigns: campaignRows.map((campaign) => {
        const displayName = campaign.id !== UNASSIGNED_CAMPAIGN_ID && isRegionKey(campaign.regionKey)
          ? campaignStrategyName(campaign.regionKey, safeJsonList(campaign.targetCountriesJson))
          : campaign.name;
        const displayCampaign = { ...campaign, name: displayName };
        return {
          ...displayCampaign,
          searchKeywords: buildSearchKeywords(displayCampaign),
          researchBrief: researchBrief(displayCampaign),
        };
      }),
      leadCounts,
      imports: importRows,
      exports: exportRows,
      discoverySources: discoverySourceRows,
      discoveryRuns: discoveryRunRows,
      discoveryItems: discoveryItemRows,
      engineState: engineStateRows[0] || null,
      dailyTargets: dailyTargetRows,
      discoveryAttempts: discoveryAttemptRows,
      sourceHealth: sourceHealthRows,
      discoveryAlerts: discoveryAlertRows,
      parserVersions: parserVersionRows,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiFailure(error);
  }
}
