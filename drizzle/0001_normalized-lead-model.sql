CREATE TABLE `campaign_leads` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`company_id` text NOT NULL,
	`import_run_id` text,
	`qualification_result` text DEFAULT 'unknown' NOT NULL,
	`workflow_status` text DEFAULT 'discovered' NOT NULL,
	`product_track` text NOT NULL,
	`recommended_products_json` text DEFAULT '[]' NOT NULL,
	`risk_summary` text,
	`hard_gate_status` text DEFAULT 'needs_review' NOT NULL,
	`hard_gate_reason` text,
	`current_score` integer DEFAULT 0 NOT NULL,
	`grade` text DEFAULT 'C' NOT NULL,
	`evidence_coverage` integer DEFAULT 0 NOT NULL,
	`score_confidence` text DEFAULT 'low' NOT NULL,
	`reviewed_by` text,
	`reviewed_at` text,
	`exported_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`company_id`) REFERENCES `prospect_companies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`import_run_id`) REFERENCES `lead_import_runs`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "campaign_lead_score_check" CHECK("campaign_leads"."current_score" BETWEEN 0 AND 100),
	CONSTRAINT "campaign_lead_coverage_check" CHECK("campaign_leads"."evidence_coverage" BETWEEN 0 AND 100),
	CONSTRAINT "campaign_lead_status_check" CHECK("campaign_leads"."workflow_status" IN ('discovered','analyzed','qualified','needs_review','approved','rejected')),
	CONSTRAINT "campaign_lead_qualification_check" CHECK("campaign_leads"."qualification_result" IN ('qualified','near_match','rejected','unknown')),
	CONSTRAINT "campaign_lead_hard_gate_check" CHECK("campaign_leads"."hard_gate_status" IN ('pass','fail','needs_review')),
	CONSTRAINT "campaign_lead_confidence_check" CHECK("campaign_leads"."score_confidence" IN ('low','medium','high')),
	CONSTRAINT "campaign_lead_products_json_check" CHECK(json_valid("campaign_leads"."recommended_products_json"))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_campaign_lead_company` ON `campaign_leads` (`campaign_id`,`company_id`);--> statement-breakpoint
CREATE INDEX `idx_campaign_leads_status` ON `campaign_leads` (`campaign_id`,`workflow_status`);--> statement-breakpoint
CREATE INDEX `idx_campaign_leads_score` ON `campaign_leads` (`campaign_id`,`current_score`);--> statement-breakpoint
CREATE TABLE `company_domain_links` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`domain_id` text NOT NULL,
	`relationship_type` text DEFAULT 'primary' NOT NULL,
	`is_primary` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `prospect_companies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`domain_id`) REFERENCES `company_domains`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "company_domain_relationship_check" CHECK("company_domain_links"."relationship_type" IN ('primary','brand','country_site','shared','other'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_company_domain_link` ON `company_domain_links` (`company_id`,`domain_id`);--> statement-breakpoint
CREATE INDEX `idx_company_domain_links_domain` ON `company_domain_links` (`domain_id`);--> statement-breakpoint
CREATE TABLE `company_domains` (
	`id` text PRIMARY KEY NOT NULL,
	`normalized_domain` text NOT NULL,
	`registrable_domain` text NOT NULL,
	`observed_url` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_company_domain_normalized` ON `company_domains` (`normalized_domain`);--> statement-breakpoint
CREATE TABLE `crm_export_items` (
	`id` text PRIMARY KEY NOT NULL,
	`export_run_id` text NOT NULL,
	`lead_id` text NOT NULL,
	FOREIGN KEY (`export_run_id`) REFERENCES `crm_export_runs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`lead_id`) REFERENCES `campaign_leads`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_crm_export_item` ON `crm_export_items` (`export_run_id`,`lead_id`);--> statement-breakpoint
CREATE INDEX `idx_crm_export_items_lead` ON `crm_export_items` (`lead_id`);--> statement-breakpoint
CREATE TABLE `crm_export_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`row_count` integer NOT NULL,
	`exported_by` text DEFAULT 'private_owner' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "crm_export_row_count_check" CHECK("crm_export_runs"."row_count" >= 0)
);
--> statement-breakpoint
CREATE INDEX `idx_crm_export_campaign_created` ON `crm_export_runs` (`campaign_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `evidence_claims` (
	`id` text PRIMARY KEY NOT NULL,
	`source_id` text NOT NULL,
	`company_id` text NOT NULL,
	`lead_id` text,
	`claim_type` text NOT NULL,
	`claim_summary` text NOT NULL,
	`evidence_kind` text DEFAULT 'unknown' NOT NULL,
	`confidence` text DEFAULT 'medium' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`source_id`) REFERENCES `lead_sources`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`company_id`) REFERENCES `prospect_companies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`lead_id`) REFERENCES `campaign_leads`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "evidence_claim_kind_check" CHECK("evidence_claims"."evidence_kind" IN ('observed','inferred','unknown')),
	CONSTRAINT "evidence_claim_confidence_check" CHECK("evidence_claims"."confidence" IN ('low','medium','high'))
);
--> statement-breakpoint
CREATE INDEX `idx_evidence_claims_lead` ON `evidence_claims` (`lead_id`);--> statement-breakpoint
CREATE INDEX `idx_evidence_claims_source` ON `evidence_claims` (`source_id`);--> statement-breakpoint
CREATE TABLE `lead_import_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`source` text DEFAULT 'reviewed_upload' NOT NULL,
	`original_filename` text,
	`idempotency_key` text NOT NULL,
	`row_count` integer DEFAULT 0 NOT NULL,
	`imported_count` integer DEFAULT 0 NOT NULL,
	`skipped_count` integer DEFAULT 0 NOT NULL,
	`errors_json` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_by` text DEFAULT 'private_owner' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`completed_at` text,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "lead_import_counts_check" CHECK("lead_import_runs"."row_count" >= 0 AND "lead_import_runs"."imported_count" >= 0 AND "lead_import_runs"."skipped_count" >= 0),
	CONSTRAINT "lead_import_errors_json_check" CHECK(json_valid("lead_import_runs"."errors_json")),
	CONSTRAINT "lead_import_status_check" CHECK("lead_import_runs"."status" IN ('pending','completed','failed'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_lead_import_campaign_key` ON `lead_import_runs` (`campaign_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `idx_lead_import_campaign_created` ON `lead_import_runs` (`campaign_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `lead_review_decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`lead_id` text NOT NULL,
	`decision` text NOT NULL,
	`notes` text,
	`decided_by` text DEFAULT 'private_owner' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`lead_id`) REFERENCES `campaign_leads`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "lead_review_decision_check" CHECK("lead_review_decisions"."decision" IN ('needs_review','approved','rejected'))
);
--> statement-breakpoint
CREATE INDEX `idx_lead_reviews_created` ON `lead_review_decisions` (`lead_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `lead_score_dimensions` (
	`id` text PRIMARY KEY NOT NULL,
	`score_run_id` text NOT NULL,
	`dimension` text NOT NULL,
	`score` integer NOT NULL,
	`max_score` integer NOT NULL,
	`positive_reason` text,
	`negative_reason` text,
	`evidence_ids_json` text DEFAULT '[]' NOT NULL,
	FOREIGN KEY (`score_run_id`) REFERENCES `lead_score_runs`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "score_dimension_score_check" CHECK("lead_score_dimensions"."score" >= 0 AND "lead_score_dimensions"."score" <= "lead_score_dimensions"."max_score"),
	CONSTRAINT "score_dimension_evidence_json_check" CHECK(json_valid("lead_score_dimensions"."evidence_ids_json"))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_score_dimension_run` ON `lead_score_dimensions` (`score_run_id`,`dimension`);--> statement-breakpoint
CREATE TABLE `lead_score_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`lead_id` text NOT NULL,
	`rubric_version` text NOT NULL,
	`total_score` integer NOT NULL,
	`grade` text NOT NULL,
	`evidence_coverage` integer NOT NULL,
	`overall_confidence` text NOT NULL,
	`model_identifier` text DEFAULT 'human_structured_import' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`lead_id`) REFERENCES `campaign_leads`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "score_run_total_check" CHECK("lead_score_runs"."total_score" BETWEEN 0 AND 100),
	CONSTRAINT "score_run_coverage_check" CHECK("lead_score_runs"."evidence_coverage" BETWEEN 0 AND 100),
	CONSTRAINT "score_run_confidence_check" CHECK("lead_score_runs"."overall_confidence" IN ('low','medium','high'))
);
--> statement-breakpoint
CREATE INDEX `idx_score_runs_lead_created` ON `lead_score_runs` (`lead_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `lead_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`lead_id` text,
	`source_url` text NOT NULL,
	`canonical_url` text NOT NULL,
	`source_type` text DEFAULT 'company_website' NOT NULL,
	`page_title` text,
	`retrieved_at` text NOT NULL,
	`evidence_summary` text,
	`content_hash` text,
	`confidence` text DEFAULT 'medium' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `prospect_companies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`lead_id`) REFERENCES `campaign_leads`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "lead_source_confidence_check" CHECK("lead_sources"."confidence" IN ('low','medium','high'))
);
--> statement-breakpoint
CREATE INDEX `idx_lead_sources_company` ON `lead_sources` (`company_id`);--> statement-breakpoint
CREATE INDEX `idx_lead_sources_lead` ON `lead_sources` (`lead_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_lead_source_canonical` ON `lead_sources` (`lead_id`,`canonical_url`);--> statement-breakpoint
CREATE TABLE `prospect_companies` (
	`id` text PRIMARY KEY NOT NULL,
	`company_name` text NOT NULL,
	`identity_key` text NOT NULL,
	`country` text,
	`city` text,
	`company_type` text,
	`business_model` text,
	`website` text,
	`primary_domain` text,
	`products_json` text DEFAULT '[]' NOT NULL,
	`brands_json` text DEFAULT '[]' NOT NULL,
	`wholesale_signal` text,
	`private_label_signal` text,
	`oem_signal` text,
	`price_position` text,
	`company_size` text,
	`analysis_summary` text,
	`analysis_confidence` text DEFAULT 'low' NOT NULL,
	`business_email` text,
	`contact_channel` text,
	`estimated_purchase_volume` text,
	`do_not_contact` integer DEFAULT false NOT NULL,
	`last_analyzed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "prospect_products_json_check" CHECK(json_valid("prospect_companies"."products_json")),
	CONSTRAINT "prospect_brands_json_check" CHECK(json_valid("prospect_companies"."brands_json")),
	CONSTRAINT "prospect_confidence_check" CHECK("prospect_companies"."analysis_confidence" IN ('low','medium','high'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_prospect_company_identity` ON `prospect_companies` (`identity_key`);--> statement-breakpoint
CREATE INDEX `idx_prospect_company_domain` ON `prospect_companies` (`primary_domain`);--> statement-breakpoint
CREATE INDEX `idx_prospect_company_country_type` ON `prospect_companies` (`country`,`company_type`);--> statement-breakpoint
CREATE TABLE `prospect_contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`full_name` text NOT NULL,
	`job_title` text,
	`email` text,
	`whatsapp` text,
	`verification_status` text DEFAULT 'unverified' NOT NULL,
	`source_url` text,
	`is_primary` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `prospect_companies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_prospect_contacts_company` ON `prospect_contacts` (`company_id`);--> statement-breakpoint
CREATE INDEX `idx_prospect_contacts_email` ON `prospect_contacts` (`email`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_campaigns` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`product_track` text NOT NULL,
	`target_countries_json` text DEFAULT '[]' NOT NULL,
	`target_markets` text DEFAULT '' NOT NULL,
	`product_types_json` text DEFAULT '[]' NOT NULL,
	`customer_types_json` text DEFAULT '[]' NOT NULL,
	`target_count` integer DEFAULT 30 NOT NULL,
	`moq_fit` text,
	`company_size` text,
	`positioning` text,
	`exclusions_json` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "campaigns_target_count_check" CHECK("__new_campaigns"."target_count" BETWEEN 1 AND 500),
	CONSTRAINT "campaigns_status_check" CHECK("__new_campaigns"."status" IN ('draft','active','paused','completed')),
	CONSTRAINT "campaigns_target_countries_json_check" CHECK(json_valid("__new_campaigns"."target_countries_json")),
	CONSTRAINT "campaigns_product_types_json_check" CHECK(json_valid("__new_campaigns"."product_types_json")),
	CONSTRAINT "campaigns_customer_types_json_check" CHECK(json_valid("__new_campaigns"."customer_types_json")),
	CONSTRAINT "campaigns_exclusions_json_check" CHECK(json_valid("__new_campaigns"."exclusions_json"))
);
--> statement-breakpoint
INSERT INTO `__new_campaigns`("id", "name", "product_track", "target_countries_json", "target_markets", "product_types_json", "customer_types_json", "target_count", "moq_fit", "company_size", "positioning", "exclusions_json", "status", "created_at", "updated_at")
SELECT
	"id",
	"name",
	"product_track",
	'[]',
	"target_markets",
	CASE WHEN "product_track" = 'safety_lenses' THEN '["Protective eyewear","Optical lenses"]' ELSE '["Optical lenses"]' END,
	'["Importer","Distributor","Wholesaler","Eyewear Brand","Private Label Brand"]',
	"target_count",
	NULL,
	NULL,
	NULL,
	'["普通单体零售店","医院或眼科诊所","新闻网站或行业协会","与眼镜无关的公司","中国供应商或直接竞争工厂","已拒绝、退订或禁止联系"]',
	"status",
	"created_at",
	"updated_at"
FROM `campaigns`;--> statement-breakpoint
DROP TABLE `campaigns`;--> statement-breakpoint
ALTER TABLE `__new_campaigns` RENAME TO `campaigns`;--> statement-breakpoint
INSERT OR IGNORE INTO `prospect_companies` (
	`id`, `company_name`, `identity_key`, `country`, `company_type`, `website`, `primary_domain`,
	`products_json`, `analysis_summary`, `analysis_confidence`, `business_email`, `contact_channel`,
	`estimated_purchase_volume`, `do_not_contact`, `last_analyzed_at`, `created_at`, `updated_at`
)
SELECT
	`id`, `company_name`, `identity_key`, `country`, `customer_type`, `website`, `website_normalized`,
	CASE WHEN `product_interests` = '' THEN '[]' ELSE json_array(`product_interests`) END,
	`evidence_summary`, 'low', `business_email`, `contact_channel`, `estimated_purchase_volume`,
	`do_not_contact`, `last_verified_at`, `created_at`, `updated_at`
FROM `candidate_companies`
ORDER BY `created_at`;--> statement-breakpoint
INSERT OR IGNORE INTO `company_domains` (`id`, `normalized_domain`, `registrable_domain`, `observed_url`, `created_at`)
SELECT 'legacy-domain-' || lower(hex(randomblob(16))), `website_normalized`, `website_normalized`, `website`, MIN(`created_at`)
FROM `candidate_companies`
WHERE `website_normalized` IS NOT NULL AND `website_normalized` != '' AND `website` IS NOT NULL
GROUP BY `website_normalized`;--> statement-breakpoint
INSERT OR IGNORE INTO `company_domain_links` (`id`, `company_id`, `domain_id`, `relationship_type`, `is_primary`, `created_at`)
SELECT 'legacy-link-' || lower(hex(randomblob(16))), p.`id`, d.`id`, 'primary', 1, MIN(c.`created_at`)
FROM `candidate_companies` c
JOIN `prospect_companies` p ON p.`identity_key` = c.`identity_key`
JOIN `company_domains` d ON d.`normalized_domain` = c.`website_normalized`
GROUP BY p.`id`, d.`id`;--> statement-breakpoint
INSERT OR IGNORE INTO `campaign_leads` (
	`id`, `campaign_id`, `company_id`, `qualification_result`, `workflow_status`, `product_track`,
	`recommended_products_json`, `risk_summary`, `hard_gate_status`, `hard_gate_reason`, `current_score`,
	`grade`, `evidence_coverage`, `score_confidence`, `reviewed_at`, `created_at`, `updated_at`
)
SELECT
	'legacy-lead-' || c.`id`, c.`campaign_id`, p.`id`,
	CASE WHEN c.`disqualification_reason` IS NOT NULL OR c.`do_not_contact` = 1 THEN 'rejected' WHEN c.`total_score` >= 60 THEN 'qualified' ELSE 'near_match' END,
	CASE WHEN c.`review_status` = 'rejected' OR c.`disqualification_reason` IS NOT NULL OR c.`do_not_contact` = 1 THEN 'rejected' ELSE 'needs_review' END,
	c.`product_track`, CASE WHEN c.`product_interests` = '' THEN '[]' ELSE json_array(c.`product_interests`) END,
	NULL, CASE WHEN c.`disqualification_reason` IS NOT NULL OR c.`do_not_contact` = 1 THEN 'fail' ELSE 'needs_review' END,
	c.`disqualification_reason`, c.`total_score`, c.`grade`, CASE WHEN c.`source_url` IS NOT NULL THEN 30 ELSE 0 END,
	'low', c.`reviewed_at`, c.`created_at`, c.`updated_at`
FROM `candidate_companies` c
JOIN `prospect_companies` p ON p.`identity_key` = c.`identity_key`;--> statement-breakpoint
INSERT OR IGNORE INTO `prospect_contacts` (
	`id`, `company_id`, `full_name`, `job_title`, `email`, `whatsapp`, `verification_status`, `source_url`, `is_primary`, `created_at`, `updated_at`
)
SELECT pc.`id`, p.`id`, pc.`full_name`, pc.`job_title`, pc.`email`, pc.`whatsapp`, pc.`verification_status`, pc.`source_url`, pc.`is_primary`, pc.`created_at`, pc.`updated_at`
FROM `candidate_contacts` pc
JOIN `candidate_companies` c ON c.`id` = pc.`company_id`
JOIN `prospect_companies` p ON p.`identity_key` = c.`identity_key`;--> statement-breakpoint
INSERT OR IGNORE INTO `lead_sources` (
	`id`, `company_id`, `lead_id`, `source_url`, `canonical_url`, `source_type`, `page_title`, `retrieved_at`, `evidence_summary`, `confidence`, `created_at`
)
SELECT 'legacy-source-' || c.`id`, p.`id`, l.`id`, c.`source_url`, c.`source_url`, 'company_website', 'Legacy imported source',
	COALESCE(c.`last_verified_at`, c.`created_at`), c.`evidence_summary`, 'low', c.`created_at`
FROM `candidate_companies` c
JOIN `prospect_companies` p ON p.`identity_key` = c.`identity_key`
JOIN `campaign_leads` l ON l.`campaign_id` = c.`campaign_id` AND l.`company_id` = p.`id`
WHERE c.`source_url` IS NOT NULL AND c.`source_url` != '';--> statement-breakpoint
INSERT OR IGNORE INTO `lead_sources` (
	`id`, `company_id`, `lead_id`, `source_url`, `canonical_url`, `source_type`, `page_title`, `retrieved_at`, `evidence_summary`, `confidence`, `created_at`
)
SELECT 'legacy-evidence-' || e.`id`, p.`id`, l.`id`, e.`source_url`, e.`source_url`, e.`evidence_type`, e.`title`, e.`captured_at`, e.`observed_value`, 'low', e.`created_at`
FROM `evidence_items` e
JOIN `candidate_companies` c ON c.`id` = e.`company_id`
JOIN `prospect_companies` p ON p.`identity_key` = c.`identity_key`
JOIN `campaign_leads` l ON l.`campaign_id` = c.`campaign_id` AND l.`company_id` = p.`id`;--> statement-breakpoint
INSERT OR IGNORE INTO `evidence_claims` (
	`id`, `source_id`, `company_id`, `lead_id`, `claim_type`, `claim_summary`, `evidence_kind`, `confidence`, `created_at`
)
SELECT 'legacy-claim-' || e.`id`, s.`id`, p.`id`, l.`id`, e.`evidence_type`, e.`observed_value`, 'unknown', 'low', e.`created_at`
FROM `evidence_items` e
JOIN `candidate_companies` c ON c.`id` = e.`company_id`
JOIN `prospect_companies` p ON p.`identity_key` = c.`identity_key`
JOIN `campaign_leads` l ON l.`campaign_id` = c.`campaign_id` AND l.`company_id` = p.`id`
JOIN `lead_sources` s ON s.`lead_id` = l.`id` AND s.`canonical_url` = e.`source_url`
WHERE e.`observed_value` IS NOT NULL AND e.`observed_value` != '';--> statement-breakpoint
INSERT OR IGNORE INTO `lead_score_runs` (`id`, `lead_id`, `rubric_version`, `total_score`, `grade`, `evidence_coverage`, `overall_confidence`, `model_identifier`, `created_at`)
SELECT 'legacy-score-' || c.`id`, l.`id`, 'legacy-v1', c.`total_score`, c.`grade`, CASE WHEN c.`source_url` IS NOT NULL THEN 30 ELSE 0 END, 'low', 'legacy_migration', c.`created_at`
FROM `candidate_companies` c
JOIN `prospect_companies` p ON p.`identity_key` = c.`identity_key`
JOIN `campaign_leads` l ON l.`campaign_id` = c.`campaign_id` AND l.`company_id` = p.`id`;--> statement-breakpoint
INSERT OR IGNORE INTO `lead_score_dimensions` (`id`, `score_run_id`, `dimension`, `score`, `max_score`, `positive_reason`, `negative_reason`, `evidence_ids_json`)
SELECT 'legacy-dim-customer-' || `id`, 'legacy-score-' || `id`, 'legacyCustomerTypeScore', `customer_type_score`, 20, NULL, 'Legacy score requires v1.1 re-evaluation', '[]' FROM `candidate_companies`;--> statement-breakpoint
INSERT OR IGNORE INTO `lead_score_dimensions` (`id`, `score_run_id`, `dimension`, `score`, `max_score`, `positive_reason`, `negative_reason`, `evidence_ids_json`)
SELECT 'legacy-dim-product-' || `id`, 'legacy-score-' || `id`, 'legacyProductFitScore', `product_fit_score`, 20, NULL, 'Legacy score requires v1.1 re-evaluation', '[]' FROM `candidate_companies`;--> statement-breakpoint
INSERT OR IGNORE INTO `lead_score_dimensions` (`id`, `score_run_id`, `dimension`, `score`, `max_score`, `positive_reason`, `negative_reason`, `evidence_ids_json`)
SELECT 'legacy-dim-market-' || `id`, 'legacy-score-' || `id`, 'legacyMarketPriorityScore', `market_priority_score`, 10, NULL, 'Legacy score requires v1.1 re-evaluation', '[]' FROM `candidate_companies`;--> statement-breakpoint
INSERT OR IGNORE INTO `lead_score_dimensions` (`id`, `score_run_id`, `dimension`, `score`, `max_score`, `positive_reason`, `negative_reason`, `evidence_ids_json`)
SELECT 'legacy-dim-buying-' || `id`, 'legacy-score-' || `id`, 'legacyBuyingSignalScore', `buying_signal_score`, 15, NULL, 'Legacy score requires v1.1 re-evaluation', '[]' FROM `candidate_companies`;--> statement-breakpoint
INSERT OR IGNORE INTO `lead_score_dimensions` (`id`, `score_run_id`, `dimension`, `score`, `max_score`, `positive_reason`, `negative_reason`, `evidence_ids_json`)
SELECT 'legacy-dim-wholesale-' || `id`, 'legacy-score-' || `id`, 'legacyWholesaleOemScore', `wholesale_oem_score`, 10, NULL, 'Legacy score requires v1.1 re-evaluation', '[]' FROM `candidate_companies`;--> statement-breakpoint
INSERT OR IGNORE INTO `lead_score_dimensions` (`id`, `score_run_id`, `dimension`, `score`, `max_score`, `positive_reason`, `negative_reason`, `evidence_ids_json`)
SELECT 'legacy-dim-contact-' || `id`, 'legacy-score-' || `id`, 'legacyContactQualityScore', `contact_quality_score`, 10, NULL, 'Legacy score requires v1.1 re-evaluation', '[]' FROM `candidate_companies`;--> statement-breakpoint
INSERT OR IGNORE INTO `lead_score_dimensions` (`id`, `score_run_id`, `dimension`, `score`, `max_score`, `positive_reason`, `negative_reason`, `evidence_ids_json`)
SELECT 'legacy-dim-evidence-' || `id`, 'legacy-score-' || `id`, 'legacyEvidenceQualityScore', `evidence_quality_score`, 10, NULL, 'Legacy score requires v1.1 re-evaluation', '[]' FROM `candidate_companies`;--> statement-breakpoint
INSERT OR IGNORE INTO `lead_score_dimensions` (`id`, `score_run_id`, `dimension`, `score`, `max_score`, `positive_reason`, `negative_reason`, `evidence_ids_json`)
SELECT 'legacy-dim-recent-' || `id`, 'legacy-score-' || `id`, 'legacyRecentSignalScore', `recent_signal_score`, 5, NULL, 'Legacy score requires v1.1 re-evaluation', '[]' FROM `candidate_companies`;--> statement-breakpoint
INSERT OR IGNORE INTO `lead_review_decisions` (`id`, `lead_id`, `decision`, `notes`, `decided_by`, `created_at`)
SELECT 'legacy-review-' || r.`id`, l.`id`,
	CASE WHEN r.`decision` = 'rejected' THEN 'rejected' ELSE 'needs_review' END,
	CASE WHEN r.`decision` = 'approved' THEN COALESCE(r.`notes` || ' — ', '') || 'Legacy approval requires re-approval under qixin-v1.1.' ELSE r.`notes` END,
	'legacy_migration', r.`created_at`
FROM `review_decisions` r
JOIN `candidate_companies` c ON c.`id` = r.`company_id`
JOIN `prospect_companies` p ON p.`identity_key` = c.`identity_key`
JOIN `campaign_leads` l ON l.`campaign_id` = c.`campaign_id` AND l.`company_id` = p.`id`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_campaigns_status` ON `campaigns` (`status`);
