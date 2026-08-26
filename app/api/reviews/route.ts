import { and, desc, eq, ne } from "drizzle-orm";
import { getDb } from "@/db";
import {
  campaignLeads,
  crmHandoffAttempts,
  leadReviewDecisions,
  prospectCompanies,
} from "@/db/schema";
import { ApiError, apiFailure, jsonBody, textValue } from "@/lib/api";
import { REVIEW_DECISIONS, SCORE_LIMITS } from "@/lib/lead-engine";
import { buildApprovedCrmHandoff, loadCrmHandoffContext } from "@/lib/crm-handoff-context";
import { isCurrentServerVerification } from "@/lib/import-policy";
import { approvalPolicyGaps } from "@/lib/qualification";
import { CRM_HANDOFF_CONTRACT_VERSION, sendCrmHandoff, type CrmHandoffPayload } from "@/lib/crm-handoff";

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

    let approvedHandoff: { status: "accepted" | "duplicate"; customerId: string | null; duplicateReason: string | null; httpStatus: number } | null = null;
    let handoffAttemptId: string | null = null;
    let handoffPayload: CrmHandoffPayload | null = null;
    if (decision === "approved") {
      const handoffContext = await loadCrmHandoffContext(company, lead);
      const { sources, claims, scoreRun, dimensions } = handoffContext;
      const policyGaps = approvalPolicyGaps({
        hardGateStatus: lead.hardGateStatus,
        score: lead.currentScore,
        evidenceCoverage: lead.evidenceCoverage,
        scoreConfidence: lead.scoreConfidence,
        doNotContact: company.doNotContact,
        sourceCount: sources.length,
        contactPresent: Boolean(company.businessEmail || company.contactChannel || handoffContext.contacts.length),
        scoreDimensionCount: dimensions.length,
        expectedScoreDimensionCount: Object.keys(SCORE_LIMITS).length,
        serverVerified: isCurrentServerVerification(scoreRun),
      });
      if (policyGaps.length) throw new ApiError(409, "approval_policy_not_ready", policyGaps.join("；"));
      if (!claims.some((claim) => claim.evidenceKind === "observed")) throw new ApiError(409, "observed_evidence_required");
      if (dimensions.some((item) => !item.positiveReason && !item.negativeReason)) throw new ApiError(409, "score_reason_incomplete");

      const [existingAttempt] = await db.select().from(crmHandoffAttempts)
        .where(and(eq(crmHandoffAttempts.companyId, company.id), ne(crmHandoffAttempts.status, "succeeded")))
        .orderBy(desc(crmHandoffAttempts.createdAt)).limit(1);
      if (existingAttempt) {
        handoffAttemptId = existingAttempt.id;
        handoffPayload = JSON.parse(existingAttempt.payloadJson) as CrmHandoffPayload;
      } else {
        handoffAttemptId = crypto.randomUUID();
        handoffPayload = buildApprovedCrmHandoff({
          handoffId: crypto.randomUUID(),
          approvedAt: new Date().toISOString(),
          company,
          lead,
          context: handoffContext,
          reviewNotes: notes,
        });
        await db.insert(crmHandoffAttempts).values({
          id: handoffAttemptId,
          handoffId: handoffPayload.handoffId,
          leadId,
          companyId: company.id,
          contractVersion: CRM_HANDOFF_CONTRACT_VERSION,
          payloadJson: JSON.stringify(handoffPayload),
        });
      }
      try {
        approvedHandoff = await sendCrmHandoff(handoffPayload);
      } catch (handoffError) {
        const failure = handoffError as Error & { httpStatus?: number; responseCode?: string | null };
        await db.update(crmHandoffAttempts).set({
          status: "failed",
          httpStatus: failure.httpStatus || null,
          responseCode: failure.responseCode || null,
          errorMessage: failure.message.slice(0, 1000),
          updatedAt: new Date().toISOString(),
        }).where(eq(crmHandoffAttempts.id, handoffAttemptId));
        throw new ApiError(502, "crm_handoff_failed", "客户尚未批准；CRM 移交失败，可直接重试审核通过。 ");
      }
    }

    const reviewedAt = handoffPayload?.approval.approvedAt || new Date().toISOString();
    const leadUpdate = db.update(campaignLeads).set({
        workflowStatus: decision,
        reviewedBy: decision === "approved" || decision === "rejected" ? "private_owner" : null,
        reviewedAt: decision === "approved" || decision === "rejected" ? reviewedAt : null,
        updatedAt: reviewedAt,
      }).where(and(
        eq(campaignLeads.companyId, lead.companyId),
        ne(campaignLeads.matchStatus, "stale"),
      ));
    const reviewInsert = db.insert(leadReviewDecisions).values({
        id: crypto.randomUUID(),
        leadId,
        decision,
        notes: notes || null,
        decidedBy: "private_owner",
      });
    if (decision === "approved" && handoffAttemptId && approvedHandoff) {
      const handoffUpdate = db.update(crmHandoffAttempts).set({
        status: "succeeded",
        httpStatus: approvedHandoff.httpStatus,
        responseCode: approvedHandoff.status,
        customerId: approvedHandoff.customerId,
        errorMessage: null,
        updatedAt: new Date().toISOString(),
      }).where(eq(crmHandoffAttempts.id, handoffAttemptId));
      await db.batch([leadUpdate, reviewInsert, handoffUpdate]);
    } else {
      await db.batch([leadUpdate, reviewInsert]);
    }
    return Response.json({
      leadId,
      companyId: lead.companyId,
      decision,
      synchronizedCurrentCampaigns: true,
      crmHandoff: approvedHandoff ? {
        status: approvedHandoff.status,
        customerId: approvedHandoff.customerId,
        duplicateReason: approvedHandoff.duplicateReason,
      } : null,
    });
  } catch (error) {
    return apiFailure(error);
  }
}
