import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  campaignLeads,
  evidenceClaims,
  leadReviewDecisions,
  leadScoreDimensions,
  leadScoreRuns,
  leadSources,
  prospectCompanies,
  prospectContacts,
} from "@/db/schema";
import { ApiError, apiFailure, jsonBody, textValue } from "@/lib/api";
import { REVIEW_DECISIONS, SCORE_LIMITS } from "@/lib/lead-engine";
import { UNASSIGNED_CAMPAIGN_ID } from "@/lib/campaign-routing";

export async function POST(request: Request) {
  try {
    const body = await jsonBody(request);
    const leadId = textValue(body.leadId, { field: "leadId", required: true, max: 100 });
    const decision = textValue(body.decision, { field: "decision", required: true, max: 50 });
    const notes = textValue(body.notes, { field: "notes", max: 5000 });
    if (!REVIEW_DECISIONS.has(decision)) throw new ApiError(400, "invalid_decision");
    if (decision === "rejected" && !notes) throw new ApiError(400, "rejection_reason_required");

    const db = getDb();
    const [lead] = await db.select().from(campaignLeads).where(eq(campaignLeads.id, leadId)).limit(1);
    if (!lead) throw new ApiError(404, "lead_not_found");
    const [company] = await db.select().from(prospectCompanies).where(eq(prospectCompanies.id, lead.companyId)).limit(1);
    if (!company) throw new ApiError(404, "company_not_found");

    if (decision === "approved") {
      if (lead.campaignId === UNASSIGNED_CAMPAIGN_ID) throw new ApiError(409, "assign_campaign_before_approval");
      const [contacts, sources, claims, scoreRuns] = await Promise.all([
        db.select().from(prospectContacts).where(eq(prospectContacts.companyId, company.id)).limit(1),
        db.select().from(leadSources).where(eq(leadSources.companyId, company.id)).limit(1),
        db.select().from(evidenceClaims).where(eq(evidenceClaims.companyId, company.id)),
        db.select().from(leadScoreRuns).where(eq(leadScoreRuns.leadId, leadId)).orderBy(desc(leadScoreRuns.createdAt)).limit(1),
      ]);
      const scoreRun = scoreRuns[0];
      const dimensions = scoreRun
        ? await db.select().from(leadScoreDimensions).where(eq(leadScoreDimensions.scoreRunId, scoreRun.id))
        : [];
      if (lead.hardGateStatus !== "pass") throw new ApiError(409, "hard_gate_not_passed");
      if (lead.currentScore < 60) throw new ApiError(409, "score_below_approval_threshold");
      if (lead.evidenceCoverage < 40 || lead.scoreConfidence === "low") throw new ApiError(409, "evidence_not_ready");
      if (company.doNotContact) throw new ApiError(409, "do_not_contact");
      if (!sources.length) throw new ApiError(409, "source_required");
      if (!claims.some((claim) => claim.evidenceKind === "observed")) throw new ApiError(409, "observed_evidence_required");
      if (dimensions.length !== Object.keys(SCORE_LIMITS).length) throw new ApiError(409, "score_breakdown_incomplete");
      if (dimensions.some((item) => !item.positiveReason && !item.negativeReason)) throw new ApiError(409, "score_reason_incomplete");
      if (!company.businessEmail && !company.contactChannel && !contacts.length) throw new ApiError(409, "contact_channel_required");
    }

    const reviewedAt = new Date().toISOString();
    await db.batch([
      db.update(campaignLeads).set({
        workflowStatus: decision,
        reviewedBy: decision === "approved" || decision === "rejected" ? "private_owner" : null,
        reviewedAt: decision === "approved" || decision === "rejected" ? reviewedAt : null,
        updatedAt: reviewedAt,
      }).where(eq(campaignLeads.id, leadId)),
      db.insert(leadReviewDecisions).values({
        id: crypto.randomUUID(),
        leadId,
        decision,
        notes: notes || null,
        decidedBy: "private_owner",
      }),
    ]);
    return Response.json({ leadId, decision });
  } catch (error) {
    return apiFailure(error);
  }
}
