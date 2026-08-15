import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { campaigns } from "@/db/schema";
import { UNASSIGNED_CAMPAIGN_ID, UNASSIGNED_CAMPAIGN_NAME } from "@/lib/campaign-routing";

export async function ensureUnassignedCampaign() {
  const db = getDb();
  await db.insert(campaigns).values({
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
  }).onConflictDoNothing();
  const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, UNASSIGNED_CAMPAIGN_ID)).limit(1);
  if (!campaign) throw new Error("unassigned_campaign_unavailable");
  return campaign;
}
