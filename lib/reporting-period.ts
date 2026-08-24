export const REPORTING_TIME_ZONE = "Asia/Shanghai";

export type CompletionPeriodKind = "week" | "month" | "quarter" | "year";

export type ReportingPeriod = {
  kind: CompletionPeriodKind;
  anchor: string;
  startDate: string;
  endDate: string;
  from: string;
  to: string;
  label: string;
};

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

function parts(dateKey: string) {
  if (!isDateKey(dateKey)) throw new Error("invalid_completion_anchor");
  const [year, month, day] = dateKey.split("-").map(Number);
  return { year, month, day };
}

function dateKeyFromUtcDate(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function isDateKey(value: string | null | undefined): value is string {
  if (!value || !DATE_KEY.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  return dateKeyFromUtcDate(new Date(Date.UTC(year, month - 1, day))) === value;
}

export function dateInReportingTimeZone(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: REPORTING_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function addLocalDays(dateKey: string, days: number) {
  const { year, month, day } = parts(dateKey);
  return dateKeyFromUtcDate(new Date(Date.UTC(year, month - 1, day + days)));
}

function localDateStartUtc(dateKey: string) {
  return new Date(`${dateKey}T00:00:00+08:00`).toISOString();
}

function localDateLabel(dateKey: string, includeYear = false) {
  const { year, month, day } = parts(dateKey);
  return `${includeYear ? `${year}年` : ""}${month}月${day}日`;
}

export function reportingPeriod(kind: CompletionPeriodKind, anchor = dateInReportingTimeZone()): ReportingPeriod {
  const { year, month, day } = parts(anchor);
  let startDate: string;
  let endDate: string;
  let label: string;

  if (kind === "week") {
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    startDate = addLocalDays(anchor, -((weekday + 6) % 7));
    endDate = addLocalDays(startDate, 7);
    label = `${localDateLabel(startDate, true)}–${localDateLabel(addLocalDays(endDate, -1))}`;
  } else if (kind === "month") {
    startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    endDate = dateKeyFromUtcDate(new Date(Date.UTC(year, month, 1)));
    label = `${year}年${month}月`;
  } else if (kind === "quarter") {
    const quarter = Math.floor((month - 1) / 3) + 1;
    const startMonth = (quarter - 1) * 3;
    startDate = dateKeyFromUtcDate(new Date(Date.UTC(year, startMonth, 1)));
    endDate = dateKeyFromUtcDate(new Date(Date.UTC(year, startMonth + 3, 1)));
    label = `${year}年第${quarter}季度`;
  } else {
    startDate = `${year}-01-01`;
    endDate = `${year + 1}-01-01`;
    label = `${year}年`;
  }

  return {
    kind,
    anchor,
    startDate,
    endDate,
    from: localDateStartUtc(startDate),
    to: localDateStartUtc(endDate),
    label,
  };
}

export function shiftReportingAnchor(kind: CompletionPeriodKind, anchor: string, direction: -1 | 1) {
  const period = reportingPeriod(kind, anchor);
  if (kind === "week") return addLocalDays(period.startDate, direction * 7);
  const { year, month } = parts(period.startDate);
  const delta = kind === "month" ? direction : kind === "quarter" ? direction * 3 : direction * 12;
  return dateKeyFromUtcDate(new Date(Date.UTC(year, month - 1 + delta, 1)));
}

export function periodContainsDate(period: Pick<ReportingPeriod, "startDate" | "endDate">, dateKey: string) {
  return dateKey >= period.startDate && dateKey < period.endDate;
}
