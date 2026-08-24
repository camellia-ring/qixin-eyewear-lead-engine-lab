import { count, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { campaignLeads, prospectCompanies } from "@/db/schema";
import { apiFailure } from "@/lib/api";
import { automaticCompletionScope } from "@/lib/completion-reporting";
import {
  addLocalDays,
  dateInReportingTimeZone,
  isDateKey,
  periodContainsDate,
  REPORTING_TIME_ZONE,
  reportingPeriod,
} from "@/lib/reporting-period";

function boundedInteger(value: string | null, fallback: number, min: number, max: number) {
  const number = Number(value ?? fallback);
  return Number.isInteger(number) ? Math.max(min, Math.min(max, number)) : fallback;
}

function labelForDay(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
    weekday: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

export async function GET(request: Request) {
  try {
    const parameters = new URL(request.url).searchParams;
    const historyLimit = boundedInteger(parameters.get("historyLimit"), 30, 7, 90);
    const before = parameters.get("before");
    if (before && !isDateKey(before)) throw new Error("invalid_history_before");

    const completedDate = sql<string>`date(datetime(${campaignLeads.autoQualifiedAt}, '+8 hours'))`;
    const db = getDb();
    const [dailyRows, totalRows] = await Promise.all([
      db.select({ date: completedDate, value: count() })
        .from(campaignLeads)
        .innerJoin(prospectCompanies, eq(campaignLeads.companyId, prospectCompanies.id))
        .where(automaticCompletionScope())
        .groupBy(completedDate)
        .orderBy(desc(completedDate)),
      db.select({ value: count() })
        .from(campaignLeads)
        .innerJoin(prospectCompanies, eq(campaignLeads.companyId, prospectCompanies.id))
        .where(automaticCompletionScope()),
    ]);
    const countsByDate = new Map(dailyRows.map((row) => [row.date, Number(row.value || 0)]));
    const today = dateInReportingTimeZone();
    const yesterday = addLocalDays(today, -1);
    const periods = {
      week: reportingPeriod("week", today),
      month: reportingPeriod("month", today),
      quarter: reportingPeriod("quarter", today),
      year: reportingPeriod("year", today),
    };
    const sum = (period: { startDate: string; endDate: string }) => dailyRows.reduce(
      (total, row) => total + (periodContainsDate(period, row.date) ? Number(row.value || 0) : 0),
      0,
    );

    const historyEnd = before ? addLocalDays(before, -1) : today;
    const historyStart = addLocalDays(historyEnd, -(historyLimit - 1));
    const history = Array.from({ length: historyLimit }, (_, index) => {
      const date = addLocalDays(historyEnd, -index);
      return { date, label: labelForDay(date), count: countsByDate.get(date) || 0 };
    });
    const earliestCompletedDate = dailyRows.at(-1)?.date || null;

    return Response.json({
      generatedAt: new Date().toISOString(),
      timeZone: REPORTING_TIME_ZONE,
      definition: "自动发现后通过筛选、公司级去重并保存的唯一合格公司；导入客户不计入",
      summary: {
        today: countsByDate.get(today) || 0,
        yesterday: countsByDate.get(yesterday) || 0,
        week: sum(periods.week),
        month: sum(periods.month),
        quarter: sum(periods.quarter),
        year: sum(periods.year),
        total: Number(totalRows[0]?.value || 0),
      },
      periods,
      history: {
        rows: history,
        previousBefore: earliestCompletedDate && historyStart > earliestCompletedDate ? historyStart : null,
        earliestCompletedDate,
      },
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiFailure(error);
  }
}
