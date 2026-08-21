import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { campaigns } from "@/db/schema";
import { ApiError, apiFailure, jsonBody, textValue } from "@/lib/api";
import {
  CAMPAIGN_STATUSES,
  DEFAULT_EXCLUSIONS,
  PRODUCT_TRACKS,
  safeJsonList,
} from "@/lib/lead-engine";
import { UNASSIGNED_CAMPAIGN_ID } from "@/lib/campaign-routing";
import {
  DEFAULT_CAMPAIGN_CUSTOMER_TYPES,
  REGION_PRESETS,
  campaignCustomerTypes,
  campaignProductInterests,
  campaignStrategyName,
  defaultAutomationConfig,
  defaultCampaignCountries,
  isRegionKey,
  normalizeProductTracks,
} from "@/lib/campaign-strategy";
import { refreshAllCompanyCampaignMemberships } from "@/lib/campaign-membership";

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

function priority(value: unknown, fallback = 50) {
  const parsed = Number(value ?? fallback);
  if (![10, 50, 100].includes(parsed)) throw new ApiError(400, "invalid_campaign_priority");
  return parsed;
}

function strategyInput(body: Record<string, unknown>, current?: typeof campaigns.$inferSelect) {
  const requestedRegion = textValue(body.regionKey ?? current?.regionKey ?? "custom", { field: "regionKey", max: 40 });
  if (!isRegionKey(requestedRegion)) throw new ApiError(400, "invalid_campaign_region");
  const fallbackTrack = textValue(body.productTrack ?? current?.productTrack ?? "optical_lenses", { field: "productTrack", max: 50 });
  const productTracks = normalizeProductTracks(
    body.productTracks === undefined && current ? safeJsonList(current.productTracksJson, [fallbackTrack]) : safeJsonList(body.productTracks),
    fallbackTrack,
  );
  if (!productTracks.length) throw new ApiError(400, "campaign_product_required");
  const countries = body.targetCountries === undefined
    ? current ? safeJsonList(current.targetCountriesJson, defaultCampaignCountries(requestedRegion)) : defaultCampaignCountries(requestedRegion)
    : safeJsonList(body.targetCountries, defaultCampaignCountries(requestedRegion));
  const customerTypes = body.customerTypes === undefined
    ? current ? safeJsonList(current.customerTypesJson, DEFAULT_CAMPAIGN_CUSTOMER_TYPES) : DEFAULT_CAMPAIGN_CUSTOMER_TYPES
    : campaignCustomerTypes(safeJsonList(body.customerTypes, DEFAULT_CAMPAIGN_CUSTOMER_TYPES));
  return { regionKey: requestedRegion, productTracks, countries, customerTypes };
}

export async function POST(request: Request) {
  try {
    const body = await jsonBody(request);
    const strategy = strategyInput(body);
    const productTrack = strategy.productTracks[0];
    if (!PRODUCT_TRACKS.has(productTrack)) throw new ApiError(400, "invalid_product_track");
    const name = campaignStrategyName(strategy.regionKey, strategy.countries);
    const id = crypto.randomUUID();
    const db = getDb();
    const [campaign] = await db.insert(campaigns).values({
      id,
      name,
      productTrack,
      targetCountriesJson: JSON.stringify(strategy.countries),
      targetMarkets: REGION_PRESETS[strategy.regionKey].label,
      productTypesJson: JSON.stringify(campaignProductInterests(strategy.productTracks)),
      customerTypesJson: JSON.stringify(strategy.customerTypes),
      targetCount: targetCount(body.targetCount),
      moqFit: textValue(body.moqFit, { field: "moqFit", max: 500 }) || null,
      companySize: textValue(body.companySize, { field: "companySize", max: 300 }) || null,
      positioning: textValue(body.positioning, { field: "positioning", max: 500 }) || null,
      exclusionsJson: jsonList(body.exclusions, DEFAULT_EXCLUSIONS),
      regionKey: strategy.regionKey,
      productTracksJson: JSON.stringify(strategy.productTracks),
      strategyPriority: priority(body.strategyPriority),
      automationConfigJson: JSON.stringify(defaultAutomationConfig(strategy.regionKey)),
      status: validateStatus(body.status, "draft"),
    }).returning();
    const matchRefresh = campaign.status === "active" ? await refreshAllCompanyCampaignMemberships() : null;
    return Response.json({ campaign, matchRefresh }, { status: 201 });
  } catch (error) {
    return apiFailure(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await jsonBody(request);
    const id = textValue(body.id, { field: "id", required: true, max: 100 });
    if (id === UNASSIGNED_CAMPAIGN_ID) throw new ApiError(409, "system_campaign_read_only");
    const db = getDb();
    const [current] = await db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1);
    if (!current) throw new ApiError(404, "campaign_not_found");
    const strategy = strategyInput(body, current);
    const productTrack = strategy.productTracks[0];
    if (!PRODUCT_TRACKS.has(productTrack)) throw new ApiError(400, "invalid_product_track");
    const [campaign] = await db.update(campaigns).set({
      name: campaignStrategyName(strategy.regionKey, strategy.countries),
      productTrack,
      targetCountriesJson: JSON.stringify(strategy.countries),
      targetMarkets: REGION_PRESETS[strategy.regionKey].label,
      productTypesJson: JSON.stringify(campaignProductInterests(strategy.productTracks)),
      customerTypesJson: JSON.stringify(strategy.customerTypes),
      targetCount: body.targetCount === undefined ? current.targetCount : targetCount(body.targetCount),
      moqFit: body.moqFit === undefined ? current.moqFit : textValue(body.moqFit, { field: "moqFit", max: 500 }) || null,
      companySize: body.companySize === undefined ? current.companySize : textValue(body.companySize, { field: "companySize", max: 300 }) || null,
      positioning: body.positioning === undefined ? current.positioning : textValue(body.positioning, { field: "positioning", max: 500 }) || null,
      exclusionsJson: body.exclusions === undefined ? current.exclusionsJson : jsonList(body.exclusions),
      regionKey: strategy.regionKey,
      productTracksJson: JSON.stringify(strategy.productTracks),
      strategyPriority: body.strategyPriority === undefined ? current.strategyPriority : priority(body.strategyPriority, current.strategyPriority),
      automationConfigJson: body.regionKey === undefined
        ? current.automationConfigJson
        : JSON.stringify({ ...defaultAutomationConfig(strategy.regionKey), outreachMode: "disabled" }),
      status: body.status === undefined ? current.status : validateStatus(body.status, current.status),
      updatedAt: new Date().toISOString(),
    }).where(eq(campaigns.id, id)).returning();
    const routingChanged = current.status !== campaign.status
      || current.regionKey !== campaign.regionKey
      || current.targetCountriesJson !== campaign.targetCountriesJson
      || current.productTracksJson !== campaign.productTracksJson
      || current.customerTypesJson !== campaign.customerTypesJson
      || current.strategyPriority !== campaign.strategyPriority;
    const matchRefresh = routingChanged ? await refreshAllCompanyCampaignMemberships() : null;
    return Response.json({ campaign, matchRefresh });
  } catch (error) {
    return apiFailure(error);
  }
}
