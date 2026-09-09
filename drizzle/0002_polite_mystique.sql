CREATE TABLE `live_accounts` (
	`user_id` text NOT NULL,
	`wallet` text NOT NULL,
	`account` text NOT NULL,
	`chain_id` integer NOT NULL,
	`deployment` text NOT NULL,
	`deployment_block` integer NOT NULL,
	`deployment_block_hash` text NOT NULL,
	`synced_block` integer,
	`synced_block_hash` text,
	`head_block` integer,
	`version` integer DEFAULT 0 NOT NULL,
	`operation` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `chain_id`, `wallet`, `account`)
);
--> statement-breakpoint
CREATE TABLE `live_transactions` (
	`user_id` text NOT NULL,
	`chain_id` integer NOT NULL,
	`wallet` text NOT NULL,
	`account` text NOT NULL,
	`hash` text NOT NULL,
	`block` integer,
	`transaction_index` integer,
	`status` text NOT NULL,
	`record` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `chain_id`, `wallet`, `account`, `hash`)
);
--> statement-breakpoint
CREATE INDEX `idx_live_transactions_history` ON `live_transactions` (`user_id`,`chain_id`,`wallet`,`account`,`block`,`transaction_index`,`hash`);