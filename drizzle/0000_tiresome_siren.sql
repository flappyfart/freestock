CREATE TABLE `accounts` (
	`owner` text PRIMARY KEY NOT NULL,
	`state` text NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`last_command` text,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `commands` (
	`owner` text NOT NULL,
	`key` text NOT NULL,
	`fingerprint` text NOT NULL,
	`receipt` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`owner`, `key`),
	FOREIGN KEY (`owner`) REFERENCES `accounts`(`owner`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_commands_owner_created` ON `commands` (`owner`,`created_at`);