# QIXIN Eyewear Lead Engine Lab

Private, isolated V1 for turning small-batch eyewear company research into evidence-backed Campaign Leads before any record can leave the lab for the production QIXIN CRM.

## Safety boundary

- Independent private repository, Sites deployment, and D1 database.
- No production QIXIN D1/R2 or CRM credential.
- No automatic search, crawling, contact enrichment, email generation, or sending.
- Only a human-approved Campaign Lead can appear in a CRM-compatible export.
- Exporting creates an audit record but never means the customer has entered CRM; production CRM import is a second manual gate.

## V1 workflow

1. Create a Campaign with country, market, product, customer type, target count, MOQ, company size, positioning, exclusions, and lifecycle status.
2. Download the generated multilingual search keywords and Codex research brief.
3. Research 20–30 companies outside the lab using public or authorized evidence.
4. Import a reviewed CSV or JSON package. File content hashes provide idempotency.
5. Resolve one objective Company into one or more Campaign Leads; the same Company may belong to multiple Campaigns.
6. Inspect source URLs, retrieved time, evidence claims (`observed`, `inferred`, `unknown`), confidence, hard gate, and versioned score dimensions.
7. Approve, reject, or return the Lead for review. Rejections require a reason; approvals require a passed hard gate, score ≥60, evidence coverage ≥40%, non-low confidence, complete score reasons, and a business contact route.
8. Export only approved Leads to the production CRM CSV contract, then confirm the import again inside the production CRM.

## Data model

- `campaigns`
- `prospect_companies`, `company_domains`, `company_domain_links`
- `campaign_leads`, `prospect_contacts`
- `lead_sources`, `evidence_claims`
- `lead_score_runs`, `lead_score_dimensions`
- `lead_import_runs`, `lead_review_decisions`
- `crm_export_runs`, `crm_export_items`

The original V0 tables remain read-only legacy structures so the normalization migration is non-destructive. Legacy approvals are deliberately downgraded and must be re-approved using the `qixin-v1.1` rubric.

## Score rubric: `qixin-v1.1`

| Dimension | Maximum |
| --- | ---: |
| Product Match | 25 |
| Customer / Channel Type | 20 |
| Purchasing / Wholesale Signals | 15 |
| Market, MOQ, and Operating Fit | 15 |
| Contactability | 10 |
| Account Potential | 10 |
| Data Freshness / Completeness | 5 |

Grades: S ≥85 with high confidence, A ≥75, B ≥60, C <60, Reject when the hard gate fails. Evidence coverage and confidence remain separate from the total score.

## Local validation

Requires Node.js 22.13 or newer.

```bash
npm install
npm run check
```

After changing `db/schema.ts`, generate and inspect a migration:

```bash
npm run db:generate -- --name <migration-name>
```

The project intentionally has no `wrangler.jsonc`; Sites injects the independent D1 binding declared in `.openai/hosting.json`.
