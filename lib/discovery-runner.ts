import { and, desc, eq, lte, ne } from "drizzle-orm";
import { getDb } from "@/db";
import {
  campaigns,
  campaignLeads,
  companyDomainLinks,
  companyDomains,
  discoveryRunItems,
  discoveryRuns,
  discoverySources,
  evidenceClaims,
  leadScoreDimensions,
  leadScoreRuns,
  leadSources,
  prospectCompanies,
} from "@/db/schema";
import { calculateScore, canonicalSourceUrl, identityKey, RUBRIC_VERSION } from "@/lib/lead-engine";
import {
  collectSiteEvidence,
  deterministicScore,
  extractDirectoryCandidates,
  fetchPublicHtml,
  normalizedDomain,
  type DiscoveryCandidate,
  type SiteEvidence,
} from "@/lib/discovery";

type Trigger = "manual" | "scheduled";
type RunCounts = {
  discovered: number;
  imported: number;
  duplicate: number;
  excluded: number;
  failed: number;
  pages: number;
  errors: string[];
};

function nextRun(cadence: string, from = new Date()) {
  if (cadence === "manual") return null;
  const next = new Date(from);
  next.setUTCDate(next.getUTCDate() + (cadence === "weekly" ? 7 : 1));
  return next.toISOString();
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function pageSignals(pageText: string, evidence: SiteEvidence) {
  const normalized = pageText.toLocaleLowerCase();
  const eyewear = evidence.eyewearTerms.filter((term) => normalized.includes(term.toLocaleLowerCase())).slice(0, 6);
  const b2b = evidence.b2bTerms.filter((term) => normalized.includes(term.toLocaleLowerCase())).slice(0, 5);
  return { eyewear, b2b };
}

async function importCandidate(campaign: typeof campaigns.$inferSelect, candidate: DiscoveryCandidate, evidence: SiteEvidence) {
  const db = getDb();
  const domain = normalizedDomain(evidence.pages[0]?.url || candidate.websiteUrl);
  const byDomain = await db.select().from(prospectCompanies).where(eq(prospectCompanies.primaryDomain, domain)).limit(1);
  const companyIdentity = identityKey(evidence.companyName, evidence.country, domain);
  const byIdentity = byDomain.length ? [] : await db.select().from(prospectCompanies).where(eq(prospectCompanies.identityKey, companyIdentity)).limit(1);
  const existingCompany = byDomain[0] || byIdentity[0];
  const companyId = existingCompany?.id || crypto.randomUUID();
  if (existingCompany) {
    const [existingLead] = await db.select({ id: campaignLeads.id }).from(campaignLeads).where(and(
      eq(campaignLeads.campaignId, campaign.id),
      eq(campaignLeads.companyId, companyId),
    )).limit(1);
    if (existingLead) return { outcome: "duplicate" as const, companyId, leadId: existingLead.id, evidenceCount: 0 };
  }

  const scoreInput = deterministicScore(evidence);
  const score = calculateScore(scoreInput);
  const now = new Date().toISOString();
  const leadId = crypto.randomUUID();
  const scoreRunId = crypto.randomUUID();
  const pageSourceIds = evidence.pages.map(() => crypto.randomUUID());
  const claimIds: string[] = [];

  if (!existingCompany) {
    await db.insert(prospectCompanies).values({
      id: companyId,
      companyName: evidence.companyName,
      identityKey: companyIdentity,
      country: evidence.country || null,
      companyType: evidence.companyType,
      businessModel: evidence.b2bTerms.length ? "B2B signal observed — needs review" : "Unknown",
      website: evidence.pages[0]?.url || candidate.websiteUrl,
      primaryDomain: domain,
      productsJson: JSON.stringify(evidence.eyewearTerms.slice(0, 12)),
      brandsJson: "[]",
      wholesaleSignal: evidence.b2bTerms.length ? `Observed terms: ${evidence.b2bTerms.slice(0, 8).join(", ")}` : null,
      analysisSummary: `Deterministic public-website collection: ${evidence.pages.length} pages; human qualification required.`,
      analysisConfidence: evidence.pages.length >= 2 ? "medium" : "low",
      businessEmail: evidence.businessEmail || null,
      contactChannel: evidence.contactChannel || null,
      lastAnalyzedAt: now,
    });
  } else {
    await db.update(prospectCompanies).set({
      country: existingCompany.country || evidence.country || null,
      companyType: existingCompany.companyType || evidence.companyType,
      website: existingCompany.website || evidence.pages[0]?.url || candidate.websiteUrl,
      primaryDomain: existingCompany.primaryDomain || domain,
      wholesaleSignal: existingCompany.wholesaleSignal || (evidence.b2bTerms.length ? `Observed terms: ${evidence.b2bTerms.slice(0, 8).join(", ")}` : null),
      businessEmail: existingCompany.businessEmail || evidence.businessEmail || null,
      contactChannel: existingCompany.contactChannel || evidence.contactChannel || null,
      lastAnalyzedAt: now,
      updatedAt: now,
    }).where(eq(prospectCompanies.id, companyId));
  }

  const domainId = crypto.randomUUID();
  await db.insert(companyDomains).values({
    id: domainId,
    normalizedDomain: domain,
    registrableDomain: domain,
    observedUrl: evidence.pages[0]?.url || candidate.websiteUrl,
  }).onConflictDoNothing();
  const [savedDomain] = await db.select().from(companyDomains).where(eq(companyDomains.normalizedDomain, domain)).limit(1);
  if (savedDomain) {
    await db.insert(companyDomainLinks).values({
      id: crypto.randomUUID(), companyId, domainId: savedDomain.id, relationshipType: "primary", isPrimary: true,
    }).onConflictDoNothing();
  }

  await db.insert(campaignLeads).values({
    id: leadId,
    campaignId: campaign.id,
    companyId,
    qualificationResult: score.total >= 60 ? "qualified" : "near_match",
    workflowStatus: "needs_review",
    productTrack: campaign.productTrack,
    recommendedProductsJson: campaign.productTypesJson,
    riskSummary: "首次联系未获批准；采购权、MOQ 与当前供应商关系仍需人工确认。",
    hardGateStatus: "needs_review",
    hardGateReason: "自动采集只能提供公开官网证据，强制准入必须由人工确认。",
    currentScore: score.total,
    grade: score.grade,
    evidenceCoverage: score.evidenceCoverage,
    scoreConfidence: score.confidence,
  });

  for (let index = 0; index < evidence.pages.length; index += 1) {
    const page = evidence.pages[index];
    const signals = pageSignals(page.text, evidence);
    const summaryParts = [
      signals.eyewear.length ? `眼镜词：${signals.eyewear.join("、")}` : "",
      signals.b2b.length ? `B2B 词：${signals.b2b.join("、")}` : "",
    ].filter(Boolean);
    const sourceId = pageSourceIds[index];
    await db.insert(leadSources).values({
      id: sourceId,
      companyId,
      leadId,
      sourceUrl: page.url,
      canonicalUrl: canonicalSourceUrl(page.url),
      sourceType: "company_website",
      pageTitle: page.title || null,
      retrievedAt: now,
      evidenceSummary: summaryParts.join("；") || "已采集官网公开页面，未观察到额外结构化信号。",
      contentHash: await sha256(page.html),
      confidence: signals.eyewear.length || signals.b2b.length ? "medium" : "low",
    });
    if (signals.eyewear.length) {
      const claimId = crypto.randomUUID(); claimIds.push(claimId);
      await db.insert(evidenceClaims).values({
        id: claimId, sourceId, companyId, leadId, claimType: "product_signal",
        claimSummary: `官网页面观察到眼镜相关内容：${signals.eyewear.join("、")}`,
        evidenceKind: "observed", confidence: "medium",
      });
    }
    if (signals.b2b.length) {
      const claimId = crypto.randomUUID(); claimIds.push(claimId);
      await db.insert(evidenceClaims).values({
        id: claimId, sourceId, companyId, leadId, claimType: "b2b_signal",
        claimSummary: `官网页面观察到 B2B 相关内容：${signals.b2b.join("、")}`,
        evidenceKind: "observed", confidence: "medium",
      });
    }
  }

  if (evidence.country) {
    const claimId = crypto.randomUUID(); claimIds.push(claimId);
    await db.insert(evidenceClaims).values({
      id: claimId, sourceId: pageSourceIds[0], companyId, leadId, claimType: "country",
      claimSummary: `官网结构化地址字段显示国家：${evidence.country}`,
      evidenceKind: "observed", confidence: "medium",
    });
  }
  if (evidence.businessEmail || evidence.contactChannel) {
    const claimId = crypto.randomUUID(); claimIds.push(claimId);
    await db.insert(evidenceClaims).values({
      id: claimId, sourceId: pageSourceIds[0], companyId, leadId, claimType: "business_contact_channel",
      claimSummary: evidence.businessEmail ? "官网公开了通用业务邮箱（未采集个人邮箱）。" : "官网公开了联系页面（未采集个人联系人）。",
      evidenceKind: "observed", confidence: "medium",
    });
  }

  await db.insert(leadScoreRuns).values({
    id: scoreRunId,
    leadId,
    rubricVersion: RUBRIC_VERSION,
    totalScore: score.total,
    grade: score.grade,
    evidenceCoverage: score.evidenceCoverage,
    overallConfidence: score.confidence,
    modelIdentifier: "deterministic_public_rules_v1",
  });
  for (const [dimension, value] of Object.entries(score.breakdown)) {
    const [positiveReason, negativeReason] = scoreInput.reasons[dimension] || ["", "尚未人工确认"];
    await db.insert(leadScoreDimensions).values({
      id: crypto.randomUUID(), scoreRunId, dimension, score: value,
      maxScore: ({ productMatchScore: 25, customerTypeScore: 20, purchasingSignalsScore: 15, marketMoqFitScore: 15, contactabilityScore: 10, accountPotentialScore: 10, dataQualityScore: 5 } as Record<string, number>)[dimension],
      positiveReason: positiveReason || null,
      negativeReason: negativeReason || null,
      evidenceIdsJson: JSON.stringify(claimIds),
    });
  }
  return { outcome: "imported" as const, companyId, leadId, evidenceCount: claimIds.length };
}

async function recordItem(runId: string, candidate: DiscoveryCandidate, outcome: "imported" | "duplicate" | "excluded" | "failed", reason: string, companyId?: string, companyName?: string, evidenceCount = 0) {
  const db = getDb();
  await db.insert(discoveryRunItems).values({
    id: crypto.randomUUID(), runId, companyId: companyId || null, websiteUrl: candidate.websiteUrl,
    normalizedDomain: candidate.normalizedDomain, companyName: companyName || candidate.label || null,
    outcome, reason: reason.slice(0, 1000) || null, evidenceCount,
  }).onConflictDoNothing();
}

export async function runDiscoverySource(sourceId: string, trigger: Trigger = "manual") {
  const db = getDb();
  const [source] = await db.select().from(discoverySources).where(eq(discoverySources.id, sourceId)).limit(1);
  if (!source) throw new Error("discovery_source_not_found");
  if (source.status !== "active") throw new Error("discovery_source_paused");
  const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, source.campaignId)).limit(1);
  if (!campaign || campaign.status !== "active") throw new Error("campaign_not_active");
  const [running] = await db.select({ id: discoveryRuns.id }).from(discoveryRuns).where(and(
    eq(discoveryRuns.sourceId, sourceId), eq(discoveryRuns.status, "running"),
  )).orderBy(desc(discoveryRuns.createdAt)).limit(1);
  if (running) throw new Error("discovery_source_already_running");

  const runId = crypto.randomUUID();
  const startedAt = new Date();
  const counts: RunCounts = { discovered: 0, imported: 0, duplicate: 0, excluded: 0, failed: 0, pages: 0, errors: [] };
  await db.insert(discoveryRuns).values({ id: runId, sourceId, campaignId: source.campaignId, trigger, status: "running", startedAt: startedAt.toISOString() });
  try {
    const directory = await fetchPublicHtml(source.sourceUrl);
    counts.pages += 1;
    const candidates = extractDirectoryCandidates(directory.html, directory.url, source.maxCandidates);
    counts.discovered = candidates.length;
    for (const candidate of candidates) {
      try {
        const evidence = await collectSiteEvidence(candidate);
        counts.pages += evidence.pages.length;
        if (!evidence.eyewearTerms.length) {
          counts.excluded += 1;
          await recordItem(runId, candidate, "excluded", "官网未观察到眼镜相关证据", undefined, evidence.companyName);
          continue;
        }
        const result = await importCandidate(campaign, candidate, evidence);
        if (result.outcome === "duplicate") counts.duplicate += 1;
        else counts.imported += 1;
        await recordItem(runId, candidate, result.outcome, result.outcome === "duplicate" ? "当前 Campaign 已存在该官网" : "已加入待审核；首次联系仍需人工批准", result.companyId, evidence.companyName, result.evidenceCount);
      } catch (error) {
        counts.failed += 1;
        const message = error instanceof Error ? error.message : "官网采集失败";
        counts.errors.push(`${candidate.normalizedDomain}: ${message}`);
        await recordItem(runId, candidate, "failed", message);
      }
    }
    const completedAt = new Date().toISOString();
    const status = counts.failed && (counts.imported || counts.duplicate || counts.excluded) ? "partial" : counts.failed ? "failed" : "completed";
    await db.update(discoveryRuns).set({
      status,
      discoveredCount: counts.discovered,
      importedCount: counts.imported,
      duplicateCount: counts.duplicate,
      excludedCount: counts.excluded,
      failedCount: counts.failed,
      pagesFetched: counts.pages,
      errorSummary: counts.errors.slice(0, 12).join("\n").slice(0, 3000) || null,
      completedAt,
    }).where(eq(discoveryRuns.id, runId));
    await db.update(discoverySources).set({ lastRunAt: completedAt, nextRunAt: nextRun(source.cadence, new Date(completedAt)), updatedAt: completedAt }).where(eq(discoverySources.id, sourceId));
    return { runId, status, ...counts, errors: counts.errors.slice(0, 12) };
  } catch (error) {
    const completedAt = new Date().toISOString();
    const message = error instanceof Error ? error.message : "来源采集失败";
    await db.update(discoveryRuns).set({ status: "failed", failedCount: 1, pagesFetched: counts.pages, errorSummary: message.slice(0, 3000), completedAt }).where(eq(discoveryRuns.id, runId));
    await db.update(discoverySources).set({ lastRunAt: completedAt, nextRunAt: nextRun(source.cadence, new Date(completedAt)), updatedAt: completedAt }).where(eq(discoverySources.id, sourceId));
    return { runId, status: "failed", ...counts, failed: Math.max(1, counts.failed), errors: [message] };
  }
}

export async function runDueDiscoverySources(limit = 3) {
  const db = getDb();
  const now = new Date().toISOString();
  const due = await db.select().from(discoverySources).where(and(
    eq(discoverySources.status, "active"),
    ne(discoverySources.cadence, "manual"),
    lte(discoverySources.nextRunAt, now),
  )).orderBy(discoverySources.nextRunAt).limit(Math.max(1, Math.min(3, limit)));
  const results = [];
  for (const source of due) results.push(await runDiscoverySource(source.id, "scheduled"));
  return { checkedAt: now, dueCount: due.length, results };
}

export function scheduleFromCadence(cadence: string, from = new Date()) {
  return nextRun(cadence, from);
}
