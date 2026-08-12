import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { candidateCompanies, candidateContacts } from "@/db/schema";
import { apiFailure } from "@/lib/api";
import { csvCell } from "@/lib/lead-engine";

export async function GET() {
  try {
    const db = getDb();
    const companies = await db.select().from(candidateCompanies)
      .where(eq(candidateCompanies.reviewStatus, "approved"))
      .orderBy(asc(candidateCompanies.companyName));
    const contacts = await db.select().from(candidateContacts).where(eq(candidateContacts.isPrimary, true));
    const primaryByCompany = new Map(contacts.map((contact) => [contact.companyId, contact]));
    const columns = [
      "company_name", "country_code", "website", "contact_name", "job_title", "email",
      "whatsapp", "product_interests", "source", "stage", "estimated_purchase_volume", "notes",
    ];
    const lines = [columns.map(csvCell).join(",")];
    for (const company of companies) {
      const contact = primaryByCompany.get(company.id);
      const notes = [
        `Lead Engine grade ${company.grade}; score ${company.totalScore}/100.`,
        company.evidenceSummary || "",
        company.sourceUrl ? `Source: ${company.sourceUrl}` : "",
      ].filter(Boolean).join(" ");
      const row = {
        company_name: company.companyName,
        country_code: company.country,
        website: company.website,
        contact_name: contact?.fullName,
        job_title: contact?.jobTitle,
        email: contact?.email,
        whatsapp: contact?.whatsapp,
        product_interests: company.productInterests,
        source: "lead_engine_lab",
        stage: "lead",
        estimated_purchase_volume: company.estimatedPurchaseVolume,
        notes,
      } as Record<string, unknown>;
      lines.push(columns.map((column) => csvCell(row[column])).join(","));
    }
    return new Response(`\uFEFF${lines.join("\r\n")}\r\n`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=qixin-approved-leads.csv",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return apiFailure(error);
  }
}

