import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("keeps the 25-company public pilot evidence-first and behind human review", async () => {
  const pack = JSON.parse(await readFile(new URL("../pilot/uk-optical-frames-pilot-25.review.json", import.meta.url), "utf8"));
  assert.equal(pack.metadata.recordCount, 25);
  assert.equal(pack.metadata.reviewStatus, "owner_approved_uploaded");
  assert.equal(pack.metadata.uploadedAt, "2026-08-13T02:00:01.391Z");
  assert.equal(pack.records.length, 25);
  assert.equal(new Set(pack.records.map((record) => record.companyName)).size, 25);
  assert.equal(pack.records.filter((record) => record.hardGateStatus === "needs_review").length, 21);
  assert.equal(pack.records.filter((record) => record.hardGateStatus === "fail").length, 4);
  assert.equal(pack.records.filter((record) => record.hardGateStatus === "pass").length, 0);

  const scorePrefixes = ["productMatch", "customerType", "purchasingSignals", "marketMoqFit", "contactability", "accountPotential", "dataQuality"];
  for (const record of pack.records) {
    assert.equal(record.productTrack, "optical_frames");
    assert.ok(record.sources.length >= 1);
    assert.ok(record.claims.some((claim) => claim.evidenceKind === "observed"));
    assert.ok(record.claims.some((claim) => claim.evidenceKind === "inferred"));
    assert.ok(record.hardGateReason);
    assert.equal(record.contactName, undefined);
    assert.equal(record.contactEmail, undefined);
    for (const prefix of scorePrefixes) {
      assert.ok(Number.isFinite(record[`${prefix}Score`]));
      assert.ok(record[`${prefix}PositiveReason`]);
      assert.ok(record[`${prefix}NegativeReason`]);
    }
  }
});
