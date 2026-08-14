# Lead Engine rules

- This repository is the isolated, private Lead Engine. Never read from or write to the production QIXIN CRM, website D1, or website R2 bindings.
- Candidate companies remain in the lab until a human explicitly approves them and downloads a CRM-compatible export.
- Automatic discovery may use the maintained official-source registry, bounded public company-website verification, and replaceable search/page-analysis providers. Every run must be rate-limited, auditable and deduplicated. Paid, authenticated, personal-contact, or credit-consuming providers stay disabled until the owner explicitly approves them.
- Search results are discovery hints only. A company counts toward the daily target only after official company/website verification, target-customer classification, mandatory-gate passage, evidence-backed scoring, deduplication, and validation of a public business contact channel.
- Automatically qualified leads remain in `needs_review`; human approval is still required before CRM export or contact.
- Do not add personal-contact enrichment, guessed emails, email generation, email sending, automatic human approval, login/paywall bypass, or production CRM writes.
- Never invent company facts, contacts, scores, evidence, product claims, or business results. Missing values stay missing.
- Every score must remain decomposable into visible dimensions and grounded source evidence.
- Do not import files from the parent `E:\aQiXin` workspace. Users must deliberately upload reviewed CSV data through the lab UI.
- Keep the deployment private and the D1 database independent. Do not add a production CRM write credential.
