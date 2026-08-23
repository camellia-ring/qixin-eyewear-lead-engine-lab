import { and, eq, or } from "drizzle-orm";
import { getDb } from "@/db";
import { campaignLeads, prospectCompanies } from "@/db/schema";
import { apiFailure } from "@/lib/api";
import { buildHistoricalReclassificationDryRun } from "@/lib/reclassification-dry-run";

export async function GET() {
  try {
    const db = getDb();
    const rows = await db.select({
      companyId: prospectCompanies.id,
      companyName: prospectCompanies.companyName,
      country: prospectCompanies.country,
      website: prospectCompanies.website,
      primaryDomain: prospectCompanies.primaryDomain,
      companyType: prospectCompanies.companyType,
      customerType: prospectCompanies.customerType,
      customerTypesJson: prospectCompanies.customerTypesJson,
      companyRole: prospectCompanies.companyRole,
      businessModel: prospectCompanies.businessModel,
      productsJson: prospectCompanies.productsJson,
      productDirectionsJson: prospectCompanies.productDirectionsJson,
      wholesaleSignal: prospectCompanies.wholesaleSignal,
      privateLabelSignal: prospectCompanies.privateLabelSignal,
      oemSignal: prospectCompanies.oemSignal,
      businessEmail: prospectCompanies.businessEmail,
      contactChannel: prospectCompanies.contactChannel,
      isDuplicate: prospectCompanies.isDuplicate,
      doNotContact: prospectCompanies.doNotContact,
      qualificationResult: campaignLeads.qualificationResult,
      workflowStatus: campaignLeads.workflowStatus,
      hardGateReason: campaignLeads.hardGateReason,
    }).from(campaignLeads).innerJoin(prospectCompanies, eq(campaignLeads.companyId, prospectCompanies.id)).where(and(
      eq(campaignLeads.campaignId, prospectCompanies.primaryCampaignId),
      or(eq(campaignLeads.workflowStatus, "rejected"), eq(campaignLeads.qualificationResult, "near_match")),
    )).limit(5000);
    return Response.json(buildHistoricalReclassificationDryRun(rows), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiFailure(error);
  }
}
