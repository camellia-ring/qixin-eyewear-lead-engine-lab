import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { campaigns, discoverySources } from "@/db/schema";
import { ApiError, apiFailure, jsonBody, textValue } from "@/lib/api";
import { normalizedDomain, publicHttpUrl } from "@/lib/discovery";
import { scheduleFromCadence } from "@/lib/discovery-runner";
import { canonicalSourceUrl } from "@/lib/lead-engine";

const CADENCES = new Set(["manual", "daily", "weekly"]);
const STATUSES = new Set(["active", "paused"]);

function cadenceValue(value: unknown, fallback = "manual") {
  const cadence = textValue(value || fallback, { field: "cadence", max: 20 });
  if (!CADENCES.has(cadence)) throw new ApiError(400, "invalid_cadence");
  return cadence;
}

function candidateLimit(value: unknown, fallback = 10) {
  const limit = Number(value ?? fallback);
  if (!Number.isInteger(limit) || limit < 1 || limit > 20) throw new ApiError(400, "invalid_candidate_limit", "每批候选数必须在 1–20 之间");
  return limit;
}

export async function POST(request: Request) {
  try {
    const body = await jsonBody(request);
    const campaignId = textValue(body.campaignId, { field: "campaignId", required: true, max: 100 });
    const name = textValue(body.name, { field: "name", required: true, max: 160 });
    const url = publicHttpUrl(textValue(body.sourceUrl, { field: "sourceUrl", required: true, max: 2048 })).toString();
    const sourceUrl = canonicalSourceUrl(url);
    const cadence = cadenceValue(body.cadence);
    const maxCandidates = candidateLimit(body.maxCandidates);
    const db = getDb();
    const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, campaignId)).limit(1);
    if (!campaign) throw new ApiError(404, "campaign_not_found");
    if (campaign.status !== "active") throw new ApiError(409, "campaign_not_active", "请先启用 Campaign，再添加自动发现来源");
    const [existing] = await db.select().from(discoverySources).where(and(
      eq(discoverySources.campaignId, campaignId), eq(discoverySources.sourceUrl, sourceUrl),
    )).limit(1);
    if (existing) throw new ApiError(409, "discovery_source_exists", "该 Campaign 已添加这个来源");
    const [source] = await db.insert(discoverySources).values({
      id: crypto.randomUUID(), campaignId, name, sourceUrl, normalizedDomain: normalizedDomain(sourceUrl),
      status: "active", cadence, maxCandidates,
      nextRunAt: cadence === "manual" ? null : new Date().toISOString(),
    }).returning();
    return Response.json({ source }, { status: 201 });
  } catch (error) {
    return apiFailure(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await jsonBody(request);
    const id = textValue(body.id, { field: "id", required: true, max: 100 });
    const db = getDb();
    const [current] = await db.select().from(discoverySources).where(eq(discoverySources.id, id)).limit(1);
    if (!current) throw new ApiError(404, "discovery_source_not_found");
    const status = body.status === undefined ? current.status : textValue(body.status, { field: "status", max: 20 });
    if (!STATUSES.has(status)) throw new ApiError(400, "invalid_source_status");
    const cadence = body.cadence === undefined ? current.cadence : cadenceValue(body.cadence, current.cadence);
    const now = new Date();
    const nextRunAt = cadence === "manual" || status === "paused"
      ? null
      : current.nextRunAt || scheduleFromCadence(cadence, now);
    const [source] = await db.update(discoverySources).set({
      name: body.name === undefined ? current.name : textValue(body.name, { field: "name", required: true, max: 160 }),
      status,
      cadence,
      maxCandidates: body.maxCandidates === undefined ? current.maxCandidates : candidateLimit(body.maxCandidates, current.maxCandidates),
      nextRunAt,
      updatedAt: now.toISOString(),
    }).where(eq(discoverySources.id, id)).returning();
    return Response.json({ source });
  } catch (error) {
    return apiFailure(error);
  }
}
