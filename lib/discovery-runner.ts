import { env } from "cloudflare:workers";
import { and, desc, eq, lte } from "drizzle-orm";
import { getDb } from "@/db";
import {
  campaigns,
  campaignLeads,
  companyDomainLinks,
  companyDomains,
  contactVerifications,
  discoveryRunAttempts,
  discoveryRunItems,
  discoveryRuns,
  discoverySources,
  evidenceClaims,
  leadScoreDimensions,
  leadScoreRuns,
  leadSources,
  prospectCompanies,
  sourceHealth,
} from "@/db/schema";
import {
  calculateScore,
  canonicalSourceUrl,
  companyNamesLikelySame,
  identityKey,
  RUBRIC_VERSION,
  safeJsonList,
} from "@/lib/lead-engine";
import {
  collectSiteEvidence,
  deterministicScore,
  extractDirectoryCandidates,
  extractTextExhibitorHints,
  fetchPublicHtml,
  fetchPublicJson,
  fetchPublicPdfText,
  normalizedDomain,
  parseDirectoryCandidates,
  parseDynamicDirectoryPayload,
  type DiscoveryCandidate,
  type SiteEvidence,
} from "@/lib/discovery";
import { createDiscoveryProvider } from "@/lib/discovery-provider";
import { qualifyEvidence } from "@/lib/qualification";
import { campaignProductTracks, routeCampaigns, UNASSIGNED_CAMPAIGN_ID } from "@/lib/campaign-routing";
import { ensureUnassignedCampaign } from "@/lib/system-campaign";

type Trigger = "manual" | "scheduled";
export type RunCounts = {
  rawDiscovered: number;
  parsed: number;
  websiteVerified: number;
  validContact: number;
  qualified: number;
  mandatoryFailed: number;
  imported: number;
  duplicate: number;
  excluded: number;
  failed: number;
  pages: number;
  errors: string[];
};

type RunOptions = { targetDate?: string; maxCandidates?: number };
type ParserState = { offset: number; lastFullScanAt?: string; [key: string]: unknown };

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
  return {
    eyewear: evidence.eyewearTerms.filter((term) => normalized.includes(term.toLocaleLowerCase())).slice(0, 6),
    b2b: evidence.b2bTerms.filter((term) => normalized.includes(term.toLocaleLowerCase())).slice(0, 5),
  };
}

async function findDuplicate(candidate: DiscoveryCandidate) {
  const db = getDb();
  if (candidate.websiteUrl) {
    const [byDomain] = await db.select().from(prospectCompanies)
      .where(eq(prospectCompanies.primaryDomain, normalizedDomain(candidate.websiteUrl))).limit(1);
    if (byDomain) return byDomain;
  }
  const companies = await db.select({
    id: prospectCompanies.id,
    companyName: prospectCompanies.companyName,
    brandsJson: prospectCompanies.brandsJson,
    primaryDomain: prospectCompanies.primaryDomain,
    doNotContact: prospectCompanies.doNotContact,
  }).from(prospectCompanies).limit(1500);
  return companies.find((company) => companyNamesLikelySame(company.companyName, candidate.label)
    || safeJsonList(company.brandsJson).some((brand) => companyNamesLikelySame(brand, candidate.label)));
}

async function persistVerifiedCandidate(
  discoveryGoalCampaign: typeof campaigns.$inferSelect,
  source: typeof discoverySources.$inferSelect,
  candidate: DiscoveryCandidate,
  evidence: SiteEvidence,
) {
  const db = getDb();
  const domain = normalizedDomain(evidence.pages[0]?.url || candidate.websiteUrl);
  const companyIdentity = identityKey(evidence.companyName, evidence.country, domain);
  const duplicate = await db.select({ id: prospectCompanies.id }).from(prospectCompanies)
    .where(eq(prospectCompanies.identityKey, companyIdentity)).limit(1);
  if (duplicate[0]) return { duplicate: true as const, companyId: duplicate[0].id, leadId: "", qualified: false, evidenceCount: 0, failures: ["公司主体重复"] };

  const scoreInput = deterministicScore(evidence);
  const score = calculateScore(scoreInput);
  const qualification = qualifyEvidence({
    evidence,
    score: score.total,
    evidenceCoverage: score.evidenceCoverage,
    officialWebsiteVerified: evidence.pages.length > 0 && normalizedDomain(evidence.pages[0].url) === domain,
    sourceIsOfficial: /association|official_exhibitor|official_directory/.test(source.sourceType),
  });
  const baseLeadQualification = { hardGateStatus: qualification.hardGateStatus };
  const now = new Date().toISOString();
  const companyId = crypto.randomUUID();
  await ensureUnassignedCampaign();
  const activeCampaignRows = (await db.select().from(campaigns).where(eq(campaigns.status, "active")))
    .filter((campaign) => campaign.id !== UNASSIGNED_CAMPAIGN_ID);
  const matchedCampaigns = routeCampaigns(activeCampaignRows, evidence, qualification.customerTypes, qualification.productDirections);
  const unassignedCampaign = await ensureUnassignedCampaign();
  const targetCampaigns = matchedCampaigns.length ? matchedCampaigns : [unassignedCampaign];
  const isUnassigned = !matchedCampaigns.length;
  const leadIds = targetCampaigns.map(() => crypto.randomUUID());
  const leadId = leadIds[0];
  const pageSourceIds = evidence.pages.map(() => crypto.randomUUID());
  const claimIds: string[] = [];

  await db.insert(prospectCompanies).values({
    id: companyId,
    companyName: evidence.companyName,
    identityKey: companyIdentity,
    country: evidence.country || null,
    region: source.region,
    companyType: evidence.companyType,
    customerType: qualification.customerType || null,
    customerTypesJson: JSON.stringify(qualification.customerTypes),
    companyRole: qualification.companyRole,
    businessModel: evidence.b2bTerms.length ? "B2B public evidence observed" : "Unknown",
    website: evidence.pages[0]?.url || candidate.websiteUrl,
    primaryDomain: domain,
    productsJson: JSON.stringify(evidence.eyewearTerms.slice(0, 12)),
    productDirectionsJson: JSON.stringify(qualification.productDirections),
    brandsJson: "[]",
    wholesaleSignal: evidence.b2bTerms.length ? `Observed terms: ${evidence.b2bTerms.slice(0, 8).join(", ")}` : null,
    analysisSummary: [...qualification.reasons, ...qualification.failures].join("；").slice(0, 3000),
    analysisConfidence: evidence.pages.length >= 2 ? "medium" : "low",
    businessEmail: evidence.businessEmail || null,
    contactChannel: evidence.contactChannel || null,
    contactStatus: qualification.validContact ? "valid" : "missing",
    sourceType: source.sourceType,
    sourceName: source.name,
    primaryCampaignId: targetCampaigns[0].id,
    firstDiscoveredAt: now,
    lastVerifiedAt: now,
    lastAnalyzedAt: now,
  });

  await db.insert(companyDomains).values({
    id: crypto.randomUUID(), normalizedDomain: domain, registrableDomain: domain,
    observedUrl: evidence.pages[0]?.url || candidate.websiteUrl,
  }).onConflictDoNothing();
  const [savedDomain] = await db.select().from(companyDomains).where(eq(companyDomains.normalizedDomain, domain)).limit(1);
  if (savedDomain) {
    await db.insert(companyDomainLinks).values({
      id: crypto.randomUUID(), companyId, domainId: savedDomain.id, relationshipType: "primary", isPrimary: true,
    }).onConflictDoNothing();
  }

  for (let index = 0; index < targetCampaigns.length; index += 1) {
    const campaign = targetCampaigns[index];
    const needsAssignment = campaign.id === UNASSIGNED_CAMPAIGN_ID;
    await db.insert(campaignLeads).values({
      id: leadIds[index],
      campaignId: campaign.id,
      companyId,
      qualificationResult: needsAssignment && qualification.qualified ? "near_match" : qualification.qualified ? "qualified" : "rejected",
      workflowStatus: qualification.qualified ? "needs_review" : "rejected",
      productTrack: needsAssignment ? discoveryGoalCampaign.productTrack : campaignProductTracks(campaign)[0] || campaign.productTrack,
      recommendedProductsJson: JSON.stringify(qualification.productDirections),
      riskSummary: needsAssignment
        ? "客户通过全局准入，但缺少可验证的国家、客户类型或产品 Campaign 匹配证据；需要人工分配。"
        : qualification.failures.join("；") || "自动筛选合格；人工批准前不得导出到 CRM 或联系。",
      hardGateStatus: needsAssignment && qualification.qualified ? "needs_review" : baseLeadQualification.hardGateStatus,
      hardGateReason: needsAssignment
        ? "未可靠匹配任何运行中的 Campaign"
        : qualification.qualified ? qualification.reasons.join("；") : qualification.failures.join("；"),
      currentScore: score.total,
      grade: score.grade,
      evidenceCoverage: score.evidenceCoverage,
      scoreConfidence: score.confidence,
      autoQualifiedAt: qualification.qualified ? now : null,
      lastVerifiedAt: now,
      assignmentType: needsAssignment ? "system" : "automatic",
      matchStatus: needsAssignment ? "unassigned" : "current",
      matchReason: needsAssignment
        ? "没有匹配的运行中区域策略"
        : `证据标签匹配：${evidence.country || "国家待核验"}；${campaignProductTracks(campaign).join(", ")}；${qualification.customerTypes.join(", ") || "客户类型待核验"}`,
      matchedAt: now,
    });
  }

  if (candidate.directoryUrl) {
    const directorySourceId = crypto.randomUUID();
    await db.insert(leadSources).values({
      id: directorySourceId,
      companyId,
      leadId,
      sourceUrl: candidate.directoryUrl,
      canonicalUrl: canonicalSourceUrl(candidate.directoryUrl),
      sourceType: source.sourceType,
      pageTitle: candidate.directoryTitle || source.name,
      retrievedAt: now,
      evidenceSummary: `官方目录列出企业${candidate.directoryCategory ? `；分类：${candidate.directoryCategory}` : ""}`,
      confidence: "high",
    });
    const claimId = crypto.randomUUID();
    claimIds.push(claimId);
    await db.insert(evidenceClaims).values({
      id: claimId, sourceId: directorySourceId, companyId, leadId, claimType: "official_directory_membership",
      claimSummary: `企业出现在官方来源：${source.name}`, evidenceKind: "observed", confidence: "high",
    });
  }

  for (let index = 0; index < evidence.pages.length; index += 1) {
    const page = evidence.pages[index];
    const signals = pageSignals(page.text, evidence);
    const sourceId = pageSourceIds[index];
    await db.insert(leadSources).values({
      id: sourceId, companyId, leadId, sourceUrl: page.url, canonicalUrl: canonicalSourceUrl(page.url),
      sourceType: "company_website", pageTitle: page.title || null, retrievedAt: now,
      evidenceSummary: [
        signals.eyewear.length ? `眼镜词：${signals.eyewear.join("、")}` : "",
        signals.b2b.length ? `B2B 词：${signals.b2b.join("、")}` : "",
      ].filter(Boolean).join("；") || "企业官网公开页面",
      contentHash: await sha256(page.html), confidence: signals.eyewear.length || signals.b2b.length ? "medium" : "low",
    });
    if (signals.eyewear.length) {
      const claimId = crypto.randomUUID(); claimIds.push(claimId);
      await db.insert(evidenceClaims).values({
        id: claimId, sourceId, companyId, leadId, claimType: "product_signal",
        claimSummary: `官网观察到眼镜相关内容：${signals.eyewear.join("、")}`, evidenceKind: "observed", confidence: "medium",
      });
    }
    if (signals.b2b.length) {
      const claimId = crypto.randomUUID(); claimIds.push(claimId);
      await db.insert(evidenceClaims).values({
        id: claimId, sourceId, companyId, leadId, claimType: "b2b_signal",
        claimSummary: `官网观察到 B2B 内容：${signals.b2b.join("、")}`, evidenceKind: "observed", confidence: "medium",
      });
    }
  }

  for (const contact of evidence.contacts) {
    await db.insert(contactVerifications).values({
      id: crypto.randomUUID(), companyId, leadId, contactType: contact.type, contactValue: contact.value || null,
      sourceUrl: contact.sourceUrl, sourceTitle: contact.sourceTitle || null,
      sameCompanyDomain: contact.sameCompanyDomain, businessUse: contact.businessUse,
      status: contact.status, failureReason: contact.status === "valid" ? null : "未通过公开商务联系方式规则", verifiedAt: now,
    });
  }
  if (qualification.validContact && pageSourceIds[0]) {
    const claimId = crypto.randomUUID(); claimIds.push(claimId);
    await db.insert(evidenceClaims).values({
      id: claimId, sourceId: pageSourceIds[0], companyId, leadId, claimType: "business_contact_channel",
      claimSummary: `已核验公开商务联系方式：${qualification.validContact.type}`, evidenceKind: "observed", confidence: "medium",
    });
  }

  for (const routedLeadId of leadIds) {
    const scoreRunId = crypto.randomUUID();
    await db.insert(leadScoreRuns).values({
      id: scoreRunId, leadId: routedLeadId, rubricVersion: RUBRIC_VERSION, totalScore: score.total, grade: score.grade,
      evidenceCoverage: score.evidenceCoverage, overallConfidence: score.confidence,
      modelIdentifier: "deterministic_public_rules_v2",
    });
    for (const [dimension, value] of Object.entries(score.breakdown)) {
      const [positiveReason, negativeReason] = scoreInput.reasons[dimension] || ["", "证据不足"];
      await db.insert(leadScoreDimensions).values({
        id: crypto.randomUUID(), scoreRunId, dimension, score: value,
        maxScore: ({ productMatchScore: 25, customerTypeScore: 20, purchasingSignalsScore: 15, marketMoqFitScore: 15, contactabilityScore: 10, accountPotentialScore: 10, dataQualityScore: 5 } as Record<string, number>)[dimension],
        positiveReason: positiveReason || null, negativeReason: negativeReason || null,
        evidenceIdsJson: JSON.stringify(claimIds),
      });
    }
  }
  return {
    duplicate: false as const, companyId, leadId, qualified: qualification.qualified,
    leadIds, campaignIds: targetCampaigns.map((campaign) => campaign.id), isUnassigned,
    evidenceCount: claimIds.length, failures: qualification.failures,
  };
}

async function recordItem(
  runId: string,
  candidate: DiscoveryCandidate,
  outcome: "imported" | "duplicate" | "excluded" | "failed",
  reason: string,
  companyId?: string,
  companyName?: string,
  evidenceCount = 0,
) {
  const db = getDb();
  await db.insert(discoveryRunItems).values({
    id: crypto.randomUUID(), runId, companyId: companyId || null,
    websiteUrl: candidate.websiteUrl || candidate.directoryUrl || "https://unresolved.invalid/",
    normalizedDomain: candidate.normalizedDomain, companyName: companyName || candidate.label || null,
    outcome, reason: reason.slice(0, 1000) || null, evidenceCount,
  }).onConflictDoNothing();
}

function runtimeProvider() {
  const runtimeEnv = env as typeof env & {
    ENABLE_PAID_PROVIDERS?: string;
    OPENAI_API_KEY?: string;
    OPENAI_DISCOVERY_MODEL?: string;
  };
  return createDiscoveryProvider({
    enablePaidProviders: runtimeEnv.ENABLE_PAID_PROVIDERS,
    openAiApiKey: runtimeEnv.OPENAI_API_KEY,
    openAiDiscoveryModel: runtimeEnv.OPENAI_DISCOVERY_MODEL,
  });
}

function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function parserState(value: string): ParserState {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    const offset = Number(parsed.offset || 0);
    return { ...parsed, offset: Number.isInteger(offset) && offset >= 0 ? offset : 0 };
  } catch {
    return { offset: 0 };
  }
}

export async function runDiscoverySource(sourceId: string, trigger: Trigger = "manual", options: RunOptions = {}) {
  const db = getDb();
  const [source] = await db.select().from(discoverySources).where(eq(discoverySources.id, sourceId)).limit(1);
  if (!source) throw new Error("discovery_source_not_found");
  if (!source.enabled || source.status !== "active") throw new Error("discovery_source_paused");
  if (source.requiresLogin || source.isPaid) throw new Error("discovery_source_requires_unapproved_access");
  const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, source.campaignId)).limit(1);
  if (!campaign || campaign.status !== "active") throw new Error("campaign_not_active");
  const [running] = await db.select({ id: discoveryRuns.id }).from(discoveryRuns).where(and(
    eq(discoveryRuns.sourceId, sourceId), eq(discoveryRuns.status, "running"),
  )).orderBy(desc(discoveryRuns.createdAt)).limit(1);
  if (running) throw new Error("discovery_source_already_running");

  const runId = crypto.randomUUID();
  const attemptId = crypto.randomUUID();
  const startedAt = new Date();
  const maxCandidates = Math.max(1, Math.min(5, options.maxCandidates ?? 5, source.maxCandidates));
  const counts: RunCounts = {
    rawDiscovered: 0, parsed: 0, websiteVerified: 0, validContact: 0, qualified: 0,
    mandatoryFailed: 0, imported: 0, duplicate: 0, excluded: 0, failed: 0, pages: 0, errors: [],
  };
  const currentParserState = parserState(source.parserConfigJson);
  let nextParserState: ParserState = currentParserState;
  let exhaustedDirectory = false;
  await db.insert(discoveryRuns).values({
    id: runId, sourceId, campaignId: source.campaignId, trigger, status: "running",
    targetDate: options.targetDate || null, startedAt: startedAt.toISOString(),
  });
  await db.insert(discoveryRunAttempts).values({
    id: attemptId, runId, sourceId, attemptType: "directory_fetch", requestUrl: source.sourceUrl, status: "started",
  });

  try {
    const sourceConfig = JSON.parse(source.parserConfigJson || "{}") as Record<string, unknown>;
    let candidates: DiscoveryCandidate[];
    if (source.parserKey === "dynamic_directory") {
      const endpoint = String(sourceConfig.endpoint || "").trim();
      if (!endpoint) throw new Error("dynamic_directory_requires_confirmed_public_endpoint");
      const directory = await fetchPublicJson(endpoint);
      candidates = parseDynamicDirectoryPayload(directory.payload, source.sourceUrl, sourceConfig, maxCandidates, currentParserState.offset);
    } else if (source.parserKey === "pdf_directory") {
      const directory = await fetchPublicPdfText(source.sourceUrl);
      candidates = extractTextExhibitorHints(directory.text, source.sourceUrl, maxCandidates, currentParserState.offset);
    } else {
      const directory = await fetchPublicHtml(source.sourceUrl);
      candidates = parseDirectoryCandidates(source.parserKey, directory.html, directory.url, maxCandidates, currentParserState.offset);
    }
    counts.pages += 1;
    counts.rawDiscovered = candidates.length;
    exhaustedDirectory = candidates.length === 0;
    nextParserState = exhaustedDirectory
      ? { ...currentParserState, offset: 0, lastFullScanAt: new Date().toISOString() }
      : { ...currentParserState, offset: currentParserState.offset + candidates.length };
    await db.update(discoveryRunAttempts).set({
      status: "succeeded", httpStatus: 200, robotsStatus: "respected",
      durationMs: Date.now() - startedAt.getTime(), completedAt: new Date().toISOString(),
    }).where(eq(discoveryRunAttempts.id, attemptId));
    const provider = runtimeProvider();

    for (let index = 0; index < candidates.length; index += 1) {
      let candidate = candidates[index];
      try {
        counts.parsed += 1;
        if (!candidate.websiteUrl && candidate.directoryDetailUrl) {
          const detail = await fetchPublicHtml(candidate.directoryDetailUrl);
          counts.pages += 1;
          const website = extractDirectoryCandidates(detail.html, detail.url, 1)[0];
          if (website) candidate = {
            ...candidate,
            websiteUrl: website.websiteUrl,
            normalizedDomain: website.normalizedDomain,
            directoryTitle: detail.title || candidate.directoryTitle,
          };
        }
        if (!candidate.websiteUrl) {
          const resolution = await provider.resolveOfficialWebsite({
            companyName: candidate.label, region: source.region, officialDirectoryUrl: source.sourceUrl,
          });
          if (!resolution) {
            counts.excluded += 1;
            counts.mandatoryFailed += 1;
            await recordItem(runId, candidate, "excluded", provider.enabled
              ? "官网发现 provider 未能高可信解析企业官网"
              : "纯文本候选尚无企业官网；付费/搜索 provider 默认关闭，不能计入合格数");
            continue;
          }
          candidate = {
            ...candidate,
            label: resolution.companyName || candidate.label,
            websiteUrl: resolution.websiteUrl,
            normalizedDomain: normalizedDomain(resolution.websiteUrl),
          };
        }
        const existing = await findDuplicate(candidate);
        if (existing) {
          counts.duplicate += 1;
          await recordItem(runId, candidate, "duplicate", "规范化域名、公司主体或品牌关系已存在", existing.id);
          continue;
        }
        const evidence = await collectSiteEvidence(candidate);
        counts.pages += evidence.pages.length;
        counts.websiteVerified += 1;
        if (evidence.contacts.some((contact) => contact.status === "valid" && contact.businessUse)) counts.validContact += 1;
        const result = await persistVerifiedCandidate(campaign, source, candidate, evidence);
        if (result.duplicate) {
          counts.duplicate += 1;
          await recordItem(runId, candidate, "duplicate", "公司主体已存在", result.companyId, evidence.companyName);
        } else if (result.qualified) {
          counts.imported += 1;
          counts.qualified += 1;
          await recordItem(runId, candidate, "imported", result.isUnassigned
            ? "自动筛选合格，但证据不足以匹配 Campaign，已进入待分配；未发送任何消息"
            : `自动筛选合格并路由至 ${result.campaignIds.length} 个 Campaign；进入待人工审核，未发送任何消息`, result.companyId, evidence.companyName, result.evidenceCount);
        } else {
          counts.imported += 1;
          counts.excluded += 1;
          counts.mandatoryFailed += 1;
          await recordItem(runId, candidate, "excluded", result.failures.join("；"), result.companyId, evidence.companyName, result.evidenceCount);
        }
      } catch (error) {
        counts.failed += 1;
        const message = error instanceof Error ? error.message : "官网采集失败";
        counts.errors.push(`${candidate.normalizedDomain}: ${message}`);
        await recordItem(runId, candidate, "failed", message);
      }
      if (index < candidates.length - 1) await sleep(source.rateLimitMs);
    }

    const completedAt = new Date().toISOString();
    const status = counts.failed && (counts.imported || counts.duplicate || counts.excluded) ? "partial" : counts.failed ? "failed" : "completed";
    await db.update(discoveryRuns).set({
      status, targetDate: options.targetDate || null,
      rawDiscoveredCount: counts.rawDiscovered, parsedCount: counts.parsed,
      websiteVerifiedCount: counts.websiteVerified, validContactCount: counts.validContact,
      mandatoryGateFailedCount: counts.mandatoryFailed, qualifiedCount: counts.qualified,
      discoveredCount: counts.rawDiscovered, importedCount: counts.imported,
      duplicateCount: counts.duplicate, excludedCount: counts.excluded, failedCount: counts.failed,
      pagesFetched: counts.pages, errorSummary: counts.errors.slice(0, 12).join("\n").slice(0, 3000) || null,
      completedAt,
    }).where(eq(discoveryRuns.id, runId));
    await db.update(discoverySources).set({
      lastRunAt: completedAt, lastSuccessAt: status === "failed" ? source.lastSuccessAt : completedAt,
      lastDiscoveredCount: counts.rawDiscovered, lastQualifiedCount: counts.qualified,
      lastDuplicateCount: counts.duplicate, failureCount: status === "failed" ? source.failureCount + 1 : source.failureCount,
      lastError: counts.errors.slice(0, 3).join("；") || null,
      parserConfigJson: JSON.stringify(nextParserState),
      nextRunAt: exhaustedDirectory ? new Date(new Date(completedAt).getTime() + 7 * 86_400_000).toISOString() : nextRun(source.cadence, new Date(completedAt)),
      updatedAt: completedAt,
    }).where(eq(discoverySources.id, sourceId));
    await db.insert(sourceHealth).values({
      id: crypto.randomUUID(), sourceId, checkedAt: completedAt,
      status: status === "failed" ? "failed" : counts.failed ? "degraded" : counts.rawDiscovered ? "healthy" : "exhausted",
      discoveredCount: counts.rawDiscovered, qualifiedCount: counts.qualified, duplicateCount: counts.duplicate,
      failureCount: counts.failed, latencyMs: Date.now() - startedAt.getTime(),
      note: counts.errors.slice(0, 3).join("；") || null,
    });
    return { runId, sourceId, sourceName: source.name, status, ...counts, errors: counts.errors.slice(0, 12) };
  } catch (error) {
    const completedAt = new Date().toISOString();
    const message = error instanceof Error ? error.message : "来源采集失败";
    await db.update(discoveryRunAttempts).set({
      status: message.includes("robots") ? "blocked" : "failed", errorMessage: message.slice(0, 1000),
      robotsStatus: message.includes("robots") ? "blocked" : "unknown",
      durationMs: Date.now() - startedAt.getTime(), completedAt,
    }).where(eq(discoveryRunAttempts.id, attemptId));
    await db.update(discoveryRuns).set({
      status: "failed", failedCount: 1, pagesFetched: counts.pages,
      errorSummary: message.slice(0, 3000), completedAt,
    }).where(eq(discoveryRuns.id, runId));
    await db.update(discoverySources).set({
      lastRunAt: completedAt, failureCount: source.failureCount + 1, lastError: message.slice(0, 1000),
      nextRunAt: nextRun(source.cadence, new Date(completedAt)), updatedAt: completedAt,
    }).where(eq(discoverySources.id, sourceId));
    await db.insert(sourceHealth).values({
      id: crypto.randomUUID(), sourceId, checkedAt: completedAt, status: message.includes("robots") ? "blocked" : "failed",
      failureCount: 1, latencyMs: Date.now() - startedAt.getTime(), note: message.slice(0, 1000),
    });
    return {
      runId, sourceId, sourceName: source.name, status: "failed" as const, ...counts,
      failed: Math.max(1, counts.failed), errors: [message],
    };
  }
}

export async function recoverStaleDiscoveryRuns(maxAgeMinutes = 30) {
  const db = getDb();
  const cutoff = new Date(Date.now() - maxAgeMinutes * 60_000).toISOString();
  const stale = await db.select({ id: discoveryRuns.id }).from(discoveryRuns).where(and(
    eq(discoveryRuns.status, "running"), lte(discoveryRuns.startedAt, cutoff),
  ));
  const completedAt = new Date().toISOString();
  for (const run of stale) {
    await db.update(discoveryRuns).set({
      status: "failed", failedCount: 1,
      errorSummary: `运行超过 ${maxAgeMinutes} 分钟未结束，已自动恢复为失败状态`, completedAt,
    }).where(eq(discoveryRuns.id, run.id));
  }
  return stale.length;
}

export function scheduleFromCadence(cadence: string, from = new Date()) {
  return nextRun(cadence, from);
}
