# QIXIN Eyewear Lead Engine Lab

An isolated experiment for researching and reviewing B2B eyewear prospects before they enter the production QIXIN CRM.

## V1 boundary

- Independent repository, Sites deployment, and D1 database
- Campaigns for optical lenses or safety/protective lenses
- Reviewed CSV intake only; no automatic discovery or crawling
- Company, contact, source-evidence, score-breakdown, and review records
- Human approval gate before CRM-compatible CSV export
- No production CRM credential or write path
- No email generation or sending

## Workflow

1. Create a 20–30 company campaign.
2. Research companies outside the lab and retain source URLs.
3. Import the reviewed CSV template.
4. Inspect hard exclusions, evidence, contacts, and the eight score dimensions.
5. Approve, reject, or return each candidate for more research.
6. Download only approved records as a CRM-compatible CSV, then review again in the production CRM import screen.

## Development

Requires Node.js 22.13 or newer.

```bash
npm install
npm run dev
npm run check
```

Generate a migration after changing `db/schema.ts`:

```bash
npm run db:generate -- --name <migration-name>
```

The project intentionally has no `wrangler.jsonc`; Sites injects the real independent D1 binding from `.openai/hosting.json`.
