import { and, eq } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { getDb } from "@/db";
import {
  campaigns,
  campaignLeads,
  companyDomainLinks,
  companyDomains,
  evidenceClaims,
  leadImportRuns,
  leadScoreDimensions,
  leadScoreRuns,
  leadSources,
  prospectCompanies,
  prospectContacts,
} from "@/db/schema";
import { ApiError, apiFailure, jsonBody, textValue } from "@/lib/api";
import {
  CONFIDENCE_LEVELS,
  PRODUCT_TRACKS,
  SCORE_LIMITS,
  SCORE_REASON_FIELDS,
  calculateScore,
  canonicalSourceUrl,
  companyNamesLikelySame,
  domainsLikelySame,
  crmProductInterests,
  identityKey,
  normalizeSourceUrl,
  normalizeWebsite,
  registrableDomain,
  safeJsonList,
  stringList,
} from "@/lib/lead-engine";
import {
  EXTERNAL_IMPORT_MODEL_IDENTIFIER,
  externalImportRubricVersion,
  importedLeadPendingVerification,
} from "@/lib/import-policy";

type SourceRecord = {
  id: string;
  sourceUrl: string;
  canonicalUrl: string;
  sourceType: string;
  pageTitle: string | null;
  retrievedAt: string;
  evidenceSummary: string | null;
  confidence: "low" | "medium" | "high";
};

type ClaimRecord = {
  sourceIndex: number;
  claimType: string;
  claimSummary: string;
  evidenceKind: "observed" | "inferred" | "unknown";
  confidence: "low" | "medium" | "high";
};

function optionalEmail(value: unknown, field: string) {
  const email = textValue(value, { field, max: 254 }).toLocaleLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ApiError(400, "invalid_email", `${field} is invalid`);
  return email;
}

function confidence(value: unknown, field: string, fallback: "low" | "medium" | "high" = "low") {
  const result = textValue(value || fallback, { field, max: 20 }) as "low" | "medium" | "high";
  if (!CONFIDENCE_LEVELS.has(result)) throw new ApiError(400, "invalid_confidence", `${field} is invalid`);
  return result;
}

function isoTime(value: unknown, field: string, required = false) {
  const source = textValue(value, { field, max: 50, required });
  if (!source) return "";
  const date = new Date(source);
  if (Number.isNaN(date.getTime())) throw new ApiError(400, "invalid_timestamp", `${field} is invalid`);
  return date.toISOString();
}

function booleanValue(value: unknown) {
  if (typeof value === "boolean") return value;
  const source = String(value ?? "").trim().toLocaleLowerCase();
  if (!source) return false;
  if (new Set(["true", "1", "yes", "y"]).has(source)) return true;
  if (new Set(["false", "0", "no", "n"]).has(source)) return false;
  throw new ApiError(400, "invalid_boolean");
}

function sourceRecords(record: Record<string, unknown>) {
  const rawSources = Array.isArray(record.sources) ? record.sources : null;
  if (rawSources && rawSources.length > 10) throw new ApiError(400, "too_many_sources");
  const inputs: Array<Record<string, unknown>> = rawSources
    ? rawSources.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    : stringList(record.sourceUrls || record.sourceUrl, 10).map((sourceUrl) => ({
      sourceUrl,
      sourceType: record.sourceType,
      pageTitle: record.sourceTitle,
      retrievedAt: record.retrievedAt || record.lastVerifiedAt,
      evidenceSummary: record.evidenceSummary,
      confidence: record.sourceConfidence,
    }));
  if (!inputs.length) throw new ApiError(400, "source_required");
  return inputs.map((item, index): SourceRecord => {
    const sourceUrl = normalizeSourceUrl(item.sourceUrl || item.url);
    if (!sourceUrl) throw new ApiError(400, "source_required", `source ${index + 1} is required`);
    if (sourceUrl.length > 2048) throw new ApiError(400, "source_url_too_long");
    return {
      id: crypto.randomUUID(),
      sourceUrl,
      canonicalUrl: canonicalSourceUrl(sourceUrl),
      sourceType: textValue(item.sourceType || item.type || "company_website", { field: "sourceType", max: 80 }),
      pageTitle: textValue(item.pageTitle || item.title, { field: "sourceTitle", max: 300 }) || null,
      retrievedAt: isoTime(item.retrievedAt || item.capturedAt, "retrievedAt", true),
      evidenceSummary: textValue(item.evidenceSummary || item.summary, { field: "evidenceSummary", max: 5000 }) || null,
      confidence: confidence(item.confidence, "sourceConfidence"),
    };
  });
}

function claimRecords(record: Record<string, unknown>, sources: SourceRecord[]) {
  const rawClaims = Array.isArray(record.claims) ? record.claims : null;
  if (rawClaims && rawClaims.length > 30) throw new ApiError(400, "too_many_claims");
  const inputs: Array<Record<string, unknown>> = rawClaims
    ? rawClaims.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    : textValue(record.evidenceSummary, { field: "evidenceSummary", max: 5000 })
      ? [{
        sourceIndex: 0,
        claimType: record.claimType || "company_fit",
        claimSummary: record.evidenceSummary,
        evidenceKind: record.evidenceKind || "unknown",
        confidence: record.claimConfidence || record.sourceConfidence,
      }]
      : [];
  return inputs.map((item): ClaimRecord => {
    const sourceIndex = Number(item.sourceIndex ?? 0);
    if (!Number.isInteger(sourceIndex) || sourceIndex < 0 || sourceIndex >= sources.length) throw new ApiError(400, "invalid_claim_source");
    const evidenceKind = textValue(item.evidenceKind || item.kind || "unknown", { field: "evidenceKind", max: 20 }) as ClaimRecord["evidenceKind"];
    if (!new Set(["observed", "inferred", "unknown"]).has(evidenceKind)) throw new ApiError(400, "invalid_evidence_kind");
    return {
      sourceIndex,
      claimType: textValue(item.claimType || item.type, { field: "claimType", required: true, max: 100 }),
      claimSummary: textValue(item.claimSummary || item.summary, { field: "claimSummary", required: true, max: 5000 }),
      evidenceKind,
      confidence: confidence(item.confidence, "claimConfidence"),
    };
  });
}

function scoreReasons(record: Record<string, unknown>) {
  return Object.entries(SCORE_REASON_FIELDS).map(([dimension, [positiveField, negativeField]]) => {
    const score = Number(record[dimension] ?? 0);
    const positiveReason = textValue(record[positiveField], { field: positiveField, max: 2000 });
    const negativeReason = textValue(record[negativeField], { field: negativeField, max: 2000 });
    if (!positiveReason && !negativeReason) throw new ApiError(400, "score_reason_required", `${dimension} needs a reason`);
    if (score > 0 && !positiveReason) throw new ApiError(400, "positive_score_reason_required", `${dimension} needs a positive reason`);
    return { dimension, positiveReason: positiveReason || null, negativeReason: negativeReason || null };
  });
}

export async function POST(request: Request) {
  try {
    const body = await jsonBody(request);
    const campaignId = textValue(body.campaignId, { field: "campaignId", required: true, max: 100 });
    const idempotencyKey = textValue(body.idempotencyKey, { field: "idempotencyKey", required: true, max: 200 });
    const originalFilename = textValue(body.originalFilename, { field: "originalFilename", max: 255 });
    if (!Array.isArray(body.records) || body.records.length < 1 || body.records.length > 100) {
      throw new ApiError(400, "invalid_record_count");
    }
    const db = getDb();
    const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, campaignId)).limit(1);
    if (!campaign) throw new ApiError(404, "campaign_not_found");
    if (campaign.status !== "active") throw new ApiError(409, "campaign_not_active");

    const [previousRun] = await db.select().from(leadImportRuns).where(and(
      eq(leadImportRuns.campaignId, campaignId),
      eq(leadImportRuns.idempotencyKey, idempotencyKey),
    )).limit(1);
    if (previousRun) {
      return Response.json({
        importRunId: previousRun.id,
        imported: previousRun.importedCount,
        skipped: previousRun.skippedCount,
        results: JSON.parse(previousRun.errorsJson),
        replayed: true,
      });
    }

    const importRunId = crypto.randomUUID();
    await db.insert(leadImportRuns).values({
      id: importRunId,
      campaignId,
      source: "reviewed_upload",
      originalFilename: originalFilename || null,
      idempotencyKey,
      rowCount: body.records.length,
      status: "pending",
    });

    const knownCompanies = await db.select({
      id: prospectCompanies.id,
      identityKey: prospectCompanies.identityKey,
      companyName: prospectCompanies.companyName,
      country: prospectCompanies.country,
      city: prospectCompanies.city,
      website: prospectCompanies.website,
      primaryDomain: prospectCompanies.primaryDomain,
      brandsJson: prospectCompanies.brandsJson,
      businessEmail: prospectCompanies.businessEmail,
      contactChannel: prospectCompanies.contactChannel,
      doNotContact: prospectCompanies.doNotContact,
      primaryCampaignId: prospectCompanies.primaryCampaignId,
    }).from(prospectCompanies);
    const importedIdentities: Array<{ companyId: string; companyName: string; domain: string; brands: string[] }> = [];
    const results: Array<Record<string, unknown>> = [];
    for (let index = 0; index < body.records.length; index += 1) {
      const record = body.records[index] as Record<string, unknown>;
      try {
        const companyName = textValue(record.companyName, { field: "companyName", required: true, max: 180 });
        const country = textValue(record.country, { field: "country", max: 120 });
        const website = normalizeWebsite(record.website);
        const companyIdentity = identityKey(companyName, country, website.normalized);
        const sources = sourceRecords(record);
        const claims = claimRecords(record, sources);
        if (!claims.length) throw new ApiError(400, "evidence_claim_required");
        const recordBrands = safeJsonList(record.brands);
        const score = calculateScore(record);
        const reasons = scoreReasons(record);
        const productTrack = textValue(record.productTrack || campaign.productTrack, { field: "productTrack", required: true, max: 50 });
        if (!PRODUCT_TRACKS.has(productTrack)) throw new ApiError(400, "invalid_product_track");
        const hardGateReason = textValue(record.hardGateReason || record.disqualificationReason, { field: "hardGateReason", max: 1000 });
        if (score.hardGateStatus === "fail" && !hardGateReason) throw new ApiError(400, "hard_gate_reason_required");
        const importedDuplicate = importedIdentities.find((candidate) => companyNamesLikelySame(candidate.companyName, companyName)
          || candidate.brands.some((brand) => companyNamesLikelySame(brand, companyName))
          || recordBrands.some((brand) => companyNamesLikelySame(brand, candidate.companyName)
            || candidate.brands.some((knownBrand) => companyNamesLikelySame(brand, knownBrand)))
          || (registrableDomain(candidate.domain) === registrableDomain(website.normalized) && Boolean(registrableDomain(candidate.domain)))
          || (domainsLikelySame(candidate.domain, website.normalized) && companyNamesLikelySame(candidate.companyName, companyName)));
        if (importedDuplicate) {
          results.push({ row: index + 1, status: "duplicate", companyName, companyId: importedDuplicate.companyId, reason: "同一导入批次的公司主体、品牌或域名重复" });
          continue;
        }
        const existingCompany = knownCompanies.find((candidate) => candidate.identityKey === companyIdentity
          || companyNamesLikelySame(companyName, candidate.companyName)
          || safeJsonList(candidate.brandsJson).some((brand) => companyNamesLikelySame(brand, companyName))
          || recordBrands.some((brand) => companyNamesLikelySame(brand, candidate.companyName)
            || safeJsonList(candidate.brandsJson).some((knownBrand) => companyNamesLikelySame(brand, knownBrand)))
          || (registrableDomain(candidate.primaryDomain) === registrableDomain(website.normalized) && Boolean(registrableDomain(candidate.primaryDomain)))
          || (domainsLikelySame(candidate.primaryDomain, website.normalized) && companyNamesLikelySame(companyName, candidate.companyName)));
        const companyId = existingCompany?.id || crypto.randomUUID();
        const [existingLead] = await db.select({ id: campaignLeads.id }).from(campaignLeads).where(and(
          eq(campaignLeads.campaignId, campaignId),
          eq(campaignLeads.companyId, companyId),
        )).limit(1);
        if (existingLead) {
          results.push({ row: index + 1, status: "duplicate", companyName, companyId, leadId: existingLead.id });
          continue;
        }

        const leadId = crypto.randomUUID();
        const scoreRunId = crypto.randomUUID();
        const contactName = textValue(record.contactName, { field: "contactName", max: 160 });
        const contactEmail = optionalEmail(record.contactEmail, "contactEmail");
        if (contactEmail && !contactName) throw new ApiError(400, "contact_name_required");
        const pendingVerification = importedLeadPendingVerification({
          hardGateStatus: score.hardGateStatus,
          score: score.total,
          evidenceCoverage: score.evidenceCoverage,
          hardGateReason,
          riskSummary: textValue(record.riskSummary, { field: "riskSummary", max: 5000 }),
        });
        const products = safeJsonList(record.productInterests || record.recommendedProducts, crmProductInterests(productTrack));
        const customerTypes = safeJsonList(record.customerTypes || record.customerType || record.companyType);
        const productDirections = safeJsonList(record.productDirections || record.recommendedProducts || record.products, products);
        claims.push({
          sourceIndex: 0,
          claimType: "external_scope_input",
          claimSummary: `外部文件声明的商业角色：${customerTypes.join("、") || "未提供"}；产品方向：${productDirections.join("、") || "未提供"}。未经服务器核验。`.slice(0, 5000),
          evidenceKind: "unknown",
          confidence: "low",
        });
        const statements: BatchItem<"sqlite">[] = [];

        if (existingCompany) {
          statements.push(db.update(prospectCompanies).set({
            country: existingCompany.country || country || null,
            city: existingCompany.city || textValue(record.city, { field: "city", max: 160 }) || null,
            website: existingCompany.website || website.original || null,
            primaryDomain: existingCompany.primaryDomain || website.normalized || null,
            businessEmail: existingCompany.businessEmail || optionalEmail(record.businessEmail, "businessEmail") || null,
            contactChannel: existingCompany.contactChannel || textValue(record.contactChannel, { field: "contactChannel", max: 500 }) || null,
            doNotContact: booleanValue(record.doNotContact) || existingCompany.doNotContact,
            primaryCampaignId: existingCompany.primaryCampaignId || campaignId,
            updatedAt: new Date().toISOString(),
          }).where(eq(prospectCompanies.id, companyId)));
        } else {
          statements.push(db.insert(prospectCompanies).values({
            id: companyId,
            companyName,
            identityKey: companyIdentity,
            country: country || null,
            city: textValue(record.city, { field: "city", max: 160 }) || null,
            companyType: null,
            customerType: null,
            customerTypesJson: "[]",
            businessModel: null,
            website: website.original || null,
            primaryDomain: website.normalized || null,
            productsJson: "[]",
            productDirectionsJson: "[]",
            brandsJson: JSON.stringify(recordBrands),
            wholesaleSignal: null,
            privateLabelSignal: null,
            oemSignal: null,
            pricePosition: null,
            companySize: null,
            analysisSummary: pendingVerification.riskSummary,
            analysisConfidence: "low",
            businessEmail: optionalEmail(record.businessEmail, "businessEmail") || null,
            contactChannel: textValue(record.contactChannel, { field: "contactChannel", max: 500 }) || null,
            estimatedPurchaseVolume: null,
            doNotContact: booleanValue(record.doNotContact),
            primaryCampaignId: campaignId,
            lastAnalyzedAt: isoTime(record.lastVerifiedAt || record.lastAnalyzedAt, "lastAnalyzedAt") || sources[0].retrievedAt,
          }));
        }

        if (website.normalized) {
          const [existingDomain] = await db.select().from(companyDomains).where(eq(companyDomains.normalizedDomain, website.normalized)).limit(1);
          const domainId = existingDomain?.id || crypto.randomUUID();
          if (!existingDomain) statements.push(db.insert(companyDomains).values({
            id: domainId,
            normalizedDomain: website.normalized,
            registrableDomain: registrableDomain(website.normalized),
            observedUrl: website.original,
          }));
          const [existingLink] = existingCompany ? await db.select({ id: companyDomainLinks.id }).from(companyDomainLinks).where(and(
            eq(companyDomainLinks.companyId, companyId),
            eq(companyDomainLinks.domainId, domainId),
          )).limit(1) : [];
          if (!existingLink) statements.push(db.insert(companyDomainLinks).values({
            id: crypto.randomUUID(), companyId, domainId, relationshipType: "primary", isPrimary: true,
          }));
        }

        statements.push(db.insert(campaignLeads).values({
          id: leadId,
          campaignId,
          companyId,
          importRunId,
          qualificationResult: pendingVerification.qualificationResult,
          workflowStatus: pendingVerification.workflowStatus,
          productTrack,
          recommendedProductsJson: JSON.stringify(products),
          riskSummary: pendingVerification.riskSummary,
          hardGateStatus: pendingVerification.hardGateStatus,
          hardGateReason: pendingVerification.hardGateReason,
          currentScore: pendingVerification.currentScore,
          grade: pendingVerification.grade,
          evidenceCoverage: pendingVerification.evidenceCoverage,
          scoreConfidence: pendingVerification.scoreConfidence,
          assignmentType: "manual",
          matchStatus: "manual",
          matchReason: "负责人审核后的结构化导入",
          matchedAt: new Date().toISOString(),
        }));
        for (const source of sources) statements.push(db.insert(leadSources).values({ ...source, companyId, leadId }));
        for (const claim of claims) statements.push(db.insert(evidenceClaims).values({
          id: crypto.randomUUID(),
          sourceId: sources[claim.sourceIndex].id,
          companyId,
          leadId,
          claimType: claim.claimType,
          claimSummary: claim.claimSummary,
          evidenceKind: claim.evidenceKind,
          confidence: claim.confidence,
        }));
        statements.push(db.insert(leadScoreRuns).values({
          id: scoreRunId,
          leadId,
          rubricVersion: externalImportRubricVersion(),
          totalScore: score.total,
          grade: score.grade,
          evidenceCoverage: score.evidenceCoverage,
          overallConfidence: score.confidence,
          modelIdentifier: `external_input:${textValue(record.modelIdentifier, { field: "modelIdentifier", max: 120 }) || EXTERNAL_IMPORT_MODEL_IDENTIFIER}`,
        }));
        for (const reason of reasons) statements.push(db.insert(leadScoreDimensions).values({
          id: crypto.randomUUID(),
          scoreRunId,
          dimension: reason.dimension,
          score: score.breakdown[reason.dimension as keyof typeof SCORE_LIMITS],
          maxScore: SCORE_LIMITS[reason.dimension as keyof typeof SCORE_LIMITS],
          positiveReason: reason.positiveReason,
          negativeReason: reason.negativeReason,
          evidenceIdsJson: JSON.stringify(sources.map((source) => source.id)),
        }));
        if (contactName) statements.push(db.insert(prospectContacts).values({
          id: crypto.randomUUID(),
          companyId,
          fullName: contactName,
          jobTitle: textValue(record.contactRole, { field: "contactRole", max: 160 }) || null,
          email: contactEmail || null,
          whatsapp: textValue(record.whatsapp, { field: "whatsapp", max: 100 }) || null,
          verificationStatus: textValue(record.contactVerification, { field: "contactVerification", max: 50 }) || "unverified",
          sourceUrl: sources[0].sourceUrl,
          isPrimary: true,
        }));

        await db.batch(statements as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);
        importedIdentities.push({ companyId, companyName, domain: website.normalized, brands: recordBrands });
        results.push({ row: index + 1, status: "imported", companyId, leadId, companyName, externalScore: score.total, requiresReverification: true });
      } catch (error) {
        results.push({
          row: index + 1,
          status: "invalid",
          error: error instanceof ApiError ? error.code : error instanceof Error ? error.message : "invalid_record",
        });
      }
    }

    const imported = results.filter((item) => item.status === "imported").length;
    const skipped = results.length - imported;
    const completedAt = new Date().toISOString();
    await db.update(leadImportRuns).set({
      importedCount: imported,
      skippedCount: skipped,
      errorsJson: JSON.stringify(results.filter((item) => item.status !== "imported")),
      status: "completed",
      completedAt,
    }).where(eq(leadImportRuns.id, importRunId));

    return Response.json({ importRunId, imported, skipped, results, replayed: false });
  } catch (error) {
    return apiFailure(error);
  }
}
