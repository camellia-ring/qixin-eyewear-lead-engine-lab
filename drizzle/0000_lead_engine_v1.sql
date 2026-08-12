CREATE TABLE `campaigns` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`product_track` text NOT NULL,
	`target_markets` text DEFAULT '' NOT NULL,
	`target_count` integer DEFAULT 30 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_campaigns_status` ON `campaigns` (`status`);--> statement-breakpoint
CREATE TABLE `candidate_companies` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`company_name` text NOT NULL,
	`identity_key` text NOT NULL,
	`website` text,
	`website_normalized` text,
	`country` text,
	`customer_type` text,
	`product_track` text NOT NULL,
	`product_interests` text DEFAULT '' NOT NULL,
	`estimated_purchase_volume` text,
	`business_email` text,
	`contact_channel` text,
	`source_url` text,
	`evidence_summary` text,
	`customer_type_score` integer DEFAULT 0 NOT NULL,
	`product_fit_score` integer DEFAULT 0 NOT NULL,
	`market_priority_score` integer DEFAULT 0 NOT NULL,
	`buying_signal_score` integer DEFAULT 0 NOT NULL,
	`wholesale_oem_score` integer DEFAULT 0 NOT NULL,
	`contact_quality_score` integer DEFAULT 0 NOT NULL,
	`evidence_quality_score` integer DEFAULT 0 NOT NULL,
	`recent_signal_score` integer DEFAULT 0 NOT NULL,
	`total_score` integer DEFAULT 0 NOT NULL,
	`grade` text DEFAULT 'C' NOT NULL,
	`review_status` text DEFAULT 'new' NOT NULL,
	`disqualification_reason` text,
	`do_not_contact` integer DEFAULT false NOT NULL,
	`last_verified_at` text,
	`reviewed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_candidate_campaign_identity` ON `candidate_companies` (`campaign_id`,`identity_key`);--> statement-breakpoint
CREATE INDEX `idx_candidate_campaign_status` ON `candidate_companies` (`campaign_id`,`review_status`);--> statement-breakpoint
CREATE INDEX `idx_candidate_campaign_score` ON `candidate_companies` (`campaign_id`,`total_score`);--> statement-breakpoint
CREATE INDEX `idx_candidate_website` ON `candidate_companies` (`website_normalized`);--> statement-breakpoint
CREATE TABLE `candidate_contacts` (
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
	FOREIGN KEY (`company_id`) REFERENCES `candidate_companies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_candidate_contacts_company` ON `candidate_contacts` (`company_id`);--> statement-breakpoint
CREATE TABLE `evidence_items` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`evidence_type` text DEFAULT 'company_source' NOT NULL,
	`title` text NOT NULL,
	`source_url` text NOT NULL,
	`observed_value` text,
	`captured_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `candidate_companies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_evidence_company` ON `evidence_items` (`company_id`);--> statement-breakpoint
CREATE TABLE `review_decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`decision` text NOT NULL,
	`notes` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `candidate_companies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_reviews_company_created` ON `review_decisions` (`company_id`,`created_at`);