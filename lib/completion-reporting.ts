import { and, eq, gte, isNotNull, lt, ne, sql } from "drizzle-orm";
import { campaignLeads, prospectCompanies } from "@/db/schema";
import type { ReportingPeriod } from "@/lib/reporting-period";

export function automaticCompletionScope(period?: Pick<ReportingPeriod, "from" | "to">) {
  return and(
    eq(campaignLeads.campaignId, prospectCompanies.primaryCampaignId),
    ne(campaignLeads.matchStatus, "stale"),
    isNotNull(campaignLeads.autoQualifiedAt),
    period ? gte(campaignLeads.autoQualifiedAt, period.from) : undefined,
    period ? lt(campaignLeads.autoQualifiedAt, period.to) : undefined,
    sql`NOT EXISTS (
      SELECT 1 FROM campaign_leads AS imported_lead
      WHERE imported_lead.company_id = ${prospectCompanies.id}
        AND imported_lead.import_run_id IS NOT NULL
        AND datetime(imported_lead.created_at) <= datetime(${campaignLeads.autoQualifiedAt})
    )`,
  );
}
