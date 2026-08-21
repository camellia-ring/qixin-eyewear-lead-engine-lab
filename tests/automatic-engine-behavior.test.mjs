import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { createDiscoveryProvider } from "../lib/discovery-provider.ts";
import {
  extractExhibitorCardCandidates,
  extractTextExhibitorHints,
  extractVisionCouncilCandidates,
  parseDynamicDirectoryPayload,
} from "../lib/discovery.ts";
import { chooseNextSource, dailyProgress, dateInTimezone, mergeDailyCounts } from "../lib/engine-policy.ts";
import { qualifyEvidence } from "../lib/qualification.ts";
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
  assert.equal(result.customerType, "光学镜片批发商");
  assert.deepEqual(result.customerTypes, ["光学镜片批发商", "眼镜分销商"]);
  assert.equal(result.validContact.type, "email");
});

test("duplicates, missing contacts, non-targets and search-only hints never qualify", () => {
  const base = { score: 66, evidenceCoverage: 70, officialWebsiteVerified: true, sourceIsOfficial: true };
  assert.equal(qualifyEvidence({ evidence: evidence(), ...base, duplicate: true }).qualified, false);
  assert.equal(qualifyEvidence({ evidence: evidence({ contacts: [], businessEmail: "", contactChannel: "" }), ...base }).qualified, false);
  assert.equal(qualifyEvidence({ evidence: evidence({ b2bTerms: [], companyType: "Eyewear media", pages: [{ url: "https://media.example.org", title: "News", html: "", text: "Eyewear news magazine" }] }), ...base }).qualified, false);
  assert.equal(qualifyEvidence({ evidence: evidence(), ...base, searchResultOnly: true }).qualified, false);
});

test("daily counters count qualified companies independently from duplicates and failures", () => {
  const current = { rawDiscoveredCount: 10, parsedCount: 8, websiteVerifiedCount: 6, validContactCount: 4, duplicateCount: 1, mandatoryGateFailedCount: 2, qualifiedCount: 3, failedCount: 1 };
  const merged = mergeDailyCounts(current, { rawDiscovered: 5, parsed: 5, websiteVerified: 4, validContact: 2, duplicate: 2, mandatoryFailed: 1, qualified: 1, failed: 1 });
  assert.deepEqual(merged, { rawDiscoveredCount: 15, parsedCount: 13, websiteVerifiedCount: 10, validContactCount: 6, duplicateCount: 3, mandatoryGateFailedCount: 3, qualifiedCount: 4, failedCount: 2 });
  assert.deepEqual(dailyProgress(20, merged.qualifiedCount), { target: 20, qualified: 4, remaining: 16, completionRate: 20 });
});

test("Asia/Shanghai date boundary and source fallback are deterministic", () => {
  assert.equal(dateInTimezone(new Date("2026-08-13T16:30:00.000Z"), "Asia/Shanghai"), "2026-08-14");
  const sources = [{ id: "a" }, { id: "b" }, { id: "c" }];
  assert.equal(chooseNextSource(sources, ["a"]).id, "b");
  assert.equal(chooseNextSource(sources, ["a", "b", "c"]), null);
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
  ];
  const uaeEvidence = evidence({
    country: "UAE", companyType: "Eyewear Distributor",
    eyewearTerms: ["sunglasses", "optical lens"], productTerms: ["sunglasses", "progressive lens"],
  });
  assert.deepEqual(
    routeCampaigns(campaigns, uaeEvidence, "眼镜分销商", ["太阳镜", "渐进镜片"]).map((campaign) => campaign.id),
    ["uae-sun", "uae-lens"],
  );
  const storedCompany = {
    country: "United Arab Emirates", customerType: "眼镜分销商", customerTypesJson: '["眼镜分销商"]',
    productDirectionsJson: '["太阳镜","渐进镜片"]', productsJson: "[]",
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
  assert.match(route, /unassigned_leads_cannot_export/);
  assert.match(route, /crmExportRuns/);
  assert.match(route, /crmExportItems/);
  await assert.rejects(access(new URL("../app/api/exports/leads/route.ts", import.meta.url)), { code: "ENOENT" });
});

test("engine start is global and no longer requires a selected campaign", async () => {
  const route = await readFile(new URL("../app/api/engine/control/route.ts", import.meta.url), "utf8");
  assert.doesNotMatch(route, /required: true[^\n]+campaignId/);
  assert.match(route, /startAutomaticEngine\(dailyTarget, timezone\)/);
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

test("plain-text and PDF-extracted lines use the same unresolved-name cursor", () => {
  const text = "First Optical\nSecond Optical\nThird Optical";
  const [candidate] = extractTextExhibitorHints(text, "https://fair.example.org/exhibitors.pdf", 1, 1);
  assert.equal(candidate.label, "Second Optical");
  assert.match(candidate.normalizedDomain, /^unresolved:/);
});
