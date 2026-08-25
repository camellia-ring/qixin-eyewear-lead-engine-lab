CREATE TABLE `crm_handoff_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`handoff_id` text NOT NULL,
	`lead_id` text NOT NULL,
	`company_id` text NOT NULL,
	`contract_version` text NOT NULL,
	`payload_json` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`http_status` integer,
	`response_code` text,
	`customer_id` text,
	`error_message` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`lead_id`) REFERENCES `campaign_leads`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`company_id`) REFERENCES `prospect_companies`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "crm_handoff_attempt_payload_check" CHECK(json_valid("crm_handoff_attempts"."payload_json")),
	CONSTRAINT "crm_handoff_attempt_status_check" CHECK("crm_handoff_attempts"."status" IN ('pending','succeeded','failed'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_crm_handoff_attempt_handoff` ON `crm_handoff_attempts` (`handoff_id`);--> statement-breakpoint
CREATE INDEX `idx_crm_handoff_attempt_company_status` ON `crm_handoff_attempts` (`company_id`,`status`,`created_at`);