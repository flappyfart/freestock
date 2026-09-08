CREATE TABLE `earn_accounts` (
	`owner` text PRIMARY KEY NOT NULL,
	`state` text NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`last_command` text,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `earn_commands` (
	`owner` text NOT NULL,
	`key` text NOT NULL,
	`fingerprint` text NOT NULL,
	`receipt` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`owner`, `key`),
	FOREIGN KEY (`owner`) REFERENCES `earn_accounts`(`owner`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_earn_commands_owner_created` ON `earn_commands` (`owner`,`created_at`);