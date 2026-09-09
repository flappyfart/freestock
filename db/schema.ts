import {
  sqliteTable,
  text,
  integer,
  primaryKey,
  index,
} from 'drizzle-orm/sqlite-core';
// Live records are private bookmarks and chain observations, never signing authority.
export const liveAccounts = sqliteTable(
  'live_accounts',
  {
    userId: text('user_id').notNull(),
    wallet: text('wallet').notNull(),
    account: text('account').notNull(),
    chainId: integer('chain_id').notNull(),
    deployment: text('deployment').notNull(),
    deploymentBlock: integer('deployment_block').notNull(),
    deploymentBlockHash: text('deployment_block_hash').notNull(),
    syncedBlock: integer('synced_block'),
    syncedBlockHash: text('synced_block_hash'),
    headBlock: integer('head_block'),
    version: integer('version').notNull().default(0),
    operation: text('operation'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.chainId, t.wallet, t.account] })],
);
export const liveTransactions = sqliteTable(
  'live_transactions',
  {
    userId: text('user_id').notNull(),
    chainId: integer('chain_id').notNull(),
    wallet: text('wallet').notNull(),
    account: text('account').notNull(),
    hash: text('hash').notNull(),
    block: integer('block'),
    transactionIndex: integer('transaction_index'),
    status: text('status').notNull(),
    record: text('record').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.chainId, t.wallet, t.account, t.hash] }),
    index('idx_live_transactions_history').on(
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
export const accounts = sqliteTable('accounts', {
  owner: text('owner').primaryKey(),
  state: text('state').notNull(),
  version: integer('version').notNull().default(0),
  lastCommand: text('last_command'),
  updatedAt: text('updated_at').notNull(),
});
export const commands = sqliteTable(
  'commands',
  {
    owner: text('owner')
      .notNull()
      .references(() => accounts.owner),
    key: text('key').notNull(),
    fingerprint: text('fingerprint').notNull(),
    receipt: text('receipt').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.owner, t.key] }),
    index('idx_commands_owner_created').on(t.owner, t.createdAt),
  ],
);

export const earnAccounts = sqliteTable('earn_accounts', {
  owner: text('owner').primaryKey(),
  state: text('state').notNull(),
  version: integer('version').notNull().default(0),
  lastCommand: text('last_command'),
  updatedAt: text('updated_at').notNull(),
});
export const earnCommands = sqliteTable(
  'earn_commands',
  {
    owner: text('owner')
      .notNull()
      .references(() => earnAccounts.owner),
    key: text('key').notNull(),
    fingerprint: text('fingerprint').notNull(),
    receipt: text('receipt').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.owner, t.key] }),
    index('idx_earn_commands_owner_created').on(t.owner, t.createdAt),
  ],
);

// Only hashed bearer tokens are stored. Wallet signatures do not grant spending authority.
export const walletChallenges = sqliteTable(
  'wallet_challenges',
  {
    id: text('id').primaryKey(),
    wallet: text('wallet').notNull(),
    origin: text('origin').notNull(),
    message: text('message').notNull(),
    expiresAt: integer('expires_at').notNull(),
    bindingHash: text('binding_hash').notNull().unique(),
    consumedBy: text('consumed_by'),
  },
  (t) => [index('wallet_challenges_expiry').on(t.expiresAt)],
);
export const walletSessions = sqliteTable(
  'wallet_sessions',
  {
    tokenHash: text('token_hash').primaryKey(),
    wallet: text('wallet').notNull(),
    expiresAt: integer('expires_at').notNull(),
  },
  (t) => [index('wallet_sessions_expiry').on(t.expiresAt)],
);

// Saved recommendations are never permission to sign or spend from a wallet.
export const agentPlans = sqliteTable(
  'agent_plans',
  {
    userId: text('user_id').notNull(),
    wallet: text('wallet').notNull(),
    account: text('account').notNull(),
    deployment: text('deployment').notNull(),
    settings: text('settings').notNull(),
    revision: integer('revision').notNull().default(1),
    monitoring: integer('monitoring').notNull().default(0),
    nextCheckAt: integer('next_check_at').notNull(),
    lastCheckedAt: integer('last_checked_at'),
    lastDecision: text('last_decision'),
    leaseToken: text('lease_token'),
    leaseUntil: integer('lease_until').notNull().default(0),
    failureCount: integer('failure_count').notNull().default(0),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.wallet, t.account] }),
    index('idx_agent_plans_due').on(t.monitoring, t.nextCheckAt, t.leaseUntil),
  ],
);

export const agentDecisions = sqliteTable(
  'agent_decisions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    wallet: text('wallet').notNull(),
    account: text('account').notNull(),
    revision: integer('revision').notNull(),
    source: text('source').notNull(),
    decision: text('decision').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [
    index('idx_agent_decisions_owner_time').on(
      t.userId,
      t.wallet,
      t.account,
      t.createdAt,
    ),
  ],
);

export const serviceChecks = sqliteTable('service_checks', {
  name: text('name').primaryKey(),
  startedAt: integer('started_at').notNull(),
  completedAt: integer('completed_at'),
  status: text('status').notNull(),
  details: text('details').notNull(),
});
