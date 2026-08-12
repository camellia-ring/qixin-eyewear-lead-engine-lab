import { getDb } from "@/db";
import { campaigns } from "@/db/schema";
import { ApiError, apiFailure, jsonBody, textValue } from "@/lib/api";
import { PRODUCT_TRACKS } from "@/lib/lead-engine";

export async function POST(request: Request) {
  try {
    const body = await jsonBody(request);
    const name = textValue(body.name, { field: "name", required: true, max: 160 });
    const productTrack = textValue(body.productTrack, { field: "productTrack", required: true, max: 50 });
    if (!PRODUCT_TRACKS.has(productTrack)) throw new ApiError(400, "invalid_product_track");
    const targetMarkets = textValue(body.targetMarkets, { field: "targetMarkets", max: 500 });
    const targetCount = Number(body.targetCount ?? 30);
    if (!Number.isInteger(targetCount) || targetCount < 1 || targetCount > 500) throw new ApiError(400, "invalid_target_count");
    const id = crypto.randomUUID();
    const db = getDb();
    const [campaign] = await db.insert(campaigns).values({
      id,
      name,
      productTrack,
      targetMarkets,
      targetCount,
      status: "active",
    }).returning();
    return Response.json({ campaign }, { status: 201 });
  } catch (error) {
    return apiFailure(error);
  }
}

