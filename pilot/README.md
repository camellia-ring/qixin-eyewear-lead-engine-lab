# UK optical-frames pilot (25 companies)

This directory contains the first real-company validation pack for the isolated Lead Engine.

- Scope: UK eyewear brands, distributors, wholesalers, and optical chains.
- Evidence: official company pages, plus one UK company-registry source where needed.
- Safety: company-level public business information only; no personal contacts, paid enrichment, outreach, or production CRM access.
- Review state: owner approved the isolated upload on 2026-08-13; the import completed successfully in the private Lead Engine.
- Verified import result: 25 Campaign Leads, 26 Sources, 50 Claims, 25 score runs, and 175 score dimensions.
- Verified gates: 21 `needs_review`, 4 rejected with audited decisions, 0 approved, and 0 exported.

Open `REVIEW.md` for the compact owner decision sheet. It links every company to its primary official source and records that approval covered only upload to the isolated lab, not Lead approval, CRM export, enrichment, or outreach.

Regenerate the derived JSON after editing the reviewed source list:

```bash
node scripts/build-pilot-pack.mjs
```

Then run the full validation suite:

```bash
npm run check
```
