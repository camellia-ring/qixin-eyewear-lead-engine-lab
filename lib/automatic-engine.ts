import { and, asc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  campaigns,
  dailyDiscoveryTargets,
  discoveryAlerts,
  discoveryRuns,
  discoverySources,
  engineState,
} from "@/db/schema";
import { recoverStaleDiscoveryRuns, runDiscoverySource, type RunCounts } from "@/lib/discovery-runner";
import {
  dateInTimezone,
  DEFAULT_TIMEZONE,
  ENGINE_BATCH_MINUTES,
  sourceRepeatsDuringDay,
} from "@/lib/engine-policy";
import { DISCOVERY_RUNTIME_CONFIG } from "@/lib/discovery-runtime";
import { ensureOfficialSourceRegistry, seedOfficialSourceRegistry } from "@/lib/source-registry";
import { GLOBAL_DISCOVERY_CAMPAIGN_ID, isSystemCampaignId } from "@/lib/campaign-routing";
import { ensureUnassignedCampaign } from "@/lib/system-campaign";

function dailyId(targetDate: string, timezone: string) {
  return `${targetDate}|${timezone}`;
}

function nextBatch(from = new Date(), minutes = ENGINE_BATCH_MINUTES) {
  return new Date(from.getTime() + minutes * 60_000).toISOString();
}

async function ensureDailyLedger(targetDate: string, timezone: string) {
  const db = getDb();
  const id = dailyId(targetDate, timezone);
  // Legacy storage remains forward-compatible; it has no quota or stop semantics after decision 0013.
  await db.insert(dailyDiscoveryTargets).values({ id, targetDate, timezone, legacyTargetCount: 20 }).onConflictDoNothing();
  const [row] = await db.select().from(dailyDiscoveryTargets).where(eq(dailyDiscoveryTargets.id, id)).limit(1);
  return row;
}

export async function addRunToDailyLedger(targetDate: string, timezone: string, counts: RunCounts) {
  const db = getDb();
  const ledger = await ensureDailyLedger(targetDate, timezone);
  const updatedAt = new Date().toISOString();
  const [updated] = await db.update(dailyDiscoveryTargets).set({
    rawDiscoveredCount: sql`${dailyDiscoveryTargets.rawDiscoveredCount} + ${counts.rawDiscovered}`,
    parsedCount: sql`${dailyDiscoveryTargets.parsedCount} + ${counts.parsed}`,
    websiteVerifiedCount: sql`${dailyDiscoveryTargets.websiteVerifiedCount} + ${counts.websiteVerified}`,
    validContactCount: sql`${dailyDiscoveryTargets.validContactCount} + ${counts.validContact}`,
    duplicateCount: sql`${dailyDiscoveryTargets.duplicateCount} + ${counts.duplicate}`,
    mandatoryGateFailedCount: sql`${dailyDiscoveryTargets.mandatoryGateFailedCount} + ${counts.mandatoryFailed}`,
    qualifiedCount: sql`${dailyDiscoveryTargets.qualifiedCount} + ${counts.qualified}`,
    failedCount: sql`${dailyDiscoveryTargets.failedCount} + ${counts.failed}`,
    sourceExhausted: false,
    availabilityNote: null,
    updatedAt,
  }).where(eq(dailyDiscoveryTargets.id, ledger.id)).returning();
  return updated;
}

async function activeBusinessCampaigns() {
  const db = getDb();
  const rows = await db.select().from(campaigns).where(eq(campaigns.status, "active"));
  return rows.filter((campaign) => !isSystemCampaignId(campaign.id));
}

async function prepareActiveCampaigns() {
  await ensureUnassignedCampaign();
  const active = await activeBusinessCampaigns();
  if (!active.length) throw new Error("no_active_campaigns");
  await seedOfficialSourceRegistry();
  return active;
}

export async function startAutomaticEngine(timezone = DEFAULT_TIMEZONE) {
  await prepareActiveCampaigns();
  await recoverStaleDiscoveryRuns();
  const db = getDb();
  const now = new Date();
  const timestamp = now.toISOString();
  const targetDate = dateInTimezone(now, timezone);
  await ensureDailyLedger(targetDate, timezone);
  await db.insert(engineState).values({
    id: "global", status: "running", timezone, activeCampaignId: null,
    startedAt: timestamp, pausedAt: null, stoppedAt: null, lastHeartbeatAt: timestamp,
    nextRunAt: timestamp, lastError: null, updatedAt: timestamp,
  }).onConflictDoUpdate({
    target: engineState.id,
    set: {
      status: "running", timezone, activeCampaignId: null,
      startedAt: timestamp, pausedAt: null, stoppedAt: null, lastHeartbeatAt: timestamp,
      nextRunAt: timestamp, lastError: null, updatedAt: timestamp,
    },
  });
  const [state] = await db.select().from(engineState).where(eq(engineState.id, "global")).limit(1);
  return state;
}

export async function pauseAutomaticEngine() {
  const db = getDb();
  const now = new Date().toISOString();
  const [state] = await db.update(engineState).set({
    status: "paused", pausedAt: now, nextRunAt: null, updatedAt: now,
  }).where(eq(engineState.id, "global")).returning();
  if (!state) throw new Error("engine_not_started");
  return state;
}

export async function resumeAutomaticEngine() {
  const db = getDb();
  const [current] = await db.select().from(engineState).where(eq(engineState.id, "global")).limit(1);
  if (!current) throw new Error("engine_not_started");
  await prepareActiveCampaigns();
  const now = new Date().toISOString();
  const [state] = await db.update(engineState).set({
    status: "running", pausedAt: null, stoppedAt: null, lastHeartbeatAt: now,
    nextRunAt: now, lastError: null, updatedAt: now,
  }).where(eq(engineState.id, "global")).returning();
  return state;
}

export async function stopAutomaticEngine() {
  const db = getDb();
  const now = new Date().toISOString();
  const [state] = await db.update(engineState).set({
    status: "stopped", stoppedAt: now, pausedAt: null, nextRunAt: null, updatedAt: now,
  }).where(eq(engineState.id, "global")).returning();
  if (!state) throw new Error("engine_not_started");
  return state;
}

async function createAlertOnce(values: typeof discoveryAlerts.$inferInsert) {
  const db = getDb();
  const existing = await db.select({ id: discoveryAlerts.id }).from(discoveryAlerts).where(and(
    eq(discoveryAlerts.targetDate, values.targetDate || ""),
    eq(discoveryAlerts.alertType, values.alertType),
  )).limit(1);
  if (!existing.length) await db.insert(discoveryAlerts).values(values);
}

export async function runAutomaticDiscoveryBatch() {
  const db = getDb();
  await recoverStaleDiscoveryRuns();
  const [state] = await db.select().from(engineState).where(eq(engineState.id, "global")).limit(1);
  if (!state || state.status !== "running") {
    return { status: state?.status || "stopped", ran: false, reason: "engine_not_running" };
  }
  await ensureUnassignedCampaign();
  const active = await activeBusinessCampaigns();
  if (!active.length) throw new Error("no_active_campaigns");
  await ensureOfficialSourceRegistry();
  const activeIds = new Set(active.map((campaign) => campaign.id));
  const now = new Date();
  const timestamp = now.toISOString();
  const targetDate = dateInTimezone(now, state.timezone);
  let ledger = await ensureDailyLedger(targetDate, state.timezone);

  const registeredSources = (await db.select().from(discoverySources).where(and(
    eq(discoverySources.enabled, true),
    eq(discoverySources.status, "active"),
    eq(discoverySources.requiresLogin, false),
    eq(discoverySources.isPaid, false),
  )).orderBy(asc(discoverySources.tier), asc(discoverySources.priority)))
    .filter((source) => activeIds.has(source.campaignId) || source.campaignId === GLOBAL_DISCOVERY_CAMPAIGN_ID);
  const todayRuns = await db.select({ sourceId: discoveryRuns.sourceId }).from(discoveryRuns).where(and(
    eq(discoveryRuns.targetDate, targetDate),
  ));
  const used = new Set(todayRuns.map((run) => run.sourceId));
  const runsByCampaign = new Map<string, number>();
  const runsBySource = new Map<string, number>();
  for (const run of todayRuns) {
    runsBySource.set(run.sourceId, (runsBySource.get(run.sourceId) || 0) + 1);
    const campaignId = registeredSources.find((candidate) => candidate.id === run.sourceId)?.campaignId;
    if (campaignId) runsByCampaign.set(campaignId, (runsByCampaign.get(campaignId) || 0) + 1);
  }
  const eligibleSources = registeredSources.filter((candidate) => sourceRepeatsDuringDay(candidate) || !used.has(candidate.id));
  const sources = eligibleSources.filter((source) => !source.nextRunAt || source.nextRunAt <= timestamp);
  const source = sources.sort((left, right) =>
    (runsByCampaign.get(left.campaignId) || 0) - (runsByCampaign.get(right.campaignId) || 0)
    || (runsBySource.get(left.id) || 0) - (runsBySource.get(right.id) || 0)
    || left.priority - right.priority
  )[0] || null;
  if (!source) {
    const futureSources = eligibleSources.filter((candidate) => candidate.nextRunAt && candidate.nextRunAt > timestamp);
    if (futureSources.length) {
      const earliest = futureSources.map((candidate) => candidate.nextRunAt as string).sort()[0];
      await db.update(engineState).set({
        lastHeartbeatAt: timestamp, nextRunAt: earliest, lastError: null, updatedAt: timestamp,
      }).where(eq(engineState.id, "global"));
      return { status: "sources_waiting", ran: false, ledger, nextRunAt: earliest };
    }
    const reason = "当前没有到期且可运行的 A/B 级来源；引擎保持运行并将在来源再次可用时继续。";
    [ledger] = await db.update(dailyDiscoveryTargets).set({
      sourceExhausted: true, availabilityNote: reason, updatedAt: timestamp,
    }).where(eq(dailyDiscoveryTargets.id, ledger.id)).returning();
    await createAlertOnce({
      id: crypto.randomUUID(), targetDate, severity: "warning", alertType: "sources_temporarily_exhausted",
      message: reason, detailsJson: JSON.stringify({ enabledSources: registeredSources.length, dueSources: sources.length }),
    });
    await db.update(engineState).set({
      lastHeartbeatAt: timestamp, lastError: null, nextRunAt: nextBatch(now, 60), updatedAt: timestamp,
    }).where(eq(engineState.id, "global"));
    return { status: "sources_exhausted", ran: false, ledger };
  }

  const result = await runDiscoverySource(source.id, "scheduled", {
    targetDate,
    maxCandidates: DISCOVERY_RUNTIME_CONFIG.batchCandidates,
  });
  ledger = await addRunToDailyLedger(targetDate, state.timezone, result);
  const remainingSources = sources.filter((candidate) => candidate.id !== source.id).length;
  if (result.status === "failed") {
    await createAlertOnce({
      id: crypto.randomUUID(), sourceId: source.id, runId: result.runId, targetDate,
      severity: "warning", alertType: `source_failure:${source.id}`,
      message: `${source.name} 运行失败，下一批将自动切换来源。`, detailsJson: JSON.stringify({ errors: result.errors }),
    });
  }
  await db.update(engineState).set({
    activeCampaignId: source.campaignId === GLOBAL_DISCOVERY_CAMPAIGN_ID ? null : source.campaignId,
    lastHeartbeatAt: timestamp, lastRunAt: timestamp,
    nextRunAt: remainingSources > 0 || sourceRepeatsDuringDay(source) ? nextBatch(now) : nextBatch(now, 60),
    lastError: result.status === "failed" ? result.errors.join("；").slice(0, 1000) : null,
    updatedAt: timestamp,
  }).where(eq(engineState.id, "global"));
  return {
    status: "batch_completed",
    ran: true, source: { id: source.id, name: source.name, campaignId: source.campaignId }, result, ledger,
    remainingSources,
  };
}
