import {
  collectSiteEvidence,
  extractDirectoryCandidates,
  fetchPublicHtml,
  parseDirectoryCandidates,
  type DiscoveryCandidate,
} from "../lib/discovery";
import { deterministicScore } from "../lib/lead-scoring";
import { calculateScore } from "../lib/lead-engine";
import { qualifyEvidence } from "../lib/qualification";

const requestedName = process.argv.slice(2).join(" ").trim() || "Alcon Eyecare Ltd";
const sources = [
  { name: "The Vision Council Member Companies", url: "https://thevisioncouncil.org/member-companies", parserKey: "vision_council_members" },
  { name: "100% Optical Exhibitor List", url: "https://www.100percentoptical.com/exhibitor-list", parserKey: "exhibitor_cards" },
];

let sourcePage: Awaited<ReturnType<typeof fetchPublicHtml>> | null = null;
let source = sources[0];
let candidates: DiscoveryCandidate[] = [];
for (const option of sources) {
  const page = await fetchPublicHtml(option.url);
  const parsed = parseDirectoryCandidates(option.parserKey, page.html, page.url, 20);
  if (!parsed.length) continue;
  source = option;
  sourcePage = page;
  candidates = parsed;
  break;
}
if (!sourcePage || !candidates.length) throw new Error("official_sources_returned_no_company_candidates");
let candidate = candidates.find((item) => item.label.toLocaleLowerCase().includes(requestedName.toLocaleLowerCase())) || candidates[0];
if (!candidate.websiteUrl && candidate.directoryDetailUrl) {
  const detail = await fetchPublicHtml(candidate.directoryDetailUrl);
  const website = extractDirectoryCandidates(detail.html, detail.url, 1)[0];
  if (website) candidate = { ...candidate, websiteUrl: website.websiteUrl, normalizedDomain: website.normalizedDomain };
}

try {
  const evidence = await collectSiteEvidence(candidate);
  const score = calculateScore(deterministicScore(evidence));
  const qualification = qualifyEvidence({
    evidence, score: score.total, evidenceCoverage: score.evidenceCoverage,
    officialWebsiteVerified: true, sourceIsOfficial: true,
  });
  process.stdout.write(`${JSON.stringify({
    controlledAt: new Date().toISOString(),
    source: { name: source.name, url: sourcePage.url, parsedCandidates: candidates.length },
    candidate: {
      companyName: evidence.companyName,
      normalizedDomain: candidate.normalizedDomain,
      directoryCategory: candidate.directoryCategory,
      pagesVerified: evidence.pages.map((page) => ({ url: page.url, title: page.title })),
      publicBusinessContactEvidence: evidence.contacts.map((contact) => ({
        type: contact.type, sourceUrl: contact.sourceUrl, sameCompanyDomain: contact.sameCompanyDomain,
        trustedOfficialSource: contact.trustedOfficialSource, businessUse: contact.businessUse, status: contact.status,
      })),
      customerType: qualification.customerType,
      companyRole: qualification.companyRole,
      productDirections: qualification.productDirections,
      score: score.total,
      evidenceCoverage: score.evidenceCoverage,
      qualified: qualification.qualified,
      reasons: qualification.reasons,
      failures: qualification.failures,
    },
    safety: { contactedCompany: false, sentEmail: false, wroteProductionCrm: false, paidProviderUsed: false },
  }, null, 2)}\n`);
} catch (error) {
  process.stdout.write(`${JSON.stringify({
    controlledAt: new Date().toISOString(),
    source: { name: source.name, url: sourcePage.url, parsedCandidates: candidates.length },
    candidate: { companyName: candidate.label, normalizedDomain: candidate.normalizedDomain },
    websiteVerificationError: error instanceof Error ? error.message : "unknown_error",
    safety: { contactedCompany: false, sentEmail: false, wroteProductionCrm: false, paidProviderUsed: false },
  }, null, 2)}\n`);
  process.exitCode = 2;
}
