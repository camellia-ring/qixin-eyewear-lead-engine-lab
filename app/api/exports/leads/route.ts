import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { campaignLeads, prospectCompanies } from "@/db/schema";
import { apiFailure } from "@/lib/api";
import { csvCell } from "@/lib/lead-engine";

export async function GET(request: Request) {
  try {
    const mode = new URL(request.url).searchParams.get("mode");
    if (mode !== "approved") return Response.json({ error: "human_approval_required_before_export" }, { status: 403 });
    const db = getDb();
    const statusCondition = eq(campaignLeads.workflowStatus, "approved");
    const rows = await db.select({
      companyName: prospectCompanies.companyName,
      country: prospectCompanies.country,
      region: prospectCompanies.region,
      customerType: prospectCompanies.customerType,
      companyRole: prospectCompanies.companyRole,
      products: prospectCompanies.productDirectionsJson,
      website: prospectCompanies.website,
      businessEmail: prospectCompanies.businessEmail,
      contactChannel: prospectCompanies.contactChannel,
      contactStatus: prospectCompanies.contactStatus,
      sourceType: prospectCompanies.sourceType,
      sourceName: prospectCompanies.sourceName,
      score: campaignLeads.currentScore,
      grade: campaignLeads.grade,
      evidenceCoverage: campaignLeads.evidenceCoverage,
      confidence: campaignLeads.scoreConfidence,
      workflowStatus: campaignLeads.workflowStatus,
      firstDiscoveredAt: prospectCompanies.firstDiscoveredAt,
      lastVerifiedAt: prospectCompanies.lastVerifiedAt,
    }).from(campaignLeads).innerJoin(prospectCompanies, eq(campaignLeads.companyId, prospectCompanies.id))
      .where(and(statusCondition, eq(prospectCompanies.doNotContact, false), eq(prospectCompanies.isDuplicate, false)))
      .limit(5000);
    const headers = Object.keys(rows[0] || {
      companyName: "", country: "", region: "", customerType: "", companyRole: "", products: "",
      website: "", businessEmail: "", contactChannel: "", contactStatus: "", sourceType: "", sourceName: "",
      score: "", grade: "", evidenceCoverage: "", confidence: "", workflowStatus: "", firstDiscoveredAt: "", lastVerifiedAt: "",
    });
    const csv = [headers.map(csvCell).join(","), ...rows.map((row) => headers.map((header) => csvCell(row[header as keyof typeof row])).join(","))].join("\r\n");
    return new Response(`\uFEFF${csv}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="qixin-approved-leads-${new Date().toISOString().slice(0, 10)}.csv"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return apiFailure(error);
  }
}
