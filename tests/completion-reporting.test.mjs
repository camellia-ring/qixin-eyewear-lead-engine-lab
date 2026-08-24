import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import {
  addLocalDays,
  dateInReportingTimeZone,
  periodContainsDate,
  reportingPeriod,
  shiftReportingAnchor,
} from "../lib/reporting-period.ts";

test("completion reporting uses Asia/Shanghai natural-day boundaries", () => {
  assert.equal(dateInReportingTimeZone(new Date("2026-08-23T15:59:59.999Z")), "2026-08-23");
  assert.equal(dateInReportingTimeZone(new Date("2026-08-23T16:00:00.000Z")), "2026-08-24");
  assert.equal(addLocalDays("2024-02-28", 1), "2024-02-29");
  assert.equal(addLocalDays("2024-02-29", 1), "2024-03-01");
});

test("week, month, quarter and year ranges use natural calendar periods", () => {
  const week = reportingPeriod("week", "2026-08-25");
  assert.deepEqual(
    { startDate: week.startDate, endDate: week.endDate, from: week.from, to: week.to },
    { startDate: "2026-08-24", endDate: "2026-08-31", from: "2026-08-23T16:00:00.000Z", to: "2026-08-30T16:00:00.000Z" },
  );
  assert.equal(reportingPeriod("month", "2024-02-29").endDate, "2024-03-01");
  assert.equal(reportingPeriod("quarter", "2026-08-25").startDate, "2026-07-01");
  assert.equal(reportingPeriod("quarter", "2026-08-25").endDate, "2026-10-01");
  assert.equal(reportingPeriod("year", "2026-08-25").endDate, "2027-01-01");
  assert.equal(periodContainsDate(week, "2026-08-24"), true);
  assert.equal(periodContainsDate(week, "2026-08-31"), false);
});

test("period navigation moves by one complete natural period", () => {
  assert.equal(shiftReportingAnchor("week", "2026-08-25", -1), "2026-08-17");
  assert.equal(shiftReportingAnchor("month", "2026-01-15", -1), "2025-12-01");
  assert.equal(shiftReportingAnchor("quarter", "2026-08-25", 1), "2026-10-01");
  assert.equal(shiftReportingAnchor("year", "2026-08-25", -1), "2025-01-01");
});

test("completion scope counts one primary company and excludes import-origin companies", async () => {
  const source = await readFile(new URL("../lib/completion-reporting.ts", import.meta.url), "utf8");
  assert.match(source, /campaignLeads\.campaignId, prospectCompanies\.primaryCampaignId/);
  assert.match(source, /isNotNull\(campaignLeads\.autoQualifiedAt\)/);
  assert.match(source, /NOT EXISTS/);
  assert.match(source, /imported_lead\.import_run_id IS NOT NULL/);
  assert.match(source, /imported_lead\.created_at.*autoQualifiedAt/s);
  assert.match(source, /gte\(campaignLeads\.autoQualifiedAt, period\.from\)/);
  assert.match(source, /lt\(campaignLeads\.autoQualifiedAt, period\.to\)/);
});

test("database completion aggregation cannot double-count Campaigns or include import-origin companies", () => {
  const database = new DatabaseSync(":memory:");
  database.exec(`
    CREATE TABLE prospect_companies (id TEXT PRIMARY KEY, primary_campaign_id TEXT);
    CREATE TABLE campaign_leads (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      company_id TEXT NOT NULL,
      import_run_id TEXT,
      match_status TEXT NOT NULL,
      auto_qualified_at TEXT,
      created_at TEXT NOT NULL
    );
    INSERT INTO prospect_companies VALUES
      ('automatic', 'campaign-a'),
      ('import-primary', 'campaign-c'),
      ('import-rematched', 'campaign-e'),
      ('automatic-later-import', 'campaign-h'),
      ('not-qualified', 'campaign-g');
    INSERT INTO campaign_leads VALUES
      ('lead-a', 'campaign-a', 'automatic', NULL, 'current', '2026-08-24T03:00:00.000Z', '2026-08-24T03:00:00.000Z'),
      ('lead-b', 'campaign-b', 'automatic', NULL, 'current', '2026-08-24T03:00:00.000Z', '2026-08-24T03:00:00.000Z'),
      ('lead-c', 'campaign-c', 'import-primary', 'import-1', 'current', '2026-08-24T04:00:00.000Z', '2026-08-24T02:00:00.000Z'),
      ('lead-d', 'campaign-d', 'import-rematched', 'import-2', 'stale', NULL, '2026-08-24T02:00:00.000Z'),
      ('lead-e', 'campaign-e', 'import-rematched', NULL, 'current', '2026-08-24T05:00:00.000Z', '2026-08-24T05:00:00.000Z'),
      ('lead-h', 'campaign-h', 'automatic-later-import', NULL, 'current', '2026-08-24T06:00:00.000Z', '2026-08-24T06:00:00.000Z'),
      ('lead-i', 'campaign-i', 'automatic-later-import', 'import-3', 'manual', NULL, '2026-08-24T07:00:00.000Z'),
      ('lead-g', 'campaign-g', 'not-qualified', NULL, 'current', NULL, '2026-08-24T02:00:00.000Z');
  `);
  const rows = database.prepare(`
    SELECT date(datetime(primary_lead.auto_qualified_at, '+8 hours')) AS completed_date, count(*) AS value
    FROM campaign_leads AS primary_lead
    INNER JOIN prospect_companies AS company ON primary_lead.company_id = company.id
    WHERE primary_lead.campaign_id = company.primary_campaign_id
      AND primary_lead.match_status <> 'stale'
      AND primary_lead.auto_qualified_at IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM campaign_leads AS imported_lead
        WHERE imported_lead.company_id = company.id
          AND imported_lead.import_run_id IS NOT NULL
          AND datetime(imported_lead.created_at) <= datetime(primary_lead.auto_qualified_at)
      )
    GROUP BY completed_date
  `).all();
  assert.deepEqual(rows.map((row) => ({ ...row })), [{ completed_date: "2026-08-24", value: 2 }]);
  database.close();
});

test("first automatic completion stays immutable and import provenance follows Campaign rematching", async () => {
  const reverification = await readFile(new URL("../lib/reverification.ts", import.meta.url), "utf8");
  const membership = await readFile(new URL("../lib/campaign-membership.ts", import.meta.url), "utf8");
  assert.match(reverification, /autoQualifiedAt: lead\.autoQualifiedAt \|\| \(qualification\.qualified \? now : null\)/);
  assert.doesNotMatch(reverification, /autoQualifiedAt: qualification\.qualified \? lead\.autoQualifiedAt \|\| now : null/);
  assert.match(membership, /importRunId: template\.importRunId/);
  assert.match(membership, /autoQualifiedAt: template\.autoQualifiedAt/);
});

test("statistics and review filters share the completion scope and place time above customer range", async () => {
  const [statsApi, leadsApi, review, automatic, activity, state] = await Promise.all([
    readFile(new URL("../app/api/discovery/stats/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/leads/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/lead-engine/LeadReviewView.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/lead-engine/AutomaticDiscoveryView.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/lead-engine/CompletionActivityChart.tsx", import.meta.url), "utf8"),
    readFile(new URL("../hooks/useLeadEngineState.ts", import.meta.url), "utf8"),
  ]);
  assert.match(statsApi, /automaticCompletionScope\(\)/);
  assert.match(leadsApi, /automaticCompletionScope\(completionPeriod\)/);
  assert.ok(review.indexOf("completionFilterBar") < review.indexOf("reviewScopeBar"));
  for (const label of ["今日已完成", "昨日已完成", "累计已完成", "本周", "本月", "本季度", "本年"]) {
    assert.match(automatic, new RegExp(label));
  }
  for (const label of ["完成趋势", "30天", "90天", "查看每日明细", "最高单日"]) assert.match(activity, new RegExp(label));
  assert.match(activity, /aria-pressed/);
  assert.match(activity, /aria-label={`\$\{day\.date\}，完成 \$\{day\.count\} 家`}/);
  assert.match(automatic, /CompletionActivityChart/);
  assert.match(state, /historyLimit=\$\{historyLimitRef\.current\}/);
  assert.match(state, /loadDiscoveryHistory/);
  assert.match(state, /parameters\.set\("completionPeriod", completionPeriod\)/);
  assert.match(state, /parameters\.set\("completionAnchor", completionAnchor\)/);
});
