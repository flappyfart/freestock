CREATE TABLE `wallet_challenges` (
	`id` text PRIMARY KEY NOT NULL,
	`wallet` text NOT NULL,
	`origin` text NOT NULL,
	`message` text NOT NULL,
	`expires_at` integer NOT NULL,
	`binding_hash` text NOT NULL,
	`consumed_by` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `wallet_challenges_binding_hash_unique` ON `wallet_challenges` (`binding_hash`);--> statement-breakpoint
CREATE INDEX `wallet_challenges_expiry` ON `wallet_challenges` (`expires_at`);--> statement-breakpoint
CREATE TABLE `wallet_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`wallet` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `wallet_sessions_expiry` ON `wallet_sessions` (`expires_at`);