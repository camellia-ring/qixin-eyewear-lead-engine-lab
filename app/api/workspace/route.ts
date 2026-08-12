import { asc, desc } from "drizzle-orm";
import { getDb } from "@/db";
import { campaigns, candidateCompanies, candidateContacts, evidenceItems, reviewDecisions } from "@/db/schema";
import { apiFailure } from "@/lib/api";

export async function GET() {
  try {
    const db = getDb();
    const [campaignRows, companyRows, contactRows, evidenceRows, reviewRows] = await Promise.all([
      db.select().from(campaigns).orderBy(desc(campaigns.updatedAt)),
      db.select().from(candidateCompanies).orderBy(desc(candidateCompanies.totalScore), asc(candidateCompanies.companyName)).limit(500),
      db.select().from(candidateContacts).orderBy(desc(candidateContacts.isPrimary), asc(candidateContacts.fullName)).limit(1000),
      db.select().from(evidenceItems).orderBy(desc(evidenceItems.capturedAt)).limit(1500),
      db.select().from(reviewDecisions).orderBy(desc(reviewDecisions.createdAt)).limit(1000),
    ]);
    return Response.json({
      campaigns: campaignRows,
      companies: companyRows,
      contacts: contactRows,
      evidence: evidenceRows,
      reviews: reviewRows,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiFailure(error);
  }
}

