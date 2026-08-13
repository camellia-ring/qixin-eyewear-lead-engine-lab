# Lead Engine lab rules

- This repository is an isolated experiment. Never read from or write to the production QIXIN D1/R2 bindings.
- Candidate companies remain in the lab until a human explicitly approves them and downloads a CRM-compatible export.
- Phase 1 may automatically read only owner-approved public directory pages and a bounded set of public company-website pages. Every run must be rate-limited, auditable, deduplicated, and leave new leads in `needs_review`.
- Do not add broad web search, personal-contact enrichment, guessed emails, email generation, email sending, automatic approval, or production CRM writes.
- Never invent company facts, contacts, scores, evidence, product claims, or business results. Missing values stay missing.
- Every score must remain decomposable into visible dimensions and grounded source evidence.
- Do not import files from the parent `E:\aQiXin` workspace. Users must deliberately upload reviewed CSV data through the lab UI.
- Keep the deployment private and the D1 database independent. Do not add a production CRM write credential.
