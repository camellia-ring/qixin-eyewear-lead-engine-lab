import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { candidateCompanies, candidateContacts, reviewDecisions } from "@/db/schema";
import { ApiError, apiFailure, jsonBody, textValue } from "@/lib/api";
import { REVIEW_STATUSES } from "@/lib/lead-engine";

export async function POST(request: Request) {
  try {
    const body = await jsonBody(request);
    const companyId = textValue(body.companyId, { field: "companyId", required: true, max: 100 });
    const decision = textValue(body.decision, { field: "decision", required: true, max: 50 });
    const notes = textValue(body.notes, { field: "notes", max: 5000 });
    if (!REVIEW_STATUSES.has(decision) || decision === "new") throw new ApiError(400, "invalid_decision");
    if (decision === "rejected" && !notes) throw new ApiError(400, "rejection_reason_required");

    const db = getDb();
    const [company] = await db.select().from(candidateCompanies).where(eq(candidateCompanies.id, companyId)).limit(1);
    if (!company) throw new ApiError(404, "candidate_not_found");
    if (decision === "approved") {
      const contacts = await db.select().from(candidateContacts).where(eq(candidateContacts.companyId, companyId)).limit(1);
      if (company.totalScore < 60) throw new ApiError(409, "score_below_approval_threshold");
      if (company.disqualificationReason || company.doNotContact) throw new ApiError(409, "candidate_disqualified");
      if (!company.sourceUrl || company.productFitScore < 1) throw new ApiError(409, "evidence_not_ready");
      if (!company.businessEmail && !company.contactChannel && !contacts.length) throw new ApiError(409, "contact_channel_required");
    }

    await db.batch([
      db.update(candidateCompanies).set({
        reviewStatus: decision,
        reviewedAt: decision === "approved" || decision === "rejected" ? new Date().toISOString() : null,
        updatedAt: new Date().toISOString(),
      }).where(eq(candidateCompanies.id, companyId)),
      db.insert(reviewDecisions).values({ id: crypto.randomUUID(), companyId, decision, notes: notes || null }),
    ]);
    return Response.json({ companyId, decision });
  } catch (error) {
    return apiFailure(error);
  }
}

