import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const campaigns = sqliteTable("campaigns", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  productTrack: text("product_track").notNull(),
  targetMarkets: text("target_markets").notNull().default(""),
  targetCount: integer("target_count").notNull().default(30),
  status: text("status").notNull().default("active"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_campaigns_status").on(table.status),
]);

export const candidateCompanies = sqliteTable("candidate_companies", {
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

export const candidateContacts = sqliteTable("candidate_contacts", {
  id: text("id").primaryKey(),
  companyId: text("company_id").notNull().references(() => candidateCompanies.id, { onDelete: "cascade" }),
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
  index("idx_candidate_contacts_company").on(table.companyId),
]);

export const evidenceItems = sqliteTable("evidence_items", {
  id: text("id").primaryKey(),
  companyId: text("company_id").notNull().references(() => candidateCompanies.id, { onDelete: "cascade" }),
  evidenceType: text("evidence_type").notNull().default("company_source"),
  title: text("title").notNull(),
  sourceUrl: text("source_url").notNull(),
  observedValue: text("observed_value"),
  capturedAt: text("captured_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_evidence_company").on(table.companyId),
]);

export const reviewDecisions = sqliteTable("review_decisions", {
  id: text("id").primaryKey(),
  companyId: text("company_id").notNull().references(() => candidateCompanies.id, { onDelete: "cascade" }),
  decision: text("decision").notNull(),
  notes: text("notes"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_reviews_company_created").on(table.companyId, table.createdAt),
]);
