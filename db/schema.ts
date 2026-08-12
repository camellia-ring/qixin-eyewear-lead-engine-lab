import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const campaigns = sqliteTable("campaigns", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  productTrack: text("product_track").notNull(),
  targetCountriesJson: text("target_countries_json").notNull().default("[]"),
  targetMarkets: text("target_markets").notNull().default(""),
  productTypesJson: text("product_types_json").notNull().default("[]"),
  customerTypesJson: text("customer_types_json").notNull().default("[]"),
  targetCount: integer("target_count").notNull().default(30),
  moqFit: text("moq_fit"),
  companySize: text("company_size"),
  positioning: text("positioning"),
  exclusionsJson: text("exclusions_json").notNull().default("[]"),
  status: text("status").notNull().default("draft"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_campaigns_status").on(table.status),
  check("campaigns_target_count_check", sql`${table.targetCount} BETWEEN 1 AND 500`),
  check("campaigns_status_check", sql`${table.status} IN ('draft','active','paused','completed')`),
  check("campaigns_target_countries_json_check", sql`json_valid(${table.targetCountriesJson})`),
  check("campaigns_product_types_json_check", sql`json_valid(${table.productTypesJson})`),
  check("campaigns_customer_types_json_check", sql`json_valid(${table.customerTypesJson})`),
  check("campaigns_exclusions_json_check", sql`json_valid(${table.exclusionsJson})`),
]);

export const leadImportRuns = sqliteTable("lead_import_runs", {
  id: text("id").primaryKey(),
  campaignId: text("campaign_id").notNull().references(() => campaigns.id, { onDelete: "cascade" }),
  source: text("source").notNull().default("reviewed_upload"),
  originalFilename: text("original_filename"),
  idempotencyKey: text("idempotency_key").notNull(),
  rowCount: integer("row_count").notNull().default(0),
  importedCount: integer("imported_count").notNull().default(0),
  skippedCount: integer("skipped_count").notNull().default(0),
  errorsJson: text("errors_json").notNull().default("[]"),
  status: text("status").notNull().default("pending"),
  createdBy: text("created_by").notNull().default("private_owner"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  completedAt: text("completed_at"),
}, (table) => [
  uniqueIndex("uq_lead_import_campaign_key").on(table.campaignId, table.idempotencyKey),
  index("idx_lead_import_campaign_created").on(table.campaignId, table.createdAt),
  check("lead_import_counts_check", sql`${table.rowCount} >= 0 AND ${table.importedCount} >= 0 AND ${table.skippedCount} >= 0`),
  check("lead_import_errors_json_check", sql`json_valid(${table.errorsJson})`),
  check("lead_import_status_check", sql`${table.status} IN ('pending','completed','failed')`),
]);

export const prospectCompanies = sqliteTable("prospect_companies", {
  id: text("id").primaryKey(),
  companyName: text("company_name").notNull(),
  identityKey: text("identity_key").notNull(),
  country: text("country"),
  city: text("city"),
  companyType: text("company_type"),
  businessModel: text("business_model"),
  website: text("website"),
  primaryDomain: text("primary_domain"),
  productsJson: text("products_json").notNull().default("[]"),
  brandsJson: text("brands_json").notNull().default("[]"),
  wholesaleSignal: text("wholesale_signal"),
  privateLabelSignal: text("private_label_signal"),
  oemSignal: text("oem_signal"),
  pricePosition: text("price_position"),
  companySize: text("company_size"),
  analysisSummary: text("analysis_summary"),
  analysisConfidence: text("analysis_confidence").notNull().default("low"),
  businessEmail: text("business_email"),
  contactChannel: text("contact_channel"),
  estimatedPurchaseVolume: text("estimated_purchase_volume"),
  doNotContact: integer("do_not_contact", { mode: "boolean" }).notNull().default(false),
  lastAnalyzedAt: text("last_analyzed_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("uq_prospect_company_identity").on(table.identityKey),
  index("idx_prospect_company_domain").on(table.primaryDomain),
  index("idx_prospect_company_country_type").on(table.country, table.companyType),
  check("prospect_products_json_check", sql`json_valid(${table.productsJson})`),
  check("prospect_brands_json_check", sql`json_valid(${table.brandsJson})`),
  check("prospect_confidence_check", sql`${table.analysisConfidence} IN ('low','medium','high')`),
]);

export const companyDomains = sqliteTable("company_domains", {
  id: text("id").primaryKey(),
  normalizedDomain: text("normalized_domain").notNull(),
  registrableDomain: text("registrable_domain").notNull(),
  observedUrl: text("observed_url").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("uq_company_domain_normalized").on(table.normalizedDomain),
]);

export const companyDomainLinks = sqliteTable("company_domain_links", {
  id: text("id").primaryKey(),
  companyId: text("company_id").notNull().references(() => prospectCompanies.id, { onDelete: "cascade" }),
  domainId: text("domain_id").notNull().references(() => companyDomains.id, { onDelete: "cascade" }),
  relationshipType: text("relationship_type").notNull().default("primary"),
  isPrimary: integer("is_primary", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("uq_company_domain_link").on(table.companyId, table.domainId),
  index("idx_company_domain_links_domain").on(table.domainId),
  check("company_domain_relationship_check", sql`${table.relationshipType} IN ('primary','brand','country_site','shared','other')`),
]);

export const campaignLeads = sqliteTable("campaign_leads", {
  id: text("id").primaryKey(),
  campaignId: text("campaign_id").notNull().references(() => campaigns.id, { onDelete: "cascade" }),
  companyId: text("company_id").notNull().references(() => prospectCompanies.id, { onDelete: "cascade" }),
  importRunId: text("import_run_id").references(() => leadImportRuns.id, { onDelete: "set null" }),
  qualificationResult: text("qualification_result").notNull().default("unknown"),
  workflowStatus: text("workflow_status").notNull().default("discovered"),
  productTrack: text("product_track").notNull(),
  recommendedProductsJson: text("recommended_products_json").notNull().default("[]"),
  riskSummary: text("risk_summary"),
  hardGateStatus: text("hard_gate_status").notNull().default("needs_review"),
  hardGateReason: text("hard_gate_reason"),
  currentScore: integer("current_score").notNull().default(0),
  grade: text("grade").notNull().default("C"),
  evidenceCoverage: integer("evidence_coverage").notNull().default(0),
  scoreConfidence: text("score_confidence").notNull().default("low"),
  reviewedBy: text("reviewed_by"),
  reviewedAt: text("reviewed_at"),
  exportedAt: text("exported_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("uq_campaign_lead_company").on(table.campaignId, table.companyId),
  index("idx_campaign_leads_status").on(table.campaignId, table.workflowStatus),
  index("idx_campaign_leads_score").on(table.campaignId, table.currentScore),
  check("campaign_lead_score_check", sql`${table.currentScore} BETWEEN 0 AND 100`),
  check("campaign_lead_coverage_check", sql`${table.evidenceCoverage} BETWEEN 0 AND 100`),
  check("campaign_lead_status_check", sql`${table.workflowStatus} IN ('discovered','analyzed','qualified','needs_review','approved','rejected')`),
  check("campaign_lead_qualification_check", sql`${table.qualificationResult} IN ('qualified','near_match','rejected','unknown')`),
  check("campaign_lead_hard_gate_check", sql`${table.hardGateStatus} IN ('pass','fail','needs_review')`),
  check("campaign_lead_confidence_check", sql`${table.scoreConfidence} IN ('low','medium','high')`),
  check("campaign_lead_products_json_check", sql`json_valid(${table.recommendedProductsJson})`),
]);

export const prospectContacts = sqliteTable("prospect_contacts", {
  id: text("id").primaryKey(),
  companyId: text("company_id").notNull().references(() => prospectCompanies.id, { onDelete: "cascade" }),
  fullName: text("full_name").notNull(),
  jobTitle: text("job_title"),
  email: text("email"),
  whatsapp: text("whatsapp"),
  verificationStatus: text("verification_status").notNull().default("unverified"),
  sourceUrl: text("source_url"),
  isPrimary: integer("is_primary", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_prospect_contacts_company").on(table.companyId),
  index("idx_prospect_contacts_email").on(table.email),
]);

export const leadSources = sqliteTable("lead_sources", {
  id: text("id").primaryKey(),
  companyId: text("company_id").notNull().references(() => prospectCompanies.id, { onDelete: "cascade" }),
  leadId: text("lead_id").references(() => campaignLeads.id, { onDelete: "cascade" }),
  sourceUrl: text("source_url").notNull(),
  canonicalUrl: text("canonical_url").notNull(),
  sourceType: text("source_type").notNull().default("company_website"),
  pageTitle: text("page_title"),
  retrievedAt: text("retrieved_at").notNull(),
  evidenceSummary: text("evidence_summary"),
  contentHash: text("content_hash"),
  confidence: text("confidence").notNull().default("medium"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_lead_sources_company").on(table.companyId),
  index("idx_lead_sources_lead").on(table.leadId),
  uniqueIndex("uq_lead_source_canonical").on(table.leadId, table.canonicalUrl),
  check("lead_source_confidence_check", sql`${table.confidence} IN ('low','medium','high')`),
]);

export const evidenceClaims = sqliteTable("evidence_claims", {
  id: text("id").primaryKey(),
  sourceId: text("source_id").notNull().references(() => leadSources.id, { onDelete: "cascade" }),
  companyId: text("company_id").notNull().references(() => prospectCompanies.id, { onDelete: "cascade" }),
  leadId: text("lead_id").references(() => campaignLeads.id, { onDelete: "cascade" }),
  claimType: text("claim_type").notNull(),
  claimSummary: text("claim_summary").notNull(),
  evidenceKind: text("evidence_kind").notNull().default("unknown"),
  confidence: text("confidence").notNull().default("medium"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_evidence_claims_lead").on(table.leadId),
  index("idx_evidence_claims_source").on(table.sourceId),
  check("evidence_claim_kind_check", sql`${table.evidenceKind} IN ('observed','inferred','unknown')`),
  check("evidence_claim_confidence_check", sql`${table.confidence} IN ('low','medium','high')`),
]);

export const leadScoreRuns = sqliteTable("lead_score_runs", {
  id: text("id").primaryKey(),
  leadId: text("lead_id").notNull().references(() => campaignLeads.id, { onDelete: "cascade" }),
  rubricVersion: text("rubric_version").notNull(),
  totalScore: integer("total_score").notNull(),
  grade: text("grade").notNull(),
  evidenceCoverage: integer("evidence_coverage").notNull(),
  overallConfidence: text("overall_confidence").notNull(),
  modelIdentifier: text("model_identifier").notNull().default("human_structured_import"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_score_runs_lead_created").on(table.leadId, table.createdAt),
  check("score_run_total_check", sql`${table.totalScore} BETWEEN 0 AND 100`),
  check("score_run_coverage_check", sql`${table.evidenceCoverage} BETWEEN 0 AND 100`),
  check("score_run_confidence_check", sql`${table.overallConfidence} IN ('low','medium','high')`),
]);

export const leadScoreDimensions = sqliteTable("lead_score_dimensions", {
  id: text("id").primaryKey(),
  scoreRunId: text("score_run_id").notNull().references(() => leadScoreRuns.id, { onDelete: "cascade" }),
  dimension: text("dimension").notNull(),
  score: integer("score").notNull(),
  maxScore: integer("max_score").notNull(),
  positiveReason: text("positive_reason"),
  negativeReason: text("negative_reason"),
  evidenceIdsJson: text("evidence_ids_json").notNull().default("[]"),
}, (table) => [
  uniqueIndex("uq_score_dimension_run").on(table.scoreRunId, table.dimension),
  check("score_dimension_score_check", sql`${table.score} >= 0 AND ${table.score} <= ${table.maxScore}`),
  check("score_dimension_evidence_json_check", sql`json_valid(${table.evidenceIdsJson})`),
]);

export const leadReviewDecisions = sqliteTable("lead_review_decisions", {
  id: text("id").primaryKey(),
  leadId: text("lead_id").notNull().references(() => campaignLeads.id, { onDelete: "cascade" }),
  decision: text("decision").notNull(),
  notes: text("notes"),
  decidedBy: text("decided_by").notNull().default("private_owner"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_lead_reviews_created").on(table.leadId, table.createdAt),
  check("lead_review_decision_check", sql`${table.decision} IN ('needs_review','approved','rejected')`),
]);

export const crmExportRuns = sqliteTable("crm_export_runs", {
  id: text("id").primaryKey(),
  campaignId: text("campaign_id").notNull().references(() => campaigns.id, { onDelete: "cascade" }),
  rowCount: integer("row_count").notNull(),
  exportedBy: text("exported_by").notNull().default("private_owner"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_crm_export_campaign_created").on(table.campaignId, table.createdAt),
  check("crm_export_row_count_check", sql`${table.rowCount} >= 0`),
]);

export const crmExportItems = sqliteTable("crm_export_items", {
  id: text("id").primaryKey(),
  exportRunId: text("export_run_id").notNull().references(() => crmExportRuns.id, { onDelete: "cascade" }),
  leadId: text("lead_id").notNull().references(() => campaignLeads.id, { onDelete: "cascade" }),
}, (table) => [
  uniqueIndex("uq_crm_export_item").on(table.exportRunId, table.leadId),
  index("idx_crm_export_items_lead").on(table.leadId),
]);

// V0 tables are retained only so the normalization migration is non-destructive.
// Application code must use prospectCompanies + campaignLeads and the v1.1 audit tables above.
export const legacyCandidateCompanies = sqliteTable("candidate_companies", {
  id: text("id").primaryKey(),
  campaignId: text("campaign_id").notNull().references(() => campaigns.id, { onDelete: "cascade" }),
  companyName: text("company_name").notNull(),
  identityKey: text("identity_key").notNull(),
  website: text("website"),
  websiteNormalized: text("website_normalized"),
  country: text("country"),
  customerType: text("customer_type"),
  productTrack: text("product_track").notNull(),
  productInterests: text("product_interests").notNull().default(""),
  estimatedPurchaseVolume: text("estimated_purchase_volume"),
  businessEmail: text("business_email"),
  contactChannel: text("contact_channel"),
  sourceUrl: text("source_url"),
  evidenceSummary: text("evidence_summary"),
  customerTypeScore: integer("customer_type_score").notNull().default(0),
  productFitScore: integer("product_fit_score").notNull().default(0),
  marketPriorityScore: integer("market_priority_score").notNull().default(0),
  buyingSignalScore: integer("buying_signal_score").notNull().default(0),
  wholesaleOemScore: integer("wholesale_oem_score").notNull().default(0),
  contactQualityScore: integer("contact_quality_score").notNull().default(0),
  evidenceQualityScore: integer("evidence_quality_score").notNull().default(0),
  recentSignalScore: integer("recent_signal_score").notNull().default(0),
  totalScore: integer("total_score").notNull().default(0),
  grade: text("grade").notNull().default("C"),
  reviewStatus: text("review_status").notNull().default("new"),
  disqualificationReason: text("disqualification_reason"),
  doNotContact: integer("do_not_contact", { mode: "boolean" }).notNull().default(false),
  lastVerifiedAt: text("last_verified_at"),
  reviewedAt: text("reviewed_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("uq_candidate_campaign_identity").on(table.campaignId, table.identityKey),
  index("idx_candidate_campaign_status").on(table.campaignId, table.reviewStatus),
  index("idx_candidate_campaign_score").on(table.campaignId, table.totalScore),
  index("idx_candidate_website").on(table.websiteNormalized),
]);

export const legacyCandidateContacts = sqliteTable("candidate_contacts", {
  id: text("id").primaryKey(),
  companyId: text("company_id").notNull().references(() => legacyCandidateCompanies.id, { onDelete: "cascade" }),
  fullName: text("full_name").notNull(),
  jobTitle: text("job_title"),
  email: text("email"),
  whatsapp: text("whatsapp"),
  verificationStatus: text("verification_status").notNull().default("unverified"),
  sourceUrl: text("source_url"),
  isPrimary: integer("is_primary", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_candidate_contacts_company").on(table.companyId)]);

export const legacyEvidenceItems = sqliteTable("evidence_items", {
  id: text("id").primaryKey(),
  companyId: text("company_id").notNull().references(() => legacyCandidateCompanies.id, { onDelete: "cascade" }),
  evidenceType: text("evidence_type").notNull().default("company_source"),
  title: text("title").notNull(),
  sourceUrl: text("source_url").notNull(),
  observedValue: text("observed_value"),
  capturedAt: text("captured_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_evidence_company").on(table.companyId)]);

export const legacyReviewDecisions = sqliteTable("review_decisions", {
  id: text("id").primaryKey(),
  companyId: text("company_id").notNull().references(() => legacyCandidateCompanies.id, { onDelete: "cascade" }),
  decision: text("decision").notNull(),
  notes: text("notes"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_reviews_company_created").on(table.companyId, table.createdAt)]);
