# Lead Engine repository rules

Follow `E:\aQiXin\.agents\skills\aqixin-knowledge\SKILL.md` as well as these repository-specific rules.

- Keep this repository, deployment, and D1 private and independent. Never access the production QIXIN CRM, website D1/R2, add production write credentials, or import parent-workspace files; reviewed CSV data enters only through the lab UI.
- Leads stay in `needs_review` until a human approves them. Human approval is required before CRM export or contact.
- Discovery may use the maintained official-source registry, bounded public website verification, and replaceable search/page-analysis providers. Runs must be rate-limited, auditable, and deduplicated; paid, authenticated, personal-contact, or credit-consuming providers require explicit owner approval.
- Search results are hints only. Daily-target companies must pass official-site verification, target-customer classification, mandatory gates, evidence-backed scoring, deduplication, and public business-contact validation.
- Never invent facts, contacts, scores, evidence, claims, or results. Missing values stay missing, and every score must remain decomposable into visible, source-grounded dimensions.
- Do not add personal-contact enrichment, guessed emails, email generation or sending, automatic human approval, login/paywall bypass, or production CRM writes.

## GitHub synchronization

- The confirmed GitHub source remote is `origin`; `sites` is the Sites source/deployment remote. After validation, commit only task-scoped changes and push the current branch to `origin`. GitHub synchronization alone is not deployment evidence; deployment follows the separately confirmed policy below.

## Sites deployment

- After task-scoped Lead Engine changes pass the necessary checks and the exact commit is pushed to `origin`, save and deploy that commit to the existing private Sites project without requesting per-release approval.
- Before deploying, confirm the worktree and GitHub branch are synchronized, the existing Sites project ID is reused, access remains owner-only, and any migration is forward-only with the required backup evidence. Use the private deployment path and verify the terminal deployment status and live application behavior.
- This standing authorization does not permit creating or replacing the Sites project, changing access, environment variables, D1/R2 bindings, secrets, tunnels, or enabling discovery/outreach. Stop and report any shared/public access, remote divergence, failed validation, unsafe migration, deployment failure, or rollback ambiguity.
