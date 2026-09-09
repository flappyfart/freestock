CREATE TABLE `purchase_alerts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`wallet` text NOT NULL,
	`account` text NOT NULL,
	`deployment` text NOT NULL,
	`revision` integer NOT NULL,
	`assets` text NOT NULL,
	`allocations` text NOT NULL,
	`created_at` integer NOT NULL,
	`confirmed_at` integer NOT NULL,
	`read_at` integer,
	`closed_at` integer
);
--> statement-breakpoint
CREATE INDEX `idx_purchase_alerts_owner_time` ON `purchase_alerts` (`user_id`,`wallet`,`created_at`);--> statement-breakpoint
CREATE TABLE `push_deliveries` (
	`alert_id` text NOT NULL,
	`subscription_id` text NOT NULL,
	`subscription_version` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`next_attempt_at` integer NOT NULL,
	`lease_token` text,
	`lease_until` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	PRIMARY KEY(`alert_id`, `subscription_id`)
);
--> statement-breakpoint
CREATE INDEX `idx_push_deliveries_due` ON `push_deliveries` (`status`,`next_attempt_at`);--> statement-breakpoint
CREATE TABLE `push_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`wallet` text NOT NULL,
	`subscription` text NOT NULL,
	`version` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_push_subscriptions_owner` ON `push_subscriptions` (`user_id`,`wallet`);