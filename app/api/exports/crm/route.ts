import { and, asc, eq, inArray } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { getDb } from "@/db";
import {
  campaigns,
  campaignLeads,
  crmExportItems,
  crmExportRuns,
  leadSources,
  prospectCompanies,
  prospectContacts,
} from "@/db/schema";
import { ApiError, apiFailure, jsonBody, textValue } from "@/lib/api";
import { crmProductInterests, csvCell, safeJsonList } from "@/lib/lead-engine";
import { isSystemCampaignId } from "@/lib/campaign-routing";

export async function POST(request: Request) {
  try {
    const body = await jsonBody(request);
    const campaignId = textValue(body.campaignId, { field: "campaignId", required: true, max: 100 });
    if (isSystemCampaignId(campaignId)) throw new ApiError(409, "system_campaign_cannot_export");
    const db = getDb();
    const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, campaignId)).limit(1);
    if (!campaign) throw new ApiError(404, "campaign_not_found");
    let leads = await db.select().from(campaignLeads).where(and(
      eq(campaignLeads.campaignId, campaignId),
      eq(campaignLeads.workflowStatus, "approved"),
    )).orderBy(asc(campaignLeads.createdAt));
    const requestedLeadIds = Array.isArray(body.leadIds)
      ? new Set(body.leadIds.map((value) => textValue(value, { field: "leadId", max: 100 })).filter(Boolean))
      : null;
    if (requestedLeadIds) leads = leads.filter((lead) => requestedLeadIds.has(lead.id));
    if (!leads.length) throw new ApiError(409, "no_approved_leads");

    const companyIds = [...new Set(leads.map((lead) => lead.companyId))];
    const [companies, contacts, sources] = await Promise.all([
      db.select().from(prospectCompanies).where(inArray(prospectCompanies.id, companyIds)),
      db.select().from(prospectContacts).where(and(
        inArray(prospectContacts.companyId, companyIds),
        eq(prospectContacts.isPrimary, true),
      )),
      db.select().from(leadSources).where(inArray(leadSources.companyId, companyIds)),
    ]);
    const companyById = new Map(companies.map((company) => [company.id, company]));
    const primaryByCompany = new Map(contacts.map((contact) => [contact.companyId, contact]));
    const sourcesByCompany = new Map<string, typeof sources>();
    for (const source of sources) sourcesByCompany.set(source.companyId, [...(sourcesByCompany.get(source.companyId) || []), source]);

    const columns = [
      "company_name", "country_code", "website", "contact_name", "job_title", "email",
      "whatsapp", "product_interests", "source", "stage", "estimated_purchase_volume", "notes",
    ];
    const lines = [columns.map(csvCell).join(",")];
    for (const lead of leads) {
      const company = companyById.get(lead.companyId);
      if (!company) continue;
      const contact = primaryByCompany.get(company.id);
      const leadSourcesForRow = sourcesByCompany.get(company.id) || [];
      const detailedProducts = safeJsonList(lead.recommendedProductsJson);
      const notes = [
        `Lead Engine campaign: ${campaign.name}.`,
        `Grade ${lead.grade}; score ${lead.currentScore}/100; evidence ${lead.evidenceCoverage}%; confidence ${lead.scoreConfidence}.`,
        detailedProducts.length ? `Recommended products: ${detailedProducts.join("; ")}.` : "",
        lead.riskSummary ? `Risk: ${lead.riskSummary}` : "",
        company.analysisSummary || "",
        company.businessEmail && !contact?.email ? `Public business email: ${company.businessEmail}.` : "",
        company.contactChannel ? `Contact channel: ${company.contactChannel}.` : "",
        ...leadSourcesForRow.slice(0, 3).map((source) => `Source: ${source.sourceUrl}`),
      ].filter(Boolean).join(" ");
      const row = {
        company_name: company.companyName,
        country_code: company.country,
        website: company.website,
        contact_name: contact?.fullName,
        job_title: contact?.jobTitle,
        email: contact?.email,
        whatsapp: contact?.whatsapp,
        product_interests: crmProductInterests(lead.productTrack).join(";"),
        source: "lead_engine_lab",
        stage: "lead",
        estimated_purchase_volume: company.estimatedPurchaseVolume,
        notes,
      } as Record<string, unknown>;
      lines.push(columns.map((column) => csvCell(row[column])).join(","));
    }

    const exportRunId = crypto.randomUUID();
    const exportedAt = new Date().toISOString();
    const statements: BatchItem<"sqlite">[] = [db.insert(crmExportRuns).values({
      id: exportRunId,
      campaignId,
      rowCount: leads.length,
      exportedBy: "private_owner",
    })];
    for (const lead of leads) {
      statements.push(db.insert(crmExportItems).values({ id: crypto.randomUUID(), exportRunId, leadId: lead.id }));
      statements.push(db.update(campaignLeads).set({ exportedAt, updatedAt: exportedAt }).where(eq(campaignLeads.id, lead.id)));
    }
    await db.batch(statements as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);

    return new Response(`\uFEFF${lines.join("\r\n")}\r\n`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=qixin-approved-leads.csv",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Qixin-Export-Run": exportRunId,
      },
    });
  } catch (error) {
    return apiFailure(error);
  }
}
