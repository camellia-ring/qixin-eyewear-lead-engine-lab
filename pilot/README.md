# UK optical-frames pilot (25 companies)

This directory contains the first real-company validation pack for the isolated Lead Engine.

- Scope: UK eyewear brands, distributors, wholesalers, and optical chains.
- Evidence: official company pages, plus one UK company-registry source where needed.
- Safety: company-level public business information only; no personal contacts, paid enrichment, outreach, or production CRM access.
- Review state: not user-approved. The JSON must be deliberately uploaded through the private Lead Engine UI.
- Expected import result: 25 Campaign Leads, 26 Sources, 50 Claims, 25 score runs, and 175 score dimensions.
- Expected gates: 21 `needs_review`, 4 `fail`, 0 approved, and 0 exportable until the owner reviews the evidence.

Regenerate the derived JSON after editing the reviewed source list:

```bash
node scripts/build-pilot-pack.mjs
```

Then run the full validation suite:

```bash
npm run check
```
