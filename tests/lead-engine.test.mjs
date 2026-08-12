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

test("renders the isolated Lead Engine shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /QIXIN Lead Engine Lab/);
  assert.match(html, /客户开发实验室/);
  assert.match(html, /生产系统未连接/);
  assert.match(html, /只有已批准记录才能导出/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|Your site is taking shape/i);
});

test("keeps the persistence and CRM handoff isolated", async () => {
  const [hosting, schema, exportRoute, packageJson] = await Promise.all([
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/exports/crm/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  const hostingConfig = JSON.parse(hosting);
  assert.equal(hostingConfig.project_id, "appgprj_6a7cee692ee48191bf4ce6ce38403734");
  assert.notEqual(hostingConfig.project_id, "appgprj_6a5a9a08d8048191994a626812231e80");
  assert.equal(hostingConfig.d1, "DB");
  assert.equal(hostingConfig.r2, null);
  assert.match(schema, /candidate_companies/);
  assert.match(schema, /evidence_items/);
  assert.match(schema, /review_decisions/);
  assert.match(exportRoute, /reviewStatus, "approved"/);
  assert.match(exportRoute, /lead_engine_lab/);
  assert.doesNotMatch(exportRoute, /fetch\(|CRM_API|Authorization/i);
  assert.match(packageJson, /qixin-eyewear-lead-engine-lab/);
});
