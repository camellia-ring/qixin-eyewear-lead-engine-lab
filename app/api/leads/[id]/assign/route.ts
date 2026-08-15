import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { campaigns, campaignLeads, leadReviewDecisions, prospectCompanies } from "@/db/schema";
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
    const now = new Date().toISOString();
    const [assigned] = existing
      ? await db.update(campaignLeads).set({
        assignmentType: "manual", matchStatus: "manual", matchReason: `人工设为主 Campaign：${campaign.name}`,
        matchedAt: now, updatedAt: now,
      }).where(eq(campaignLeads.id, existing.id)).returning()
      : await db.update(campaignLeads).set({
        campaignId,
        productTrack: campaign.productTrack,
        qualificationResult: lead.qualificationResult === "near_match" ? "qualified" : lead.qualificationResult,
        hardGateStatus: lead.hardGateStatus === "needs_review" ? "pass" : lead.hardGateStatus,
        hardGateReason: lead.hardGateStatus === "needs_review" ? `人工依据证据分配到 Campaign：${campaign.name}` : lead.hardGateReason,
        riskSummary: lead.riskSummary?.replace(/客户通过全局准入[^。]*。?/, "") || lead.riskSummary,
        assignmentType: "manual", matchStatus: "manual", matchReason: `人工分配到 Campaign：${campaign.name}`,
        matchedAt: now, updatedAt: now,
      }).where(eq(campaignLeads.id, id)).returning();
    if (existing) {
      await db.update(campaignLeads).set({ matchStatus: "stale", updatedAt: now }).where(eq(campaignLeads.id, id));
    }
    await db.update(prospectCompanies).set({ primaryCampaignId: campaignId, updatedAt: now })
      .where(eq(prospectCompanies.id, lead.companyId));
    await db.insert(leadReviewDecisions).values({
      id: crypto.randomUUID(), leadId: id, decision: "needs_review",
      notes: `从待分配人工分配到 Campaign：${campaign.name}`, decidedBy: "private_owner",
    });
    return Response.json({ lead: assigned, campaign, primaryCampaignId: campaignId });
  } catch (error) {
    return apiFailure(error);
  }
}
