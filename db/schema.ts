import { sqliteTable, text, integer, primaryKey, index } from "drizzle-orm/sqlite-core";
// Live records are private bookmarks and chain observations, never signing authority.
export const liveAccounts = sqliteTable(
  "live_accounts",
  {
    userId: text("user_id").notNull(),
    wallet: text("wallet").notNull(),
    account: text("account").notNull(),
    chainId: integer("chain_id").notNull(),
    deployment: text("deployment").notNull(),
    deploymentBlock: integer("deployment_block").notNull(),
    deploymentBlockHash: text("deployment_block_hash").notNull(),
    syncedBlock: integer("synced_block"),
    syncedBlockHash: text("synced_block_hash"),
    headBlock: integer("head_block"),
    version: integer("version").notNull().default(0),
    operation: text("operation"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.chainId, t.wallet, t.account] })],
);
export const liveTransactions = sqliteTable(
  "live_transactions",
  {
    userId: text("user_id").notNull(),
    chainId: integer("chain_id").notNull(),
    wallet: text("wallet").notNull(),
    account: text("account").notNull(),
    hash: text("hash").notNull(),
    block: integer("block"),
    transactionIndex: integer("transaction_index"),
    status: text("status").notNull(),
    record: text("record").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.chainId, t.wallet, t.account, t.hash] }),
    index("idx_live_transactions_history").on(
      t.userId,
      t.chainId,
      t.wallet,
      t.account,
      t.block,
      t.transactionIndex,
      t.hash,
    ),
  ],
);
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
