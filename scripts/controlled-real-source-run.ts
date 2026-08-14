import { collectSiteEvidence, deterministicScore, fetchPublicHtml, extractVisionCouncilCandidates } from "../lib/discovery";
import { calculateScore } from "../lib/lead-engine";
import { qualifyEvidence } from "../lib/qualification";

const sourceUrl = "https://thevisioncouncil.org/member-companies";
const requestedName = process.argv.slice(2).join(" ").trim() || "Armada Optical";

const sourcePage = await fetchPublicHtml(sourceUrl);
const candidates = extractVisionCouncilCandidates(sourcePage.html, sourcePage.url, 20);
const candidate = candidates.find((item) => item.label.toLocaleLowerCase().includes(requestedName.toLocaleLowerCase())) || candidates[0];
if (!candidate) throw new Error("official_source_returned_no_company_candidates");

try {
  const evidence = await collectSiteEvidence(candidate);
  const score = calculateScore(deterministicScore(evidence));
  const qualification = qualifyEvidence({
    evidence, score: score.total, evidenceCoverage: score.evidenceCoverage,
    officialWebsiteVerified: true, sourceIsOfficial: true,
  });
  process.stdout.write(`${JSON.stringify({
    controlledAt: new Date().toISOString(),
    source: { name: "The Vision Council Member Companies", url: sourcePage.url, parsedCandidates: candidates.length },
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
    source: { name: "The Vision Council Member Companies", url: sourcePage.url, parsedCandidates: candidates.length },
    candidate: { companyName: candidate.label, normalizedDomain: candidate.normalizedDomain },
    websiteVerificationError: error instanceof Error ? error.message : "unknown_error",
    safety: { contactedCompany: false, sentEmail: false, wroteProductionCrm: false, paidProviderUsed: false },
  }, null, 2)}\n`);
  process.exitCode = 2;
}
