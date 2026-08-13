import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("renders the complete isolated Lead Engine shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /QIXIN Lead Engine Lab/);
  assert.match(html, /可审计的销售机会/);
  assert.match(html, /生产系统未连接/);
  assert.match(html, /新建完整 Campaign/);
  assert.match(html, /批准后才能生成 CRM 文件/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|Your site is taking shape/i);
});

test("implements the normalized, evidence-first V1 model", async () => {
  const [schema, importRoute, workspaceRoute, reviewRoute, exportRoute, leadEngine] = await Promise.all([
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/import/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/workspace/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/reviews/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/exports/crm/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/lead-engine.ts", import.meta.url), "utf8"),
  ]);
  for (const table of [
    "prospect_companies", "campaign_leads", "company_domains", "company_domain_links",
    "lead_sources", "evidence_claims", "lead_score_runs", "lead_score_dimensions",
    "lead_import_runs", "lead_review_decisions", "crm_export_runs", "crm_export_items",
  ]) assert.match(schema, new RegExp(table));
  assert.match(schema, /uq_campaign_lead_company/);
  assert.match(schema, /uq_lead_import_campaign_key/);
  assert.match(importRoute, /idempotencyKey/);
  assert.match(importRoute, /evidence_claim_required/);
  assert.match(importRoute, /score_reason_required/);
  assert.match(importRoute, /companyNamesLikelySame/);
  assert.match(workspaceRoute, /buildSearchKeywords/);
  assert.match(workspaceRoute, /researchBrief/);
  assert.match(reviewRoute, /hard_gate_not_passed/);
  assert.match(reviewRoute, /evidenceCoverage < 40/);
  assert.match(reviewRoute, /observed_evidence_required/);
  assert.match(exportRoute, /workflowStatus, "approved"/);
  assert.match(exportRoute, /crmExportRuns/);
  assert.doesNotMatch(exportRoute, /fetch\(|CRM_API|Authorization/i);
  assert.match(leadEngine, /RUBRIC_VERSION = "qixin-v1\.1"/);
  assert.match(leadEngine, /companyNamesLikelySame/);
  assert.match(leadEngine, /Local-language discovery/);
  assert.match(leadEngine, /observed \/ inferred \/ unknown/);
});

test("keeps Sites, storage, and CRM handoff isolated", async () => {
  const [hosting, agents, packageJson] = await Promise.all([
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
    readFile(new URL("../AGENTS.md", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  const hostingConfig = JSON.parse(hosting);
  assert.equal(hostingConfig.project_id, "appgprj_6a7cee692ee48191bf4ce6ce38403734");
  assert.notEqual(hostingConfig.project_id, "appgprj_6a5a9a08d8048191994a626812231e80");
  assert.equal(hostingConfig.d1, "DB");
  assert.equal(hostingConfig.r2, null);
  assert.match(agents, /Never read from or write to the production QIXIN D1\/R2 bindings/);
  assert.match(agents, /Do not add a production CRM write credential/);
  assert.match(packageJson, /qixin-eyewear-lead-engine-lab/);
});

test("covers the complete QIXIN product catalog in campaign research and CRM handoff", async () => {
  const [leadEngine, ui] = await Promise.all([
    readFile(new URL("../lib/lead-engine.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/LeadEngineApp.tsx", import.meta.url), "utf8"),
  ]);
  for (const [track, crmLabel] of [
    ["optical_frames", "Optical frames"],
    ["sunglasses", "Sunglasses"],
    ["reading_glasses", "Reading glasses"],
    ["blue_light_glasses", "Blue light glasses"],
    ["kids_eyewear", "Kids eyewear"],
    ["sports_eyewear", "Sports eyewear"],
    ["protective_eyewear", "Protective eyewear"],
    ["optical_lenses", "Optical lenses"],
  ]) {
    assert.match(leadEngine, new RegExp(`${track}.*${crmLabel}`));
    assert.match(ui, new RegExp(`${track}:`));
  }
  assert.match(leadEngine, /Brillenfassungen/);
  assert.match(leadEngine, /monturas ópticas/);
  assert.match(leadEngine, /oprawki okularowe/);
  assert.match(leadEngine, /إطارات نظارات طبية/);
});

test("opens verified company websites safely without replacing evidence review", async () => {
  const ui = await readFile(new URL("../components/LeadEngineApp.tsx", import.meta.url), "utf8");
  assert.match(ui, /function companyWebsiteUrl/);
  assert.match(ui, /url\.protocol === "http:" \|\| url\.protocol === "https:"/);
  assert.match(ui, /target="_blank"/);
  assert.match(ui, /rel="noopener noreferrer"/);
  assert.match(ui, /查看证据与审核/);
});
