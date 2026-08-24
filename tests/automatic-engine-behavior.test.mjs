import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { createDiscoveryProvider } from "../lib/discovery-provider.ts";
import {
  extractExhibitorCardCandidates,
  extractMidoMapCandidates,
  extractTextExhibitorHints,
  extractVisionCouncilCandidates,
  parseDynamicDirectoryPayload,
  robotsAllows,
} from "../lib/discovery.ts";
import { chooseNextSource, dateInTimezone, mergeDailyCounts, sourceRepeatsDuringDay } from "../lib/engine-policy.ts";
import {
  AdaptiveConcurrencyController,
  classifyConcurrencyError,
  ContiguousProgress,
  DISCOVERY_RUNTIME_CONFIG,
  KeyedSerialExecutor,
  runAdaptivePool,
} from "../lib/discovery-runtime.ts";
import { approvalPolicyGaps, qualifyEvidence } from "../lib/qualification.ts";
import { deterministicScore } from "../lib/lead-scoring.ts";
import { importedLeadPendingVerification, isCurrentServerVerification } from "../lib/import-policy.ts";
import { buildSearchKeywords } from "../lib/lead-engine.ts";
import { campaignMatchesCompany, normalizeCountry, routeCampaigns } from "../lib/campaign-routing.ts";
import { campaignStrategyName } from "../lib/campaign-strategy.ts";

function evidence(overrides = {}) {
  return {
    companyName: "Northstar Optical Distribution",
    country: "United States",
    companyType: "Eyewear Distributor",
    businessEmail: "sales@northstar-optical.com",
    contactChannel: "contact_page: https://northstar-optical.com/contact",
    eyewearTerms: ["eyewear", "optical lens", "progressive lens"],
    b2bTerms: ["wholesale", "distributor", "trade account"],
    productTerms: ["optical lens", "progressive lens"],
    contacts: [{
      type: "email", value: "sales@northstar-optical.com", sourceUrl: "https://northstar-optical.com/contact",
      sourceTitle: "Contact", sameCompanyDomain: true, trustedOfficialSource: false,
      businessUse: true, status: "valid",
    }],
    pages: [{
      url: "https://northstar-optical.com", title: "Northstar Optical Distribution", html: "<html></html>",
      text: "Wholesale distributor of ophthalmic optical lenses for trade accounts, including progressive lens products.",
    }],
    ...overrides,
  };
}

test("only a verified target company with public business contact passes the automatic gate", () => {
  const result = qualifyEvidence({
    evidence: evidence(), score: 66, evidenceCoverage: 70,
    officialWebsiteVerified: true, sourceIsOfficial: true,
  });
  assert.equal(result.qualified, true);
  assert.equal(result.hardGateStatus, "pass");
  assert.equal(result.customerType, "批发商");
  assert.deepEqual(result.customerTypes, ["批发商", "分销商"]);
  assert.equal(result.validContact.type, "email");
});

test("duplicates, missing contacts, non-targets and search-only hints never qualify", () => {
  const base = { score: 66, evidenceCoverage: 70, officialWebsiteVerified: true, sourceIsOfficial: true };
  assert.equal(qualifyEvidence({ evidence: evidence(), ...base, duplicate: true }).qualified, false);
  assert.equal(qualifyEvidence({ evidence: evidence({ contacts: [], businessEmail: "", contactChannel: "" }), ...base }).qualified, false);
  assert.equal(qualifyEvidence({ evidence: evidence({ b2bTerms: [], companyType: "Eyewear media", pages: [{ url: "https://media.example.org", title: "News", html: "", text: "Eyewear news magazine" }] }), ...base }).qualified, false);
  assert.equal(qualifyEvidence({ evidence: evidence(), ...base, searchResultOnly: true }).qualified, false);
});

function evidenceFromText(text, overrides = {}) {
  return evidence({
    companyName: "Test Company",
    companyType: "",
    eyewearTerms: ["eyewear"],
    b2bTerms: [],
    productTerms: [],
    pages: [{ url: "https://northstar-optical.com/about", title: "Company", html: "", text }],
    ...overrides,
  });
}

function qualifyText(text, overrides = {}) {
  return qualifyEvidence({
    evidence: evidenceFromText(text, overrides),
    score: 72,
    evidenceCoverage: 70,
    officialWebsiteVerified: true,
    sourceIsOfficial: true,
  });
}

test("broad eyewear buyers qualify by independent B2B role and product evidence", () => {
  const cases = [
    ["We are a distributor of optical frames for independent opticians.", "分销商", "光学镜架"],
    ["Wholesale supplier of spectacle cases and eyewear pouches to optical stores.", "批发商", "眼镜盒/袋"],
    ["Importer of nose pads and optical frame components for trade customers.", "进口商", "鼻托"],
    ["Eyewear accessories distributor serving optical practices nationwide.", "分销商", "其他非电子眼镜配件"],
    ["Our eyewear brand sources our optical frames from an OEM factory through our procurement team.", "眼镜或配件品牌商", "光学镜架"],
    ["Optical retail chain with centralized purchasing for sunglasses across 80 stores.", "连锁零售集中采购方", "太阳镜"],
  ];
  for (const [text, role, product] of cases) {
    const result = qualifyText(text);
    assert.equal(result.qualified, true, text);
    assert.ok(result.customerTypes.includes(role), `${text} -> ${role}`);
    assert.ok(result.productDirections.includes(product), `${text} -> ${product}`);
  }
});

test("mixed conventional and smart eyewear keeps independently evidenced allowed business", () => {
  const result = qualifyText("We distribute optical frames to trade accounts. A separate innovation division also develops smart glasses.");
  assert.equal(result.qualified, true);
  assert.ok(result.productDirections.includes("光学镜架"));
  assert.ok(result.prohibitedProducts.includes("AI/智能眼镜"));
  assert.match(result.reasons.join(" "), /禁止产品不计分/);
});

test("the 55 percent evidence threshold is shared by qualification semantics", () => {
  const input = { evidence: evidenceFromText("Wholesale distributor of optical frames for trade accounts."), score: 72, officialWebsiteVerified: true, sourceIsOfficial: true };
  assert.equal(qualifyEvidence({ ...input, evidenceCoverage: 54 }).qualified, false);
  assert.equal(qualifyEvidence({ ...input, evidenceCoverage: 55 }).qualified, true);
});

test("external pass and scores remain audit input until current server verification", () => {
  const imported = importedLeadPendingVerification({
    hardGateStatus: "pass",
    score: 99,
    evidenceCoverage: 100,
    hardGateReason: "forged pass",
  });
  assert.equal(imported.workflowStatus, "needs_review");
  assert.equal(imported.hardGateStatus, "needs_review");
  assert.equal(imported.currentScore, 0);
  assert.equal(imported.evidenceCoverage, 0);
  assert.equal(isCurrentServerVerification({ rubricVersion: "qixin-v1.2-external-input", modelIdentifier: "external_input:forged" }), false);
  assert.equal(isCurrentServerVerification({ rubricVersion: "qixin-v1.2", modelIdentifier: "deterministic_public_rules_v3_reverification" }), true);

  const base = {
    campaignAssigned: true,
    hardGateStatus: "pass",
    score: 60,
    scoreConfidence: "medium",
    doNotContact: false,
    sourceCount: 1,
    contactPresent: true,
    scoreDimensionCount: 7,
    expectedScoreDimensionCount: 7,
    serverVerified: true,
  };
  assert.ok(approvalPolicyGaps({ ...base, evidenceCoverage: 54 }).some((gap) => gap.includes("55%")));
  assert.equal(approvalPolicyGaps({ ...base, evidenceCoverage: 55 }).length, 0);
});

test("prohibited specialists and excluded organizations never pass", () => {
  const cases = [
    "Wholesale contact lenses specialist for opticians.",
    "Distributor dedicated exclusively to AI glasses and AR glasses.",
    "Manufacturer factory of optical frames with OEM production only.",
    "Single optical store serving individual consumers with optical frames.",
    "Optometry clinic and hospital selling reading glasses to patients only.",
    "Marketplace and contact database listing eyewear wholesalers.",
  ];
  for (const text of cases) assert.equal(qualifyText(text).qualified, false, text);
  assert.equal(qualifyText("Manufacturer and distributor of optical frames from our factory.", { country: "China" }).qualified, false);
});

test("missing contact, search-only evidence and duplicates remain hard failures", () => {
  const text = "Wholesale distributor of optical frames for trade accounts.";
  const noContact = evidenceFromText(text, { contacts: [], businessEmail: "", contactChannel: "" });
  const base = { score: 72, evidenceCoverage: 70, officialWebsiteVerified: true, sourceIsOfficial: true };
  assert.equal(qualifyEvidence({ evidence: noContact, ...base }).qualified, false);
  assert.equal(qualifyEvidence({ evidence: evidenceFromText(text), ...base, searchResultOnly: true }).qualified, false);
  assert.equal(qualifyEvidence({ evidence: evidenceFromText(text), ...base, duplicate: true }).qualified, false);
});

test("multilingual role and product synonyms classify without English-only counting", () => {
  const cases = [
    ["Großhändler für Brillenfassungen und Fachoptiker.", "批发商", "光学镜架"],
    ["Importador de plaquetas nasales y monturas ópticas para clientes profesionales.", "进口商", "鼻托"],
    ["Dystrybutor futerałów na okulary dla salonów optycznych.", "分销商", "眼镜盒/袋"],
  ];
  for (const [text, role, product] of cases) {
    const result = qualifyText(text);
    assert.ok(result.customerTypes.includes(role), text);
    assert.ok(result.productDirections.includes(product), text);
  }
});

test("negation and navigation or blog noise do not create false classifications", () => {
  const negated = qualifyText("We are not a manufacturer. We distribute optical frames to trade accounts.");
  assert.equal(negated.qualified, true);
  const noisyPage = evidenceFromText("Navigation: smart glasses. Blog: contact lenses. Main business: wholesale optical frames for trade accounts.", {
    pages: [{
      url: "https://northstar-optical.com/about", title: "About", html: "", text: "Navigation: smart glasses. Blog: contact lenses. Main business: wholesale optical frames for trade accounts.",
      classificationText: "Main business: wholesale optical frames for trade accounts.",
    }],
  });
  const result = qualifyEvidence({ evidence: noisyPage, score: 72, evidenceCoverage: 70, officialWebsiteVerified: true, sourceIsOfficial: true });
  assert.equal(result.qualified, true);
  assert.deepEqual(result.prohibitedProducts, []);
});

test("qixin-v1.2 scoring rewards evidence strength and never guesses MOQ", () => {
  const strong = evidenceFromText("Wholesale distributor with a trade account and centralized purchasing for optical frames across locations nationwide.", {
    country: "Germany",
    pages: [
      { url: "https://northstar-optical.com/about", title: "About", html: "", text: "Wholesale distributor of optical frames across locations nationwide." },
      { url: "https://northstar-optical.com/trade", title: "Trade", html: "", text: "Trade account and centralized purchasing for optical frames." },
      { url: "https://northstar-optical.com/contact", title: "Contact", html: "", text: "Business contact for wholesale customers." },
    ],
  });
  const score = deterministicScore(strong);
  assert.ok(score.productMatchScore >= 20);
  assert.ok(score.customerTypeScore >= 17);
  assert.ok(score.evidenceCoverage >= 55);
  assert.match(score.reasons.marketMoqFitScore[1], /MOQ.*未知|未对未披露/);
  for (const reasons of Object.values(score.reasons)) assert.ok(reasons[0] || reasons[1]);
});

test("daily counters count qualified companies independently from duplicates and failures", () => {
  const current = { rawDiscoveredCount: 10, parsedCount: 8, websiteVerifiedCount: 6, validContactCount: 4, duplicateCount: 1, mandatoryGateFailedCount: 2, qualifiedCount: 3, failedCount: 1 };
  const merged = mergeDailyCounts(current, { rawDiscovered: 5, parsed: 5, websiteVerified: 4, validContact: 2, duplicate: 2, mandatoryFailed: 1, qualified: 1, failed: 1 });
  assert.deepEqual(merged, { rawDiscoveredCount: 15, parsedCount: 13, websiteVerifiedCount: 10, validContactCount: 6, duplicateCount: 3, mandatoryGateFailedCount: 3, qualifiedCount: 4, failedCount: 2 });
});

test("continuous discovery uses a 20-candidate batch and scales stable company work from 3 to 5", async () => {
  assert.equal(DISCOVERY_RUNTIME_CONFIG.batchCandidates, 20);
  assert.equal(DISCOVERY_RUNTIME_CONFIG.initialConcurrency, 3);
  assert.equal(DISCOVERY_RUNTIME_CONFIG.maxConcurrency, 5);
  const result = await runAdaptivePool(Array.from({ length: 20 }, (_, index) => index), async () => {
    await new Promise((resolve) => setTimeout(resolve, 2));
    return "success";
  }, { classifyResult: (outcome) => outcome });
  assert.equal(result.results.length, 20);
  assert.equal(result.results.every((item) => item.status === "fulfilled"), true);
  assert.equal(result.initialConcurrency, 3);
  assert.equal(result.finalConcurrency, 5);
  assert.equal(result.maxObservedConcurrency, 5);
  assert.deepEqual(result.concurrencyHistory, [3, 4, 5]);
});

test("adaptive concurrency immediately backs off on throttling and timeouts", () => {
  assert.equal(classifyConcurrencyError(new Error("页面返回 HTTP 403")), "throttled");
  assert.equal(classifyConcurrencyError(new Error("页面返回 HTTP 429")), "throttled");
  assert.equal(classifyConcurrencyError(new Error("request timed out")), "timeout");
  const throttled = new AdaptiveConcurrencyController();
  for (let index = 0; index < 8; index += 1) throttled.record("success");
  assert.equal(throttled.current, 5);
  throttled.record("throttled");
  assert.equal(throttled.current, 1);

  const timedOut = new AdaptiveConcurrencyController();
  for (let index = 0; index < 8; index += 1) timedOut.record("success");
  timedOut.record("timeout");
  assert.equal(timedOut.current, 2);

  const elevatedErrors = new AdaptiveConcurrencyController();
  for (let index = 0; index < 8; index += 1) elevatedErrors.record("success");
  elevatedErrors.record("error");
  assert.equal(elevatedErrors.current, 5);
  elevatedErrors.record("error");
  assert.equal(elevatedErrors.current, 2);
  elevatedErrors.record("error");
  assert.equal(elevatedErrors.current, 1);
});

test("candidate failures are isolated and do not cancel the rest of the adaptive pool", async () => {
  const result = await runAdaptivePool(Array.from({ length: 20 }, (_, index) => index), async (index) => {
    if (index === 4) throw new Error("页面返回 HTTP 429");
    if (index === 11) throw new Error("request timeout");
    return index;
  });
  assert.equal(result.results.filter((item) => item.status === "rejected").length, 2);
  assert.equal(result.results.filter((item) => item.status === "fulfilled").length, 18);
});

test("same-company work is serialized and cursor checkpoints only advance contiguously", async () => {
  const serial = new KeyedSerialExecutor();
  let active = 0;
  let peak = 0;
  await Promise.all(Array.from({ length: 4 }, () => serial.run("domain:example.com", async () => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 2));
    active -= 1;
  })));
  assert.equal(peak, 1);

  const progress = new ContiguousProgress(10);
  assert.equal(progress.complete(2), 10);
  assert.equal(progress.complete(0), 11);
  assert.equal(progress.complete(1), 13);
});

test("Asia/Shanghai date boundary and source fallback are deterministic", () => {
  assert.equal(dateInTimezone(new Date("2026-08-13T16:30:00.000Z"), "Asia/Shanghai"), "2026-08-14");
  const sources = [{ id: "a" }, { id: "b" }, { id: "c" }];
  assert.equal(chooseNextSource(sources, ["a"]).id, "b");
  assert.equal(chooseNextSource(sources, ["a", "b", "c"]), null);
});

test("accessories research terms cover component buyers and local-language discovery", () => {
  const terms = buildSearchKeywords({
    productTrack: "eyewear_accessories",
    productTracksJson: '["eyewear_accessories"]',
    targetCountriesJson: '["Germany"]',
    productTypesJson: '["Eyewear accessories"]',
    customerTypesJson: '["批发商","分销商","进口商"]',
  });
  const keywords = terms.map((item) => item.keyword).join("\n");
  for (const phrase of ["eyewear accessories", "spectacle cases", "nose pads", "eyewear components", "private label eyewear buyer", "private label eyewear brand", "Brillenzubehör"]) {
    assert.match(keywords, new RegExp(phrase, "i"));
  }
});

test("global discovery routes by verified country, customer type and product evidence", () => {
  const campaigns = [
    { id: "usa-lenses", name: "USA lenses", productTrack: "optical_lenses", targetCountriesJson: '["United States"]', targetMarkets: "", productTypesJson: '["optical lenses"]', customerTypesJson: '["光学镜片批发商"]', status: "active" },
    { id: "poland-lenses", name: "Poland lenses", productTrack: "optical_lenses", targetCountriesJson: '["Poland"]', targetMarkets: "", productTypesJson: '["optical lenses"]', customerTypesJson: '["光学镜片批发商"]', status: "active" },
  ];
  const routed = routeCampaigns(campaigns, evidence(), "光学镜片批发商", ["普通光学镜片"]);
  assert.deepEqual(routed.map((campaign) => campaign.id), ["usa-lenses"]);
  assert.equal(routeCampaigns(campaigns, evidence({ country: "" }), "光学镜片批发商", ["普通光学镜片"]).length, 0);
  assert.equal(routeCampaigns(campaigns, evidence({ eyewearTerms: ["optical frame"], productTerms: ["optical frame"] }), "眼镜分销商", ["其他相关眼镜产品"]).length, 0);
  assert.equal(normalizeCountry("USA"), "united states");
});

test("one verified company may route to multiple matching active campaigns", () => {
  const campaigns = ["usa-core", "usa-progressive"].map((id) => ({
    id, name: id, productTrack: "optical_lenses", targetCountriesJson: '["USA"]', targetMarkets: "",
    productTypesJson: '["progressive lens"]', customerTypesJson: '["Wholesaler"]', status: "active",
  }));
  assert.deepEqual(routeCampaigns(campaigns, evidence(), "光学镜片批发商", ["渐进镜片"]).map((campaign) => campaign.id), ["usa-core", "usa-progressive"]);
});

test("Campaign names use only the selected region and countries", () => {
  assert.equal(campaignStrategyName("global"), "全球");
  assert.equal(campaignStrategyName("north_america", ["United States"]), "北美 · United States");
  assert.equal(campaignStrategyName("custom", ["Poland", "Mexico"]), "Poland / Mexico");
  assert.doesNotMatch(campaignStrategyName("middle_east", ["United Arab Emirates"]), /镜片|眼镜|渠道/);
});

test("multi-product companies appear in every matching regional Campaign and use priority for the primary order", () => {
  const base = {
    targetCountriesJson: '["United Arab Emirates"]', targetMarkets: "中东",
    customerTypesJson: '["Eyewear distributor"]', status: "active", regionKey: "middle_east",
  };
  const campaigns = [
    { ...base, id: "uae-sun", name: "中东太阳镜", productTrack: "sunglasses", productTracksJson: '["sunglasses"]', productTypesJson: '["Sunglasses"]', strategyPriority: 100 },
    { ...base, id: "uae-lens", name: "中东镜片", productTrack: "optical_lenses", productTracksJson: '["optical_lenses"]', productTypesJson: '["Optical lenses"]', strategyPriority: 50 },
    { ...base, id: "uae-accessories", name: "中东配件", productTrack: "eyewear_accessories", productTracksJson: '["eyewear_accessories"]', productTypesJson: '["Eyewear accessories"]', strategyPriority: 40 },
  ];
  const uaeEvidence = evidence({
    country: "UAE", companyType: "Eyewear Distributor",
    eyewearTerms: ["sunglasses", "optical lens"], productTerms: ["sunglasses", "progressive lens"],
  });
  assert.deepEqual(
    routeCampaigns(campaigns, uaeEvidence, ["分销商", "进口商"], ["太阳镜", "渐进镜片", "眼镜盒/袋"]).map((campaign) => campaign.id),
    ["uae-sun", "uae-lens", "uae-accessories"],
  );
  const storedCompany = {
    country: "United Arab Emirates", customerType: "眼镜分销商", customerTypesJson: '["眼镜分销商"]',
    productDirectionsJson: '["太阳镜","渐进镜片","眼镜盒/袋"]', productsJson: "[]",
  };
  assert.ok(campaigns.every((campaign) => campaignMatchesCompany(campaign, storedCompany)));
});

test("paid discovery provider is disabled without both explicit approval flag and credentials", async () => {
  const provider = createDiscoveryProvider({ enablePaidProviders: "false", openAiApiKey: "not-used", openAiDiscoveryModel: "not-used" });
  assert.equal(provider.enabled, false);
  assert.equal(await provider.resolveOfficialWebsite({ companyName: "Example", region: "Global", officialDirectoryUrl: "https://example.org" }), null);
});

test("automatic qualification never bypasses the human export gate", async () => {
  const route = await readFile(new URL("../app/api/exports/crm/route.ts", import.meta.url), "utf8");
  assert.match(route, /workflowStatus, "approved"/);
  assert.match(route, /system_campaign_cannot_export/);
  assert.match(route, /crmExportRuns/);
  assert.match(route, /crmExportItems/);
  await assert.rejects(access(new URL("../app/api/exports/leads/route.ts", import.meta.url)), { code: "ENOENT" });
});

test("engine start is global and no longer requires a selected campaign", async () => {
  const [route, stateHook] = await Promise.all([
    readFile(new URL("../app/api/engine/control/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../hooks/useLeadEngineState.ts", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(route, /required: true[^\n]+campaignId/);
  assert.match(route, /startAutomaticEngine\(timezone\)/);
  assert.doesNotMatch(route, /body\.dailyTarget/);
  assert.doesNotMatch(route, /body\.runNow === true/);
  assert.doesNotMatch(stateHook, /runNow:\s*true/);
  assert.match(stateHook, /首批由后台执行/);
});

test("automatic engine runs without a daily quota or target-reached stop branch", async () => {
  const [engine, runner, runtime, workspace, ui] = await Promise.all([
    readFile(new URL("../lib/automatic-engine.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/discovery-runner.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/discovery-runtime.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/workspace/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/lead-engine/AutomaticDiscoveryView.tsx", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(engine, /target_reached|dailyProgress|qualifiedCount\s*>=\s*[^\n]*targetCount/);
  assert.match(engine, /status: "batch_completed"/);
  assert.match(engine, /DISCOVERY_RUNTIME_CONFIG\.batchCandidates/);
  assert.match(engine, /qualifiedCount: sql`\$\{dailyDiscoveryTargets\.qualifiedCount\} \+ \$\{counts\.qualified\}`/);
  assert.match(runner, /runAdaptivePool/);
  assert.match(runner, /checkpointCandidate/);
  assert.match(runtime, /batchCandidates: 20/);
  assert.match(runtime, /initialConcurrency: 3/);
  assert.match(runtime, /maxConcurrency: 5/);
  assert.match(workspace, /dailyLedgers/);
  assert.match(workspace, /alertType !== "daily_target_deficit"/);
  assert.match(workspace, /isLegacyQuotaMessage/);
  assert.match(ui, /今日已完成/);
  assert.doesNotMatch(ui, /今日目标|今日仍缺|每日目标|目标缺口/);
});

test("official discovery sources use a stable global pool instead of a display Campaign", async () => {
  const [routing, registry, engine] = await Promise.all([
    readFile(new URL("../lib/campaign-routing.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/source-registry.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/automatic-engine.ts", import.meta.url), "utf8"),
  ]);
  assert.match(routing, /GLOBAL_DISCOVERY_CAMPAIGN_ID = "system:global-discovery"/);
  assert.match(registry, /campaignId: GLOBAL_DISCOVERY_CAMPAIGN_ID/);
  assert.doesNotMatch(registry, /globalAnchorId/);
  assert.match(engine, /source\.campaignId === GLOBAL_DISCOVERY_CAMPAIGN_ID/);
});

test("Vision Council parser extracts official company website, category and public phone", () => {
  const html = `<table><tr><td><strong>ABB Optical Group</strong><br>Coral Springs, FL</td><td><a href="http://www.abboptical.com">www.abboptical.com</a><br>(800) 852-8089</td><td>Lens, Lab and Lens Processing Technology Division</td></tr></table>`;
  const [candidate] = extractVisionCouncilCandidates(html, "https://thevisioncouncil.org/member-companies", 5);
  assert.equal(candidate.label, "ABB Optical Group");
  assert.equal(candidate.normalizedDomain, "abboptical.com");
  assert.equal(candidate.directoryCategory, "Lens, Lab and Lens Processing Technology Division");
  assert.equal(candidate.officialContacts[0].value, "(800) 852-8089");
  assert.equal(candidate.officialContacts[0].trustedOfficialSource, true);
});

test("directory cursor advances beyond the first batch instead of repeating it", () => {
  const row = (name, domain) => `<tr><td><strong>${name}</strong></td><td><a href="https://${domain}">${domain}</a><br>(800) 555-0100</td><td>Eyewear &amp; Accessories</td></tr>`;
  const html = `<table>${row("First Optical", "first-optical.com")}${row("Second Optical", "second-optical.com")}${row("Third Optical", "third-optical.com")}</table>`;
  const [candidate] = extractVisionCouncilCandidates(html, "https://thevisioncouncil.org/member-companies", 1, 1);
  assert.equal(candidate.label, "Second Optical");
  assert.equal(candidate.normalizedDomain, "second-optical.com");
});

test("official exhibitor cards retain same-domain detail pages for second-hop website resolution", () => {
  const html = `<a class="exhibitor-navigation" href="/register-interest">Register your Interest</a>
    <a class="exhibitor-card" href="/exhibitor/armada-optical">Armada Optical</a>`;
  const [candidate] = extractExhibitorCardCandidates(html, "https://fair.example.org/exhibitors", 5);
  assert.equal(candidate.websiteUrl, "");
  assert.equal(candidate.label, "Armada Optical");
  assert.equal(candidate.directoryDetailUrl, "https://fair.example.org/exhibitor/armada-optical");
});

test("dynamic JSON adapter maps configured nested fields without treating the API as qualification evidence", () => {
  const payload = { data: { exhibitors: [{ company: { name: "Northstar Optical", web: "https://northstar-optical.com" }, profile: "/company/northstar" }] } };
  const [candidate] = parseDynamicDirectoryPayload(payload, "https://fair.example.org/exhibitors", {
    itemsPath: "data.exhibitors", nameField: "company.name", websiteField: "company.web", detailField: "profile",
  });
  assert.equal(candidate.label, "Northstar Optical");
  assert.equal(candidate.normalizedDomain, "northstar-optical.com");
  assert.equal(candidate.directoryDetailUrl, "https://fair.example.org/company/northstar");
});

test("MIDO map parser keeps non-China official websites, trusted generic contacts and cursor order", () => {
  const row = (name, country, website, email = "") => `<div class="map-exhibitor" data-name="${name}" data-country="${country}" data-href="${website}" data-email="${email}" data-categories="Frames"></div>`;
  const html = row("Zeta Eyewear", "IT", "https://zeta-eyewear.com", "sales@zeta-eyewear.com")
    + row("Alpha Optical Distributor", "US", "https://alpha-optical.com", "export@alpha-optical.com")
    + row("Excluded China", "CN", "https://excluded-optical.com", "info@excluded-optical.com");
  const [first] = extractMidoMapCandidates(html, "https://www.mido.com/en/exhibitors-map-2026", 1);
  const all = extractMidoMapCandidates(html, "https://www.mido.com/en/exhibitors-map-2026", 10);
  assert.equal(first.label, "Alpha Optical Distributor");
  assert.equal(first.directoryCountry, "United States");
  assert.equal(first.officialContacts[0].value, "export@alpha-optical.com");
  assert.deepEqual(all.map((candidate) => candidate.normalizedDomain), ["alpha-optical.com", "zeta-eyewear.com"]);
});

test("grouped public directory payloads flatten without changing qualification rules", () => {
  const payload = { A: [{ exhibitor_name_en: "Alpha", link: "/en/exhibitor/alpha" }], B: [{ exhibitor_name_en: "Beta", link: "/en/exhibitor/beta" }] };
  const candidates = parseDynamicDirectoryPayload(payload, "https://neotokyoeyewearshow.com/en/exhibitor/", {
    itemsPath: "", flattenObjectArrays: true, nameField: "exhibitor_name_en", websiteField: "brand_link_source", detailField: "link",
  });
  assert.deepEqual(candidates.map((candidate) => candidate.label), ["Alpha", "Beta"]);
  assert.equal(candidates[0].directoryDetailUrl, "https://neotokyoeyewearshow.com/en/exhibitor/alpha");
});

test("robots longest-match allow rule permits the Neo Tokyo public AJAX endpoint", () => {
  const robots = "User-agent: *\nDisallow: /neotokyo-wp/wp-admin/\nAllow: /neotokyo-wp/wp-admin/admin-ajax.php";
  assert.equal(robotsAllows(robots, "/neotokyo-wp/wp-admin/admin-ajax.php"), true);
  assert.equal(robotsAllows(robots, "/neotokyo-wp/wp-admin/edit.php"), false);
});

test("only explicitly marked large sources may repeat during the same day", () => {
  assert.equal(sourceRepeatsDuringDay({ parserConfigJson: '{"repeatDuringDay":true}' }), true);
  assert.equal(sourceRepeatsDuringDay({ parserConfigJson: '{"repeatDuringDay":false}' }), false);
  assert.equal(sourceRepeatsDuringDay({ parserConfigJson: "not-json" }), false);
});

test("plain-text and PDF-extracted lines use the same unresolved-name cursor", () => {
  const text = "First Optical\nSecond Optical\nThird Optical";
  const [candidate] = extractTextExhibitorHints(text, "https://fair.example.org/exhibitors.pdf", 1, 1);
  assert.equal(candidate.label, "Second Optical");
  assert.match(candidate.normalizedDomain, /^unresolved:/);
});
