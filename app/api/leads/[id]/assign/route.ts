import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { campaigns, campaignLeads, leadReviewDecisions } from "@/db/schema";
import { ApiError, apiFailure, jsonBody, textValue } from "@/lib/api";
import { UNASSIGNED_CAMPAIGN_ID } from "@/lib/campaign-routing";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await jsonBody(request);
    const campaignId = textValue(body.campaignId, { field: "campaignId", required: true, max: 100 });
    if (campaignId === UNASSIGNED_CAMPAIGN_ID) throw new ApiError(400, "invalid_assignment_campaign");
    const db = getDb();
    const [lead, campaign] = await Promise.all([
      db.select().from(campaignLeads).where(eq(campaignLeads.id, id)).limit(1).then((rows) => rows[0]),
      db.select().from(campaigns).where(eq(campaigns.id, campaignId)).limit(1).then((rows) => rows[0]),
    ]);
    if (!lead) throw new ApiError(404, "lead_not_found");
    if (lead.campaignId !== UNASSIGNED_CAMPAIGN_ID) throw new ApiError(409, "lead_already_assigned");
    if (!campaign) throw new ApiError(404, "campaign_not_found");
    const [existing] = await db.select({ id: campaignLeads.id }).from(campaignLeads).where(and(
      eq(campaignLeads.campaignId, campaignId),
      eq(campaignLeads.companyId, lead.companyId),
    )).limit(1);
    if (existing) throw new ApiError(409, "campaign_company_exists", "该客户已在目标 Campaign 中");
    const now = new Date().toISOString();
    const [assigned] = await db.update(campaignLeads).set({
      campaignId,
      productTrack: campaign.productTrack,
      qualificationResult: lead.qualificationResult === "near_match" ? "qualified" : lead.qualificationResult,
      hardGateStatus: lead.hardGateStatus === "needs_review" ? "pass" : lead.hardGateStatus,
      hardGateReason: lead.hardGateStatus === "needs_review" ? `人工依据证据分配到 Campaign：${campaign.name}` : lead.hardGateReason,
      riskSummary: lead.riskSummary?.replace(/客户通过全局准入[^。]*。?/, "") || lead.riskSummary,
      updatedAt: now,
    }).where(eq(campaignLeads.id, id)).returning();
    await db.insert(leadReviewDecisions).values({
      id: crypto.randomUUID(), leadId: id, decision: "needs_review",
      notes: `从待分配人工分配到 Campaign：${campaign.name}`, decidedBy: "private_owner",
    });
    return Response.json({ lead: assigned, campaign });
  } catch (error) {
    return apiFailure(error);
  }
}
