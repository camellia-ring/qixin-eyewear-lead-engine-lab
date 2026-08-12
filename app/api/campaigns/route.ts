import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { campaigns } from "@/db/schema";
import { ApiError, apiFailure, jsonBody, textValue } from "@/lib/api";
import {
  CAMPAIGN_STATUSES,
  DEFAULT_CUSTOMER_TYPES,
  DEFAULT_EXCLUSIONS,
  PRODUCT_TRACKS,
  crmProductInterests,
  safeJsonList,
} from "@/lib/lead-engine";

function targetCount(value: unknown, fallback = 30) {
  const count = Number(value ?? fallback);
  if (!Number.isInteger(count) || count < 1 || count > 500) throw new ApiError(400, "invalid_target_count");
  return count;
}

function jsonList(value: unknown, fallback: string[] = []) {
  return JSON.stringify(safeJsonList(value, fallback));
}

function validateStatus(value: unknown, fallback: string) {
  const status = textValue(value || fallback, { field: "status", max: 30 });
  if (!CAMPAIGN_STATUSES.has(status)) throw new ApiError(400, "invalid_campaign_status");
  return status;
}

export async function POST(request: Request) {
  try {
    const body = await jsonBody(request);
    const name = textValue(body.name, { field: "name", required: true, max: 160 });
    const productTrack = textValue(body.productTrack, { field: "productTrack", required: true, max: 50 });
    if (!PRODUCT_TRACKS.has(productTrack)) throw new ApiError(400, "invalid_product_track");
    const id = crypto.randomUUID();
    const db = getDb();
    const [campaign] = await db.insert(campaigns).values({
      id,
      name,
      productTrack,
      targetCountriesJson: jsonList(body.targetCountries),
      targetMarkets: textValue(body.targetMarkets, { field: "targetMarkets", max: 500 }),
      productTypesJson: jsonList(body.productTypes, crmProductInterests(productTrack)),
      customerTypesJson: jsonList(body.customerTypes, DEFAULT_CUSTOMER_TYPES),
      targetCount: targetCount(body.targetCount),
      moqFit: textValue(body.moqFit, { field: "moqFit", max: 500 }) || null,
      companySize: textValue(body.companySize, { field: "companySize", max: 300 }) || null,
      positioning: textValue(body.positioning, { field: "positioning", max: 500 }) || null,
      exclusionsJson: jsonList(body.exclusions, DEFAULT_EXCLUSIONS),
      status: validateStatus(body.status, "draft"),
    }).returning();
    return Response.json({ campaign }, { status: 201 });
  } catch (error) {
    return apiFailure(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await jsonBody(request);
    const id = textValue(body.id, { field: "id", required: true, max: 100 });
    const db = getDb();
    const [current] = await db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1);
    if (!current) throw new ApiError(404, "campaign_not_found");
    const productTrack = body.productTrack === undefined
      ? current.productTrack
      : textValue(body.productTrack, { field: "productTrack", required: true, max: 50 });
    if (!PRODUCT_TRACKS.has(productTrack)) throw new ApiError(400, "invalid_product_track");
    const [campaign] = await db.update(campaigns).set({
      name: body.name === undefined ? current.name : textValue(body.name, { field: "name", required: true, max: 160 }),
      productTrack,
      targetCountriesJson: body.targetCountries === undefined ? current.targetCountriesJson : jsonList(body.targetCountries),
      targetMarkets: body.targetMarkets === undefined ? current.targetMarkets : textValue(body.targetMarkets, { field: "targetMarkets", max: 500 }),
      productTypesJson: body.productTypes === undefined ? current.productTypesJson : jsonList(body.productTypes),
      customerTypesJson: body.customerTypes === undefined ? current.customerTypesJson : jsonList(body.customerTypes),
      targetCount: body.targetCount === undefined ? current.targetCount : targetCount(body.targetCount),
      moqFit: body.moqFit === undefined ? current.moqFit : textValue(body.moqFit, { field: "moqFit", max: 500 }) || null,
      companySize: body.companySize === undefined ? current.companySize : textValue(body.companySize, { field: "companySize", max: 300 }) || null,
      positioning: body.positioning === undefined ? current.positioning : textValue(body.positioning, { field: "positioning", max: 500 }) || null,
      exclusionsJson: body.exclusions === undefined ? current.exclusionsJson : jsonList(body.exclusions),
      status: body.status === undefined ? current.status : validateStatus(body.status, current.status),
      updatedAt: new Date().toISOString(),
    }).where(eq(campaigns.id, id)).returning();
    return Response.json({ campaign });
  } catch (error) {
    return apiFailure(error);
  }
}
