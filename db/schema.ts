import { sqliteTable, text, integer, primaryKey, index } from "drizzle-orm/sqlite-core";
export const accounts = sqliteTable("accounts", {
  owner: text("owner").primaryKey(),
  state: text("state").notNull(),
  version: integer("version").notNull().default(0),
  lastCommand: text("last_command"),
  updatedAt: text("updated_at").notNull(),
});
export const commands = sqliteTable(
  "commands",
  {
    owner: text("owner")
      .notNull()
      .references(() => accounts.owner),
    key: text("key").notNull(),
    fingerprint: text("fingerprint").notNull(),
    receipt: text("receipt").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.owner, t.key] }),
    index("idx_commands_owner_created").on(t.owner, t.createdAt),
  ],
);

export const earnAccounts = sqliteTable("earn_accounts", {
  owner: text("owner").primaryKey(),
  state: text("state").notNull(),
  version: integer("version").notNull().default(0),
  lastCommand: text("last_command"),
  updatedAt: text("updated_at").notNull(),
});
export const earnCommands = sqliteTable(
  "earn_commands",
  {
    owner: text("owner")
      .notNull()
      .references(() => earnAccounts.owner),
    key: text("key").notNull(),
    fingerprint: text("fingerprint").notNull(),
    receipt: text("receipt").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.owner, t.key] }),
    index("idx_earn_commands_owner_created").on(t.owner, t.createdAt),
  ],
);
