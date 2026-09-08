import { env } from "cloudflare:workers";
import { digest } from "./engine";
import {
  applyEarnCommand,
  initialEarnState,
  type EarnCommand,
  type EarnState,
  EarnError,
  type Context,
} from "./earn-engine";
export function db() {
  if (!env.DB) throw Error("Database unavailable");
  return env.DB;
}
export async function account(owner: string) {
  const database = db();
  let row = await database
    .prepare("SELECT state, version FROM earn_accounts WHERE owner = ?")
    .bind(owner)
    .first<{ state: string; version: number }>();
  if (!row) {
    await database
      .prepare(
        "INSERT INTO earn_accounts(owner,state,version,updated_at) VALUES(?,?,0,?) ON CONFLICT(owner) DO NOTHING",
      )
      .bind(owner, JSON.stringify(initialEarnState()), new Date().toISOString())
      .run();
    row = await database
      .prepare("SELECT state, version FROM earn_accounts WHERE owner = ?")
      .bind(owner)
      .first<{ state: string; version: number }>();
  }
  if (!row) throw Error("Account unavailable");
  return { state: JSON.parse(row.state) as EarnState, version: row.version };
}
export async function execute(owner: string, key: string, command: EarnCommand, context: Context) {
  const database = db(),
    fingerprint = await digest(
      JSON.stringify(Object.entries(command).sort(([a], [b]) => a.localeCompare(b))),
    );
  const receipt = async () => {
    const row = await database
      .prepare("SELECT fingerprint, receipt FROM earn_commands WHERE owner = ? AND key = ?")
      .bind(owner, key)
      .first<{ fingerprint: string; receipt: string }>();
    if (!row) return null;
    if (row.fingerprint !== fingerprint)
      throw new EarnError("This request ID was already used for a different action.");
    return JSON.parse(row.receipt) as { key: string; version: number };
  };
  for (let attempt = 0; attempt < 5; attempt++) {
    const prior = await receipt();
    if (prior) return { ...(await account(owner)), receipt: prior, replayed: true };
    const current = await account(owner);
    let next: EarnState;
    try {
      next = applyEarnCommand(current.state, command, context);
    } catch (error) {
      const prior = await receipt();
      if (prior) return { ...(await account(owner)), receipt: prior, replayed: true };
      throw error;
    }
    const response = { key, version: current.version + 1 },
      now = new Date().toISOString();
    try {
      // D1 batch is transactional. Plain INSERT ensures a duplicate key rolls back the CAS.
      await database.batch([
        database
          .prepare(
            "UPDATE earn_accounts SET state = ?, version = version + 1, last_command = ?, updated_at = ? WHERE owner = ? AND version = ?",
          )
          .bind(JSON.stringify(next), key, now, owner, current.version),
        database
          .prepare(
            "INSERT INTO earn_commands(owner,key,fingerprint,receipt,created_at) SELECT ?,?,?,?,? WHERE EXISTS (SELECT 1 FROM earn_accounts WHERE owner = ? AND version = ? AND last_command = ?)",
          )
          .bind(
            owner,
            key,
            fingerprint,
            JSON.stringify(response),
            now,
            owner,
            current.version + 1,
            key,
          ),
      ]);
    } catch (error) {
      const found = await receipt();
      if (found) return { ...(await account(owner)), receipt: found, replayed: true };
      throw error;
    }
    const saved = await receipt();
    if (saved) return { ...(await account(owner)), receipt: saved, replayed: false };
  }
  throw new Error("Another action is being saved. Please retry this same request.");
}
