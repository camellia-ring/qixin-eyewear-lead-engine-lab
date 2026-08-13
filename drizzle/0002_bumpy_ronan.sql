CREATE TABLE `discovery_run_items` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`company_id` text,
	`website_url` text NOT NULL,
	`normalized_domain` text NOT NULL,
	`company_name` text,
	`outcome` text NOT NULL,
	`reason` text,
	`evidence_count` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `discovery_runs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`company_id`) REFERENCES `prospect_companies`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "discovery_item_outcome_check" CHECK("discovery_run_items"."outcome" IN ('imported','duplicate','excluded','failed')),
	CONSTRAINT "discovery_item_evidence_count_check" CHECK("discovery_run_items"."evidence_count" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_discovery_item_run_domain` ON `discovery_run_items` (`run_id`,`normalized_domain`);--> statement-breakpoint
CREATE INDEX `idx_discovery_item_run_outcome` ON `discovery_run_items` (`run_id`,`outcome`);--> statement-breakpoint
CREATE INDEX `idx_discovery_item_company` ON `discovery_run_items` (`company_id`);--> statement-breakpoint
CREATE TABLE `discovery_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`source_id` text NOT NULL,
	`campaign_id` text NOT NULL,
	`trigger` text DEFAULT 'manual' NOT NULL,
	`status` text DEFAULT 'running' NOT NULL,
	`discovered_count` integer DEFAULT 0 NOT NULL,
	`imported_count` integer DEFAULT 0 NOT NULL,
	`duplicate_count` integer DEFAULT 0 NOT NULL,
	`excluded_count` integer DEFAULT 0 NOT NULL,
	`failed_count` integer DEFAULT 0 NOT NULL,
	`pages_fetched` integer DEFAULT 0 NOT NULL,
	`error_summary` text,
	`started_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`completed_at` text,
	`created_by` text DEFAULT 'private_owner' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`source_id`) REFERENCES `discovery_sources`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "discovery_run_trigger_check" CHECK("discovery_runs"."trigger" IN ('manual','scheduled')),
	CONSTRAINT "discovery_run_status_check" CHECK("discovery_runs"."status" IN ('running','completed','partial','failed')),
	CONSTRAINT "discovery_run_counts_check" CHECK("discovery_runs"."discovered_count" >= 0 AND "discovery_runs"."imported_count" >= 0 AND "discovery_runs"."duplicate_count" >= 0 AND "discovery_runs"."excluded_count" >= 0 AND "discovery_runs"."failed_count" >= 0 AND "discovery_runs"."pages_fetched" >= 0)
);
--> statement-breakpoint
CREATE INDEX `idx_discovery_run_source_created` ON `discovery_runs` (`source_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_discovery_run_campaign_created` ON `discovery_runs` (`campaign_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `discovery_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`name` text NOT NULL,
	`source_url` text NOT NULL,
	`normalized_domain` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`cadence` text DEFAULT 'manual' NOT NULL,
	`max_candidates` integer DEFAULT 10 NOT NULL,
	`last_run_at` text,
	`next_run_at` text,
	`created_by` text DEFAULT 'private_owner' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "discovery_source_status_check" CHECK("discovery_sources"."status" IN ('active','paused')),
	CONSTRAINT "discovery_source_cadence_check" CHECK("discovery_sources"."cadence" IN ('manual','daily','weekly')),
	CONSTRAINT "discovery_source_max_check" CHECK("discovery_sources"."max_candidates" BETWEEN 1 AND 20)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_discovery_source_campaign_url` ON `discovery_sources` (`campaign_id`,`source_url`);--> statement-breakpoint
CREATE INDEX `idx_discovery_source_due` ON `discovery_sources` (`status`,`next_run_at`);--> statement-breakpoint
CREATE INDEX `idx_discovery_source_campaign` ON `discovery_sources` (`campaign_id`,`updated_at`);