import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("implements bounded, auditable public-source discovery", async () => {
  const [schema, migration, discovery, sourceRoute, workspace, ui] = await Promise.all([
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0002_bumpy_ronan.sql", import.meta.url), "utf8"),
    readFile(new URL("../lib/discovery.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/discovery/sources/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/workspace/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/LeadEngineApp.tsx", import.meta.url), "utf8"),
  ]);

  for (const table of ["discovery_sources", "discovery_runs", "discovery_run_items"]) {
    assert.match(schema, new RegExp(table));
    assert.match(migration, new RegExp("CREATE TABLE `" + table + "`"));
  }
  assert.match(schema, /maxCandidates.*default\(10\)/s);
  assert.match(schema, /BETWEEN 1 AND 20/);
  assert.match(discovery, /MAX_HTML_BYTES = 1_250_000/);
  assert.match(discovery, /FETCH_TIMEOUT_MS = 8_000/);
  assert.match(discovery, /redirect === 3/);
  assert.match(discovery, /robots\.txt/);
  assert.match(discovery, /QIXIN-Lead-Engine\/1\.0/);
  assert.match(discovery, /GENERIC_EMAIL_PREFIXES/);
  assert.match(discovery, /BLOCKED_SUFFIXES/);
  assert.match(discovery, /a === 10 \|\| a === 127/);
  assert.match(sourceRoute, /campaign\.status !== "active"/);
  assert.match(workspace, /discoveryItems/);
  assert.match(ui, /自动发现与官网证据/);
});

test("keeps automated discoveries behind human approval and outside paid APIs", async () => {
  const [runner, discovery, reviewRoute, packageJson, agents] = await Promise.all([
    readFile(new URL("../lib/discovery-runner.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/discovery.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/reviews/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../AGENTS.md", import.meta.url), "utf8"),
  ]);

  assert.match(runner, /workflowStatus: "needs_review"/);
  assert.match(runner, /hardGateStatus: "needs_review"/);
  assert.match(runner, /modelIdentifier: "deterministic_public_rules_v1"/);
  assert.doesNotMatch(runner, /workflowStatus: "approved"/);
  assert.doesNotMatch(runner, /prospectContacts|contactName|fullName/);
  assert.doesNotMatch(`${runner}\n${discovery}\n${packageJson}`, /OPENAI_API_KEY|api\.openai\.com|anthropic|apollo|emailjs|sendgrid/i);
  assert.match(reviewRoute, /decision === "approved"/);
  assert.match(reviewRoute, /hard_gate_not_passed/);
  assert.match(agents, /Do not add broad web search, personal-contact enrichment, guessed emails, email generation, email sending, automatic approval/);
});
