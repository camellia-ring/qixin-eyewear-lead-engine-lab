import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { campaigns } from "@/db/schema";
import {
  GLOBAL_DISCOVERY_CAMPAIGN_ID,
  GLOBAL_DISCOVERY_CAMPAIGN_NAME,
  UNASSIGNED_CAMPAIGN_ID,
  UNASSIGNED_CAMPAIGN_NAME,
} from "@/lib/campaign-routing";

async function ensureSystemCampaign(values: typeof campaigns.$inferInsert, unavailableError: string) {
  const db = getDb();
  await db.insert(campaigns).values(values).onConflictDoNothing();
  const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, values.id)).limit(1);
  if (!campaign) throw new Error(unavailableError);
  return campaign;
}

export async function ensureUnassignedCampaign() {
  return ensureSystemCampaign({
    id: UNASSIGNED_CAMPAIGN_ID,
    name: UNASSIGNED_CAMPAIGN_NAME,
    productTrack: "optical_lenses",
    targetCountriesJson: "[]",
    targetMarkets: "",
    productTypesJson: "[]",
    customerTypesJson: "[]",
    targetCount: 1,
    exclusionsJson: "[]",
    status: "paused",
  }, "unassigned_campaign_unavailable");
}

export async function ensureGlobalDiscoveryCampaign() {
  return ensureSystemCampaign({
    id: GLOBAL_DISCOVERY_CAMPAIGN_ID,
    name: GLOBAL_DISCOVERY_CAMPAIGN_NAME,
    productTrack: "optical_lenses",
    targetCountriesJson: "[]",
    targetMarkets: "全球",
    productTypesJson: "[]",
    customerTypesJson: "[]",
    targetCount: 1,
    exclusionsJson: "[]",
    status: "active",
  }, "global_discovery_campaign_unavailable");
}
