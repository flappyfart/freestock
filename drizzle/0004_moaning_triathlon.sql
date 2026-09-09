CREATE TABLE `agent_decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`wallet` text NOT NULL,
	`account` text NOT NULL,
	`revision` integer NOT NULL,
	`source` text NOT NULL,
	`decision` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_agent_decisions_owner_time` ON `agent_decisions` (`user_id`,`wallet`,`account`,`created_at`);--> statement-breakpoint
CREATE TABLE `agent_plans` (
	`user_id` text NOT NULL,
	`wallet` text NOT NULL,
	`account` text NOT NULL,
	`deployment` text NOT NULL,
	`settings` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`monitoring` integer DEFAULT 0 NOT NULL,
	`next_check_at` integer NOT NULL,
	`last_checked_at` integer,
	`last_decision` text,
	`lease_token` text,
	`lease_until` integer DEFAULT 0 NOT NULL,
	`failure_count` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `wallet`, `account`)
);
--> statement-breakpoint
CREATE INDEX `idx_agent_plans_due` ON `agent_plans` (`monitoring`,`next_check_at`,`lease_until`);--> statement-breakpoint
CREATE TABLE `service_checks` (
	`name` text PRIMARY KEY NOT NULL,
	`started_at` integer NOT NULL,
	`completed_at` integer,
	`status` text NOT NULL,
	`details` text NOT NULL
);
