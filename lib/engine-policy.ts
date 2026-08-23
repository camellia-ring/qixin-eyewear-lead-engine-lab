export const DEFAULT_TIMEZONE = "Asia/Shanghai";
export const DEFAULT_DAILY_TARGET = 20;
export const ENGINE_BATCH_MINUTES = 15;

export type DailyRunCounts = {
  rawDiscovered: number; parsed: number; websiteVerified: number; validContact: number;
  duplicate: number; mandatoryFailed: number; qualified: number; failed: number;
};

export function dateInTimezone(date = new Date(), timezone = DEFAULT_TIMEZONE) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export function dailyProgress(target: number, qualified: number) {
  const remaining = Math.max(0, target - qualified);
  return { target, qualified, remaining, completionRate: target ? Math.min(100, Math.round((qualified / target) * 100)) : 0 };
}

export function mergeDailyCounts(current: {
  rawDiscoveredCount: number; parsedCount: number; websiteVerifiedCount: number; validContactCount: number;
  duplicateCount: number; mandatoryGateFailedCount: number; qualifiedCount: number; failedCount: number;
}, counts: DailyRunCounts) {
  return {
    rawDiscoveredCount: current.rawDiscoveredCount + counts.rawDiscovered,
    parsedCount: current.parsedCount + counts.parsed,
    websiteVerifiedCount: current.websiteVerifiedCount + counts.websiteVerified,
    validContactCount: current.validContactCount + counts.validContact,
    duplicateCount: current.duplicateCount + counts.duplicate,
    mandatoryGateFailedCount: current.mandatoryGateFailedCount + counts.mandatoryFailed,
    qualifiedCount: current.qualifiedCount + counts.qualified,
    failedCount: current.failedCount + counts.failed,
  };
}

export function chooseNextSource<T extends { id: string }>(sources: T[], usedSourceIds: Iterable<string>) {
  const used = new Set(usedSourceIds);
  return sources.find((source) => !used.has(source.id)) || null;
}

export function sourceRepeatsDuringDay(source: { parserConfigJson: string }) {
  try {
    return (JSON.parse(source.parserConfigJson || "{}") as Record<string, unknown>).repeatDuringDay === true;
  } catch {
    return false;
  }
}
