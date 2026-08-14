import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

const root = new URL("../", import.meta.url);

function migration(name) {
  return readFileSync(new URL(`drizzle/${name}`, root), "utf8");
}

function applySql(db, sql) {
  for (const statement of sql.split("--> statement-breakpoint").map((value) => value.trim()).filter(Boolean)) db.exec(statement);
}

test("automatic engine migration is forward-only and preserves representative historical rows", () => {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys=ON");
  applySql(db, migration("0000_lead_engine_v1.sql"));
  applySql(db, migration("0001_normalized-lead-model.sql"));
  applySql(db, migration("0002_bumpy_ronan.sql"));

  db.exec(`INSERT INTO campaigns (id,name,product_track,status) VALUES ('campaign-1','Historical campaign','optical_lenses','active')`);
  db.exec(`INSERT INTO prospect_companies (id,company_name,identity_key) VALUES ('company-1','Historical Optical','entity:historical.example|historical optical')`);
  db.exec(`INSERT INTO campaign_leads (id,campaign_id,company_id,product_track) VALUES ('lead-1','campaign-1','company-1','optical_lenses')`);
  db.exec(`INSERT INTO discovery_sources (id,campaign_id,name,source_url,normalized_domain) VALUES ('source-1','campaign-1','Historical source','https://directory.example.org','directory.example.org')`);
  db.exec(`INSERT INTO discovery_runs (id,source_id,campaign_id,status) VALUES ('run-1','source-1','campaign-1','completed')`);

  const forward = migration("0003_automatic_daily_engine.sql");
  assert.doesNotMatch(forward, /\b(?:DROP\s+TABLE|DELETE\s+FROM|TRUNCATE|RENAME\s+TO)\b/i);
  applySql(db, forward);

  assert.equal(db.prepare("SELECT count(*) AS value FROM campaigns WHERE id='campaign-1'").get().value, 1);
  assert.equal(db.prepare("SELECT count(*) AS value FROM prospect_companies WHERE id='company-1'").get().value, 1);
  assert.equal(db.prepare("SELECT count(*) AS value FROM campaign_leads WHERE id='lead-1'").get().value, 1);
  assert.equal(db.prepare("SELECT count(*) AS value FROM discovery_runs WHERE id='run-1'").get().value, 1);
  assert.ok(db.prepare("SELECT first_discovered_at AS value FROM prospect_companies WHERE id='company-1'").get().value);
  for (const table of ["engine_state", "daily_discovery_targets", "discovery_run_attempts", "source_health", "parser_versions", "contact_verification", "discovery_alerts"]) {
    assert.equal(db.prepare("SELECT count(*) AS value FROM sqlite_master WHERE type='table' AND name=?").get(table).value, 1);
  }
  db.close();
});
