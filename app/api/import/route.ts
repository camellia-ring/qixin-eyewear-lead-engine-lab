import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { campaigns, candidateCompanies, candidateContacts, evidenceItems } from "@/db/schema";
import { ApiError, apiFailure, jsonBody, textValue } from "@/lib/api";
import {
  PRODUCT_TRACKS,
  calculateScore,
  crmProductInterests,
  identityKey,
  normalizeSourceUrl,
  normalizeWebsite,
} from "@/lib/lead-engine";

function optionalEmail(value: unknown, field: string) {
  const email = textValue(value, { field, max: 254 }).toLocaleLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ApiError(400, "invalid_email", `${field} is invalid`);
  return email;
}

export async function POST(request: Request) {
  try {
    const body = await jsonBody(request);
    const campaignId = textValue(body.campaignId, { field: "campaignId", required: true, max: 100 });
    if (!Array.isArray(body.records) || body.records.length < 1 || body.records.length > 100) {
      throw new ApiError(400, "invalid_record_count");
    }
    const db = getDb();
    const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, campaignId)).limit(1);
    if (!campaign) throw new ApiError(404, "campaign_not_found");

    const results: Array<Record<string, unknown>> = [];
    for (let index = 0; index < body.records.length; index += 1) {
      const record = body.records[index] as Record<string, unknown>;
      try {
        const companyName = textValue(record.companyName, { field: "companyName", required: true, max: 180 });
        const country = textValue(record.country, { field: "country", max: 120 });
        const website = normalizeWebsite(record.website);
        const sourceUrl = normalizeSourceUrl(record.sourceUrl || record.website);
        if (!sourceUrl) throw new ApiError(400, "source_required");
        const productTrack = textValue(record.productTrack || campaign.productTrack, { field: "productTrack", required: true, max: 50 });
        if (!PRODUCT_TRACKS.has(productTrack)) throw new ApiError(400, "invalid_product_track");
        const score = calculateScore(record);
        const disqualificationReason = textValue(record.disqualificationReason, { field: "disqualificationReason", max: 500 });
        const contactName = textValue(record.contactName, { field: "contactName", max: 160 });
        const contactEmail = optionalEmail(record.contactEmail, "contactEmail");
        if (contactEmail && !contactName) throw new ApiError(400, "contact_name_required");
        const contactRole = textValue(record.contactRole, { field: "contactRole", max: 160 });
        const whatsapp = textValue(record.whatsapp, { field: "whatsapp", max: 100 });
        const contactVerification = textValue(record.contactVerification, { field: "contactVerification", max: 50 }) || "unverified";
        const evidenceSummary = textValue(record.evidenceSummary, { field: "evidenceSummary", max: 5000 });
        const lastVerifiedAt = textValue(record.lastVerifiedAt, { field: "lastVerifiedAt", max: 40 });
        const companyIdentity = identityKey(companyName, country, website.normalized);
        const [duplicate] = await db.select({ id: candidateCompanies.id }).from(candidateCompanies).where(and(
          eq(candidateCompanies.campaignId, campaignId),
          eq(candidateCompanies.identityKey, companyIdentity),
        )).limit(1);
        if (duplicate) {
          results.push({ row: index + 1, status: "duplicate", companyName });
          continue;
        }
        const companyId = crypto.randomUUID();
        const companyInsert = db.insert(candidateCompanies).values({
          id: companyId,
          campaignId,
          companyName,
          identityKey: companyIdentity,
          website: website.original || null,
          websiteNormalized: website.normalized || null,
          country: country || null,
          customerType: textValue(record.customerType, { field: "customerType", max: 160 }) || null,
          productTrack,
          productInterests: textValue(record.productInterests, { field: "productInterests", max: 500 }) || crmProductInterests(productTrack),
          estimatedPurchaseVolume: textValue(record.estimatedPurchaseVolume, { field: "estimatedPurchaseVolume", max: 500 }) || null,
          businessEmail: optionalEmail(record.businessEmail, "businessEmail") || null,
          contactChannel: textValue(record.contactChannel, { field: "contactChannel", max: 500 }) || null,
          sourceUrl,
          evidenceSummary: evidenceSummary || null,
          ...score.breakdown,
          totalScore: score.total,
          grade: score.grade,
          reviewStatus: disqualificationReason ? "rejected" : "new",
          disqualificationReason: disqualificationReason || null,
          doNotContact: disqualificationReason === "do_not_contact",
          lastVerifiedAt: lastVerifiedAt || null,
        });
        const evidenceInsert = db.insert(evidenceItems).values({
          id: crypto.randomUUID(),
          companyId,
          evidenceType: "company_source",
          title: "Imported source evidence",
          sourceUrl,
          observedValue: evidenceSummary || null,
          capturedAt: lastVerifiedAt || new Date().toISOString(),
        });
        if (contactName) {
          const contactInsert = db.insert(candidateContacts).values({
            id: crypto.randomUUID(),
            companyId,
            fullName: contactName,
            jobTitle: contactRole || null,
            email: contactEmail || null,
            whatsapp: whatsapp || null,
            verificationStatus: contactVerification,
            sourceUrl,
            isPrimary: true,
          });
          await db.batch([companyInsert, contactInsert, evidenceInsert]);
        } else {
          await db.batch([companyInsert, evidenceInsert]);
        }
        results.push({ row: index + 1, status: disqualificationReason ? "rejected" : "imported", companyId, companyName, score: score.total, grade: score.grade });
      } catch (error) {
        results.push({
          row: index + 1,
          status: "invalid",
          error: error instanceof ApiError ? error.code : error instanceof Error ? error.message : "invalid_record",
        });
      }
    }

    return Response.json({
      imported: results.filter((item) => item.status === "imported" || item.status === "rejected").length,
      skipped: results.filter((item) => item.status === "duplicate" || item.status === "invalid").length,
      results,
    });
  } catch (error) {
    return apiFailure(error);
  }
}
