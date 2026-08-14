-- Forward-only migration for the automatic daily discovery engine.
-- Existing tables are extended in place; no table is rebuilt, renamed, truncated or dropped.

ALTER TABLE `prospect_companies` ADD COLUMN `region` text;--> statement-breakpoint
ALTER TABLE `prospect_companies` ADD COLUMN `customer_type` text;--> statement-breakpoint
ALTER TABLE `prospect_companies` ADD COLUMN `company_role` text;--> statement-breakpoint
ALTER TABLE `prospect_companies` ADD COLUMN `product_directions_json` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `prospect_companies` ADD COLUMN `contact_status` text DEFAULT 'unverified' NOT NULL;--> statement-breakpoint
ALTER TABLE `prospect_companies` ADD COLUMN `source_type` text;--> statement-breakpoint
ALTER TABLE `prospect_companies` ADD COLUMN `source_name` text;--> statement-breakpoint
ALTER TABLE `prospect_companies` ADD COLUMN `is_duplicate` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `prospect_companies` ADD COLUMN `duplicate_of_company_id` text;--> statement-breakpoint
ALTER TABLE `prospect_companies` ADD COLUMN `first_discovered_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `prospect_companies` ADD COLUMN `last_verified_at` text;--> statement-breakpoint
UPDATE `prospect_companies` SET `first_discovered_at` = COALESCE(NULLIF(`created_at`, ''), CURRENT_TIMESTAMP) WHERE `first_discovered_at` = '';--> statement-breakpoint

ALTER TABLE `discovery_sources` ADD COLUMN `source_type` text DEFAULT 'official_directory' NOT NULL;--> statement-breakpoint
ALTER TABLE `discovery_sources` ADD COLUMN `region` text DEFAULT 'global' NOT NULL;--> statement-breakpoint
ALTER TABLE `discovery_sources` ADD COLUMN `tier` text DEFAULT 'A' NOT NULL;--> statement-breakpoint
ALTER TABLE `discovery_sources` ADD COLUMN `enabled` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `discovery_sources` ADD COLUMN `parser_key` text DEFAULT 'generic_links' NOT NULL;--> statement-breakpoint
ALTER TABLE `discovery_sources` ADD COLUMN `parser_version` text DEFAULT '1.0.0' NOT NULL;--> statement-breakpoint
ALTER TABLE `discovery_sources` ADD COLUMN `parser_config_json` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `discovery_sources` ADD COLUMN `priority` integer DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE `discovery_sources` ADD COLUMN `rate_limit_ms` integer DEFAULT 1500 NOT NULL;--> statement-breakpoint
ALTER TABLE `discovery_sources` ADD COLUMN `last_success_at` text;--> statement-breakpoint
ALTER TABLE `discovery_sources` ADD COLUMN `last_discovered_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `discovery_sources` ADD COLUMN `last_qualified_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `discovery_sources` ADD COLUMN `last_duplicate_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `discovery_sources` ADD COLUMN `failure_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `discovery_sources` ADD COLUMN `robots_status` text DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE `discovery_sources` ADD COLUMN `access_notes` text;--> statement-breakpoint
ALTER TABLE `discovery_sources` ADD COLUMN `requires_login` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `discovery_sources` ADD COLUMN `is_paid` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `discovery_sources` ADD COLUMN `last_error` text;--> statement-breakpoint
CREATE INDEX `idx_discovery_source_priority` ON `discovery_sources` (`enabled`,`status`,`tier`,`priority`);--> statement-breakpoint

ALTER TABLE `discovery_runs` ADD COLUMN `target_date` text;--> statement-breakpoint
ALTER TABLE `discovery_runs` ADD COLUMN `raw_discovered_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `discovery_runs` ADD COLUMN `parsed_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `discovery_runs` ADD COLUMN `website_verified_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `discovery_runs` ADD COLUMN `valid_contact_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `discovery_runs` ADD COLUMN `mandatory_gate_failed_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `discovery_runs` ADD COLUMN `qualified_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint

ALTER TABLE `campaign_leads` ADD COLUMN `auto_qualified_at` text;--> statement-breakpoint
ALTER TABLE `campaign_leads` ADD COLUMN `last_verified_at` text;--> statement-breakpoint

CREATE TABLE `engine_state` (
	`id` text PRIMARY KEY DEFAULT 'global' NOT NULL,
	`status` text DEFAULT 'stopped' NOT NULL,
	`timezone` text DEFAULT 'Asia/Shanghai' NOT NULL,
	`daily_target` integer DEFAULT 20 NOT NULL,
	`active_campaign_id` text,
	`started_at` text,
	`paused_at` text,
	`stopped_at` text,
	`last_heartbeat_at` text,
	`last_run_at` text,
	`next_run_at` text,
	`last_error` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`active_campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT `engine_state_status_check` CHECK(`status` IN ('stopped','running','paused')),
	CONSTRAINT `engine_state_daily_target_check` CHECK(`daily_target` BETWEEN 1 AND 200)
);--> statement-breakpoint

CREATE TABLE `daily_discovery_targets` (
	`id` text PRIMARY KEY NOT NULL,
	`target_date` text NOT NULL,
	`timezone` text DEFAULT 'Asia/Shanghai' NOT NULL,
	`target_count` integer DEFAULT 20 NOT NULL,
	`raw_discovered_count` integer DEFAULT 0 NOT NULL,
	`parsed_count` integer DEFAULT 0 NOT NULL,
	`website_verified_count` integer DEFAULT 0 NOT NULL,
	`valid_contact_count` integer DEFAULT 0 NOT NULL,
	`duplicate_count` integer DEFAULT 0 NOT NULL,
	`mandatory_gate_failed_count` integer DEFAULT 0 NOT NULL,
	`qualified_count` integer DEFAULT 0 NOT NULL,
	`failed_count` integer DEFAULT 0 NOT NULL,
	`source_exhausted` integer DEFAULT false NOT NULL,
	`deficit_reason` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT `daily_target_count_check` CHECK(`target_count` BETWEEN 1 AND 200),
	CONSTRAINT `daily_target_funnel_counts_check` CHECK(`raw_discovered_count` >= 0 AND `parsed_count` >= 0 AND `website_verified_count` >= 0 AND `valid_contact_count` >= 0 AND `duplicate_count` >= 0 AND `mandatory_gate_failed_count` >= 0 AND `qualified_count` >= 0 AND `failed_count` >= 0)
);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_daily_target_date_timezone` ON `daily_discovery_targets` (`target_date`,`timezone`);--> statement-breakpoint
CREATE INDEX `idx_daily_target_date` ON `daily_discovery_targets` (`target_date`);--> statement-breakpoint

CREATE TABLE `discovery_run_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`source_id` text NOT NULL,
	`attempt_type` text NOT NULL,
	`request_url` text,
	`status` text DEFAULT 'started' NOT NULL,
	`http_status` integer,
	`duration_ms` integer,
	`robots_status` text,
	`error_code` text,
	`error_message` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`completed_at` text,
	FOREIGN KEY (`run_id`) REFERENCES `discovery_runs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_id`) REFERENCES `discovery_sources`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT `discovery_attempt_status_check` CHECK(`status` IN ('started','succeeded','failed','blocked','skipped'))
);--> statement-breakpoint
CREATE INDEX `idx_discovery_attempt_run` ON `discovery_run_attempts` (`run_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_discovery_attempt_source` ON `discovery_run_attempts` (`source_id`,`created_at`);--> statement-breakpoint

CREATE TABLE `source_health` (
	`id` text PRIMARY KEY NOT NULL,
	`source_id` text NOT NULL,
	`checked_at` text NOT NULL,
	`status` text NOT NULL,
	`discovered_count` integer DEFAULT 0 NOT NULL,
	`qualified_count` integer DEFAULT 0 NOT NULL,
	`duplicate_count` integer DEFAULT 0 NOT NULL,
	`failure_count` integer DEFAULT 0 NOT NULL,
	`latency_ms` integer,
	`note` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`source_id`) REFERENCES `discovery_sources`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT `source_health_status_check` CHECK(`status` IN ('healthy','degraded','failed','blocked','exhausted'))
);--> statement-breakpoint
CREATE INDEX `idx_source_health_source_checked` ON `source_health` (`source_id`,`checked_at`);--> statement-breakpoint

CREATE TABLE `parser_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`parser_key` text NOT NULL,
	`version` text NOT NULL,
	`source_type` text NOT NULL,
	`description` text,
	`code_hash` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_parser_key_version` ON `parser_versions` (`parser_key`,`version`);--> statement-breakpoint

CREATE TABLE `contact_verification` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`lead_id` text,
	`contact_type` text NOT NULL,
	`contact_value` text,
	`source_url` text NOT NULL,
	`source_title` text,
	`same_company_domain` integer DEFAULT false NOT NULL,
	`business_use` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'unverified' NOT NULL,
	`failure_reason` text,
	`verified_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `prospect_companies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`lead_id`) REFERENCES `campaign_leads`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT `contact_verification_type_check` CHECK(`contact_type` IN ('email','phone','form','contact_page')),
	CONSTRAINT `contact_verification_status_check` CHECK(`status` IN ('unverified','valid','invalid','missing'))
);--> statement-breakpoint
CREATE INDEX `idx_contact_verification_company` ON `contact_verification` (`company_id`,`verified_at`);--> statement-breakpoint
CREATE INDEX `idx_contact_verification_lead` ON `contact_verification` (`lead_id`,`verified_at`);--> statement-breakpoint

CREATE TABLE `discovery_alerts` (
	`id` text PRIMARY KEY NOT NULL,
	`source_id` text,
	`run_id` text,
	`target_date` text,
	`severity` text DEFAULT 'warning' NOT NULL,
	`alert_type` text NOT NULL,
	`message` text NOT NULL,
	`details_json` text DEFAULT '{}' NOT NULL,
	`resolved_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`source_id`) REFERENCES `discovery_sources`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`run_id`) REFERENCES `discovery_runs`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT `discovery_alert_severity_check` CHECK(`severity` IN ('info','warning','critical')),
	CONSTRAINT `discovery_alert_details_json_check` CHECK(json_valid(`details_json`))
);--> statement-breakpoint
CREATE INDEX `idx_discovery_alert_open` ON `discovery_alerts` (`resolved_at`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_discovery_alert_date` ON `discovery_alerts` (`target_date`,`created_at`);
