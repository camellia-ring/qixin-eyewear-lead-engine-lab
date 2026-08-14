import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  campaignLeads,
  contactVerifications,
  evidenceClaims,
  leadScoreDimensions,
  leadScoreRuns,
  leadSources,
  prospectCompanies,
} from "@/db/schema";
import { collectSiteEvidence, deterministicScore, normalizedDomain, type DiscoveryCandidate } from "@/lib/discovery";
import { calculateScore, canonicalSourceUrl, RUBRIC_VERSION } from "@/lib/lead-engine";
import { qualifyEvidence } from "@/lib/qualification";

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function reverifyLead(leadId: string) {
  const db = getDb();
  const [lead] = await db.select().from(campaignLeads).where(eq(campaignLeads.id, leadId)).limit(1);
  if (!lead) throw new Error("lead_not_found");
  const [company] = await db.select().from(prospectCompanies).where(eq(prospectCompanies.id, lead.companyId)).limit(1);
  if (!company?.website) throw new Error("company_website_missing");
  const candidate: DiscoveryCandidate = {
    websiteUrl: company.website,
    normalizedDomain: company.primaryDomain || normalizedDomain(company.website),
    label: company.companyName,
  };
  const evidence = await collectSiteEvidence(candidate);
  const scoreInput = deterministicScore(evidence);
  const score = calculateScore(scoreInput);
  const qualification = qualifyEvidence({
    evidence, score: score.total, evidenceCoverage: score.evidenceCoverage,
    officialWebsiteVerified: true, sourceIsOfficial: true,
    duplicate: company.isDuplicate, doNotContact: company.doNotContact,
  });
  const now = new Date().toISOString();

  await db.update(prospectCompanies).set({
    companyName: evidence.companyName || company.companyName,
    country: evidence.country || company.country,
    companyType: evidence.companyType,
    customerType: qualification.customerType || null,
    companyRole: qualification.companyRole,
    productsJson: JSON.stringify(evidence.eyewearTerms.slice(0, 12)),
    productDirectionsJson: JSON.stringify(qualification.productDirections),
    wholesaleSignal: evidence.b2bTerms.length ? `Observed terms: ${evidence.b2bTerms.slice(0, 8).join(", ")}` : null,
    analysisSummary: [...qualification.reasons, ...qualification.failures].join("；").slice(0, 3000),
    analysisConfidence: evidence.pages.length >= 2 ? "medium" : "low",
    businessEmail: evidence.businessEmail || null,
    contactChannel: evidence.contactChannel || null,
    contactStatus: qualification.validContact ? "valid" : "missing",
    lastAnalyzedAt: now, lastVerifiedAt: now, updatedAt: now,
  }).where(eq(prospectCompanies.id, company.id));
  await db.update(campaignLeads).set({
    qualificationResult: qualification.qualified ? "qualified" : "rejected",
    workflowStatus: qualification.qualified && lead.workflowStatus === "approved" ? "approved" : qualification.qualified ? "needs_review" : "rejected",
    recommendedProductsJson: JSON.stringify(qualification.productDirections),
    riskSummary: qualification.failures.join("；") || "重新核验通过；人工批准前不得联系或写入生产 CRM。",
    hardGateStatus: qualification.hardGateStatus,
    hardGateReason: qualification.qualified ? qualification.reasons.join("；") : qualification.failures.join("；"),
    currentScore: score.total, grade: score.grade, evidenceCoverage: score.evidenceCoverage,
    scoreConfidence: score.confidence, autoQualifiedAt: qualification.qualified ? lead.autoQualifiedAt || now : null,
    lastVerifiedAt: now, updatedAt: now,
  }).where(eq(campaignLeads.id, lead.id));

  const evidenceIds: string[] = [];
  for (const page of evidence.pages) {
    const canonicalUrl = canonicalSourceUrl(page.url);
    await db.insert(leadSources).values({
      id: crypto.randomUUID(), companyId: company.id, leadId: lead.id,
      sourceUrl: page.url, canonicalUrl, sourceType: "company_website", pageTitle: page.title || null,
      retrievedAt: now, evidenceSummary: "手工重新核验的企业官网公开页面",
      contentHash: await sha256(page.html), confidence: "medium",
    }).onConflictDoNothing();
    const [source] = await db.select({ id: leadSources.id }).from(leadSources).where(and(
      eq(leadSources.leadId, lead.id), eq(leadSources.canonicalUrl, canonicalUrl),
    )).limit(1);
    if (source) {
      const claimId = crypto.randomUUID();
      evidenceIds.push(claimId);
      await db.insert(evidenceClaims).values({
        id: claimId, sourceId: source.id, companyId: company.id, leadId: lead.id,
        claimType: "reverification", claimSummary: `重新核验官网页面：${page.title || canonicalUrl}`,
        evidenceKind: "observed", confidence: "medium",
      });
    }
  }
  for (const contact of evidence.contacts) {
    await db.insert(contactVerifications).values({
      id: crypto.randomUUID(), companyId: company.id, leadId: lead.id, contactType: contact.type,
      contactValue: contact.value || null, sourceUrl: contact.sourceUrl, sourceTitle: contact.sourceTitle || null,
      sameCompanyDomain: contact.sameCompanyDomain, businessUse: contact.businessUse, status: contact.status,
      failureReason: contact.status === "valid" ? null : "重新核验未通过", verifiedAt: now,
    });
  }

  const scoreRunId = crypto.randomUUID();
  await db.insert(leadScoreRuns).values({
    id: scoreRunId, leadId: lead.id, rubricVersion: RUBRIC_VERSION, totalScore: score.total,
    grade: score.grade, evidenceCoverage: score.evidenceCoverage, overallConfidence: score.confidence,
    modelIdentifier: "deterministic_public_rules_v2_reverification",
  });
  const maximums: Record<string, number> = { productMatchScore: 25, customerTypeScore: 20, purchasingSignalsScore: 15, marketMoqFitScore: 15, contactabilityScore: 10, accountPotentialScore: 10, dataQualityScore: 5 };
  for (const [dimension, value] of Object.entries(score.breakdown)) {
    const [positiveReason, negativeReason] = scoreInput.reasons[dimension] || ["", "证据不足"];
    await db.insert(leadScoreDimensions).values({
      id: crypto.randomUUID(), scoreRunId, dimension, score: value, maxScore: maximums[dimension],
      positiveReason: positiveReason || null, negativeReason: negativeReason || null,
      evidenceIdsJson: JSON.stringify(evidenceIds),
    });
  }
  return { leadId: lead.id, companyId: company.id, qualified: qualification.qualified, score: score.total, evidenceCoverage: score.evidenceCoverage, failures: qualification.failures };
}
