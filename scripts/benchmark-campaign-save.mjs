import { DatabaseSync } from "node:sqlite";
import { performance } from "node:perf_hooks";
import { campaignMatchesCompany } from "../lib/campaign-routing.ts";

const sizesArg = process.argv.find((value) => value.startsWith("--sizes="))?.split("=")[1];
const iterationsArg = process.argv.find((value) => value.startsWith("--iterations="))?.split("=")[1];
const warmupArg = process.argv.find((value) => value.startsWith("--warmup="))?.split("=")[1];
const sizes = (sizesArg || "100,1000,5000").split(",").map(Number).filter((value) => Number.isInteger(value) && value > 0);
const iterations = Math.max(1, Number(iterationsArg || 12));
const warmup = Math.max(0, Number(warmupArg || 3));

if (!sizes.length) throw new Error("At least one positive --sizes value is required.");

function percentile(values, ratio) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)];
}

function round(value) { return Number(value.toFixed(2)); }

function setupDatabase(companyCount) {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    PRAGMA journal_mode = MEMORY;
    PRAGMA synchronous = OFF;
    CREATE TABLE campaigns (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, productTrack TEXT NOT NULL,
      targetCountriesJson TEXT NOT NULL, targetMarkets TEXT NOT NULL,
      productTypesJson TEXT NOT NULL, customerTypesJson TEXT NOT NULL,
      regionKey TEXT, productTracksJson TEXT, strategyPriority INTEGER NOT NULL, status TEXT NOT NULL
    );
    CREATE TABLE prospect_companies (
      id TEXT PRIMARY KEY, country TEXT, customerType TEXT, customerTypesJson TEXT,
      productDirectionsJson TEXT, productsJson TEXT, primaryCampaignId TEXT
    );
    CREATE TABLE campaign_leads (
      id TEXT PRIMARY KEY, campaignId TEXT NOT NULL, companyId TEXT NOT NULL,
      assignmentType TEXT NOT NULL, matchStatus TEXT NOT NULL, matchReason TEXT,
      UNIQUE(campaignId, companyId)
    );
    CREATE INDEX idx_campaign_leads_company ON campaign_leads(companyId);
  `);
  const campaign = {
    id: "campaign:benchmark", name: "United States", productTrack: "optical_lenses",
    targetCountriesJson: JSON.stringify(["United States"]), targetMarkets: "North America",
    productTypesJson: "[]", customerTypesJson: JSON.stringify(["眼镜批发商"]), regionKey: "custom",
    productTracksJson: JSON.stringify(["optical_lenses"]), strategyPriority: 100, status: "active",
  };
  db.prepare("INSERT INTO campaigns VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(...Object.values(campaign));
  const insertCompany = db.prepare("INSERT INTO prospect_companies VALUES (?, ?, ?, ?, ?, ?, ?)");
  const insertMembership = db.prepare("INSERT INTO campaign_leads VALUES (?, ?, ?, ?, ?, ?)");
  db.exec("BEGIN");
  for (let index = 0; index < companyCount; index += 1) {
    const id = `company:${index}`;
    const country = index % 2 === 0 ? "United States" : "Canada";
    insertCompany.run(id, country, "眼镜批发商", JSON.stringify(["眼镜批发商"]), JSON.stringify(["普通光学镜片"]), JSON.stringify(["optical lens"]), index % 2 === 0 ? campaign.id : "system:unassigned");
    if (index % 2 === 0) insertMembership.run(`lead:${index}`, campaign.id, id, "automatic", "current", "benchmark seed");
  }
  db.exec("COMMIT");
  return db;
}

function saveAndRematch(db, companyCount) {
  const startedAt = performance.now();
  db.prepare("UPDATE campaigns SET name = ?, targetCountriesJson = ? WHERE id = ?").run("Canada", JSON.stringify(["Canada"]), "campaign:benchmark");
  const afterSave = performance.now();
  const campaign = db.prepare("SELECT * FROM campaigns WHERE id = ?").get("campaign:benchmark");
  const companies = db.prepare("SELECT * FROM prospect_companies").all();
  const memberships = db.prepare("SELECT * FROM campaign_leads").all();
  const afterRead = performance.now();
  const membershipByCompany = new Map(memberships.map((membership) => [membership.companyId, membership]));
  const operations = [];
  for (const company of companies) {
    const existing = membershipByCompany.get(company.id);
    const matches = campaignMatchesCompany(campaign, company);
    if (matches && !existing) operations.push(["insert", company.id]);
    else if (!matches && existing?.matchStatus !== "stale") operations.push(["stale", existing.id]);
    const primaryCampaignId = matches ? campaign.id : "system:unassigned";
    if (company.primaryCampaignId !== primaryCampaignId) operations.push(["primary", company.id, primaryCampaignId]);
  }
  const afterPlan = performance.now();
  const insertMembership = db.prepare("INSERT INTO campaign_leads VALUES (?, ?, ?, 'automatic', 'current', 'benchmark rematch')");
  const staleMembership = db.prepare("UPDATE campaign_leads SET matchStatus = 'stale', matchReason = 'benchmark strategy changed' WHERE id = ?");
  const updatePrimary = db.prepare("UPDATE prospect_companies SET primaryCampaignId = ? WHERE id = ?");
  db.exec("BEGIN");
  for (const [kind, id, primaryCampaignId] of operations) {
    if (kind === "insert") insertMembership.run(`lead:new:${id}`, campaign.id, id);
    else if (kind === "stale") staleMembership.run(id);
    else updatePrimary.run(primaryCampaignId, id);
  }
  db.exec("COMMIT");
  const finishedAt = performance.now();
  const current = db.prepare("SELECT COUNT(*) AS count FROM campaign_leads WHERE matchStatus = 'current'").get().count;
  const stale = db.prepare("SELECT COUNT(*) AS count FROM campaign_leads WHERE matchStatus = 'stale'").get().count;
  if (Number(current) + Number(stale) !== companyCount) throw new Error(`Membership verification failed for ${companyCount} companies.`);
  return {
    totalMs: finishedAt - startedAt,
    campaignWriteMs: afterSave - startedAt,
    bulkReadMs: afterRead - afterSave,
    planMs: afterPlan - afterRead,
    batchWriteMs: finishedAt - afterPlan,
    writes: operations.length + 1,
    d1Batches: Math.ceil(operations.length / 80) + 1,
  };
}

const results = [];
for (const companyCount of sizes) {
  const samples = [];
  for (let sample = 0; sample < warmup + iterations; sample += 1) {
    const db = setupDatabase(companyCount);
    const result = saveAndRematch(db, companyCount);
    db.close();
    if (sample >= warmup) samples.push(result);
  }
  results.push({
    companies: companyCount,
    iterations,
    writes: samples[0].writes,
    d1Batches: samples[0].d1Batches,
    p50Ms: round(percentile(samples.map((sample) => sample.totalMs), 0.5)),
    p95Ms: round(percentile(samples.map((sample) => sample.totalMs), 0.95)),
    phasesP50Ms: {
      campaignWrite: round(percentile(samples.map((sample) => sample.campaignWriteMs), 0.5)),
      bulkRead: round(percentile(samples.map((sample) => sample.bulkReadMs), 0.5)),
      plan: round(percentile(samples.map((sample) => sample.planMs), 0.5)),
      batchWrite: round(percentile(samples.map((sample) => sample.batchWriteMs), 0.5)),
    },
  });
}

const report = {
  benchmark: "campaign-save-d1-compatible-local",
  capturedAt: new Date().toISOString(),
  runtime: { node: process.version, platform: process.platform, arch: process.arch },
  method: "Synthetic SQLite database using the production campaignMatchesCompany matcher, fixed bulk reads, in-memory planning, and 80-statement D1 batch accounting. Setup time is excluded.",
  limitation: "Local SQLite excludes Cloudflare D1 network, queue, and regional latency; use this as a repeatable code-path baseline, not a production latency claim.",
  results,
};

console.log(JSON.stringify(report, null, 2));
