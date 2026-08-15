ALTER TABLE `campaign_leads` ADD `assignment_type` text DEFAULT 'legacy' NOT NULL;--> statement-breakpoint
ALTER TABLE `campaign_leads` ADD `match_status` text DEFAULT 'current' NOT NULL;--> statement-breakpoint
ALTER TABLE `campaign_leads` ADD `match_reason` text;--> statement-breakpoint
ALTER TABLE `campaign_leads` ADD `matched_at` text;--> statement-breakpoint
UPDATE `campaign_leads`
SET `assignment_type` = CASE WHEN `campaign_id` = 'system:unassigned' THEN 'system' ELSE 'legacy' END,
    `match_status` = CASE WHEN `campaign_id` = 'system:unassigned' THEN 'unassigned' ELSE 'current' END,
    `matched_at` = COALESCE(`created_at`, CURRENT_TIMESTAMP);--> statement-breakpoint
CREATE INDEX `idx_campaign_leads_match` ON `campaign_leads` (`campaign_id`,`match_status`,`workflow_status`);--> statement-breakpoint
ALTER TABLE `campaigns` ADD `region_key` text DEFAULT 'custom' NOT NULL;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `product_tracks_json` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `strategy_priority` integer DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `automation_config_json` text DEFAULT '{"outreachMode":"disabled","stopOnReply":true}' NOT NULL;--> statement-breakpoint
UPDATE `campaigns`
SET `product_tracks_json` = json_array(`product_track`),
    `region_key` = CASE
      WHEN lower(`target_markets`) LIKE '%europe%' OR `target_markets` LIKE '%欧洲%' THEN 'europe'
      WHEN lower(`target_markets`) LIKE '%middle east%' OR `target_markets` LIKE '%中东%' THEN 'middle_east'
      WHEN lower(`target_markets`) LIKE '%southeast asia%' OR `target_markets` LIKE '%东南亚%' THEN 'southeast_asia'
      WHEN lower(`target_markets`) LIKE '%north america%' OR `target_markets` LIKE '%北美%' THEN 'north_america'
      WHEN lower(`target_markets`) LIKE '%latin america%' OR `target_markets` LIKE '%拉丁美洲%' THEN 'latin_america'
      WHEN lower(`target_markets`) LIKE '%oceania%' OR `target_markets` LIKE '%大洋洲%' THEN 'oceania'
      WHEN lower(`target_markets`) LIKE '%africa%' OR `target_markets` LIKE '%非洲%' THEN 'africa'
      WHEN lower(`target_markets`) LIKE '%global%' OR `target_markets` LIKE '%全球%' THEN 'global'
      ELSE 'custom'
    END,
    `automation_config_json` = '{"outreachMode":"disabled","preferredLanguage":"English","sendWindow":"local_business_hours","maxFollowUps":0,"stopOnReply":true,"stopOnBounce":true,"stopOnOptOut":true,"replyHandoff":"human"}'
WHERE `product_tracks_json` = '[]';--> statement-breakpoint
CREATE INDEX `idx_campaigns_region_status` ON `campaigns` (`region_key`,`status`,`strategy_priority`);--> statement-breakpoint
ALTER TABLE `prospect_companies` ADD `customer_types_json` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `prospect_companies` ADD `primary_campaign_id` text;--> statement-breakpoint
UPDATE `prospect_companies`
SET `customer_types_json` = CASE WHEN `customer_type` IS NULL OR trim(`customer_type`) = '' THEN '[]' ELSE json_array(`customer_type`) END;--> statement-breakpoint
UPDATE `prospect_companies` AS `company`
SET `primary_campaign_id` = (
  SELECT `lead`.`campaign_id`
  FROM `campaign_leads` AS `lead`
  INNER JOIN `campaigns` AS `campaign` ON `campaign`.`id` = `lead`.`campaign_id`
  WHERE `lead`.`company_id` = `company`.`id`
  ORDER BY CASE WHEN `lead`.`campaign_id` = 'system:unassigned' THEN 1 ELSE 0 END,
           `campaign`.`strategy_priority` DESC,
           `lead`.`current_score` DESC,
           `lead`.`created_at` ASC
  LIMIT 1
)
WHERE `primary_campaign_id` IS NULL;--> statement-breakpoint
CREATE INDEX `idx_prospect_primary_campaign` ON `prospect_companies` (`primary_campaign_id`,`country`);--> statement-breakpoint
PRAGMA optimize;
