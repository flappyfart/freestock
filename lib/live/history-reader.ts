import { CHAIN_ID, USDG } from './config.ts';
import { accountPlan } from './account-plan.ts';
import {
  historyAbi,
  approvalAbi,
  eventTopics,
  decodeHistoryEvents,
  historyAddress,
  historyHash,
  historyObject,
  quantity,
  blockNumber,
  sameAddress,
  type HistoryRecord,
  type SavedLiveAccount,
} from './history-model.ts';
import type { createHistoryStore } from './history-store.ts';
type Store = ReturnType<typeof createHistoryStore>;
type Verified = {
  owner: string;
  account: string;
  deployment: string;
  deploymentBlock: number;
  deploymentBlockHash: string;
};
type Readers = {
  rpc: (method: string, params: unknown[]) => Promise<unknown>;
  pin: () => Promise<string>;
  verify: (
    owner: string,
    deployment: string,
    block: string,
  ) => Promise<Verified>;
};
const hex = (n: number) => `0x${n.toString(16)}`;
export function createHistoryReader(reads: Readers, store: Store) {
  async function header(block: number) {
    const value = historyObject(
      await reads.rpc('eth_getBlockByNumber', [hex(block), false]),
    );
    if (blockNumber(value.number) !== block)
      throw Error('The chain returned a different block.');
    const hash = historyHash(value.hash),
      seconds = blockNumber(value.timestamp);
    const timestamp = new Date(seconds * 1000).toISOString();
    return { hash, timestamp };
  }
  function action(
    tx: Record<string, unknown>,
    a: SavedLiveAccount,
    allowOther: boolean,
  ) {
    if (
      quantity(tx.chainId) !== BigInt(CHAIN_ID) ||
      !sameAddress(tx.from, a.wallet)
    )
      throw Error('Transaction wallet or chain mismatch.');
    if (
      tx.to === null &&
      historyHash(tx.hash) === a.deployment &&
      typeof tx.input === 'string' &&
      tx.input.toLowerCase() ===
        accountPlan(a.wallet).transaction.data.toLowerCase() &&
      quantity(tx.value) === 0n
    )
      return 'deploy';
    if (
      sameAddress(tx.to, a.account) &&
      quantity(tx.value) === 0n &&
      typeof tx.input === 'string'
    ) {
      const call = historyAbi.parseTransaction({ data: tx.input });
      if (
        call &&
        ['deposit', 'withdraw', 'withdrawAll', 'compound', 'harvest'].includes(
          call.name,
        )
      )
        return call.name;
    }
    if (
      sameAddress(tx.to, USDG) &&
      quantity(tx.value) === 0n &&
      typeof tx.input === 'string'
    ) {
      const call = approvalAbi.parseTransaction({ data: tx.input });
      if (call?.name === 'approve' && sameAddress(call.args[0], a.account))
        return 'approve';
    }
    if (allowOther)
      return sameAddress(tx.to, a.wallet) &&
        tx.input === '0x' &&
        quantity(tx.value) === 0n
        ? 'cancel'
        : 'other';
    throw Error('This transaction does not belong to this lending position.');
  }
  async function transaction(
    a: SavedLiveAccount,
    hashInput: string,
    previous?: HistoryRecord | null,
    allowOther = false,
  ): Promise<HistoryRecord> {
    const hash = historyHash(hashInput);
    const raw = await reads.rpc('eth_getTransactionByHash', [hash]);
    if (!raw) {
      if (!previous)
        throw Error(
          'The chain has not found this transaction yet. Retry saving it shortly.',
        );
      return {
        ...previous,
        status: 'pending',
        block: null,
        blockHash: null,
        transactionIndex: null,
        timestamp: null,
        gasWei: null,
        events: [],
        replacedBy: undefined,
      };
    }
    const tx = historyObject(raw);
    if (historyHash(tx.hash) !== hash)
      throw Error('Transaction identity mismatch.');
    const label = action(tx, a, allowOther || !!previous?.replaces);
    const result: HistoryRecord = {
      chainId: CHAIN_ID,
      wallet: a.wallet,
      account: a.account,
      hash,
      nonce: quantity(tx.nonce).toString(),
      action: label,
      status: 'pending',
      block: null,
      blockHash: null,
      transactionIndex: null,
      timestamp: null,
      gasWei: null,
      events: [],
      ...(previous?.replaces ? { replaces: previous.replaces } : {}),
    };
    const rawReceipt = await reads.rpc('eth_getTransactionReceipt', [hash]);
    if (!rawReceipt) return result;
    const receipt = historyObject(rawReceipt),
      block = blockNumber(receipt.blockNumber),
      blockHash = historyHash(receipt.blockHash);
    if (
      historyHash(receipt.transactionHash) !== hash ||
      !sameAddress(receipt.from, a.wallet) ||
      historyHash(tx.blockHash) !== blockHash ||
      blockNumber(tx.blockNumber) !== block
    )
      throw Error('Transaction confirmation changed.');
    const current = await header(block);
    if (current.hash !== blockHash)
      throw Error('The transaction block changed. Refresh its history.');
    const status = quantity(receipt.status);
    if (status !== 0n && status !== 1n) throw Error('Invalid receipt status.');
    result.status = status === 1n ? 'confirmed' : 'reverted';
    result.block = block;
    result.blockHash = blockHash;
    result.transactionIndex = blockNumber(receipt.transactionIndex);
    result.timestamp = current.timestamp;
    result.gasWei =
      receipt.gasUsed !== undefined && receipt.effectiveGasPrice !== undefined
        ? (
            quantity(receipt.gasUsed) * quantity(receipt.effectiveGasPrice)
          ).toString()
        : null;
    if (status === 1n) {
      result.events = decodeHistoryEvents(receipt.logs, {
        account: a.account,
        wallet: a.wallet,
        hash,
        block,
        blockHash,
      });
      if (
        [
          'deposit',
          'withdraw',
          'withdrawAll',
          'compound',
          'harvest',
          'approve',
        ].includes(label) &&
        !result.events.length
      )
        throw Error('The confirmed action has no matching events.');
    }
    return result;
  }
  async function register(user: string, wallet: string, deployment: string) {
    const head = await reads.pin();
    const verified = await reads.verify(
      historyAddress(wallet),
      historyHash(deployment),
      head,
    );
    return store.remember(user, verified);
  }
  async function track(
    user: string,
    wallet: string,
    deployment: string,
    hash: string,
    replaces?: string,
  ) {
    const a = await register(user, wallet, deployment),
      scope = { user, wallet: a.wallet, account: a.account };
    const prior = await store.transaction(scope, hash);
    const original = replaces ? await store.transaction(scope, replaces) : null;
    if (replaces && !original)
      throw Error(
        'Save the original transaction before linking its replacement.',
      );
    const record = await transaction(a, hash, prior, !!original);
    const records = [record];
    if (original) {
      if (record.hash === original.hash || record.nonce !== original.nonce)
        throw Error('The replacement uses a different request nonce.');
      record.replaces = original.hash;
      if (record.status === 'confirmed' || record.status === 'reverted')
        records.push({
          ...original,
          status: 'replaced',
          events: [],
          replacedBy: record.hash,
        });
    }
    if (record.status === 'confirmed' || record.status === 'reverted') {
      for (const older of await store.nonceRecords(scope, record.nonce)) {
        if (
          older.hash !== record.hash &&
          (older.status === 'confirmed' || older.status === 'reverted')
        ) {
          const checked = await transaction(a, older.hash, older, true);
          if (checked.status === 'confirmed' || checked.status === 'reverted')
            throw Error('Conflicting confirmations for the same wallet nonce.');
        }
        if (
          older.hash !== record.hash &&
          !records.some((r) => r.hash === older.hash)
        )
          records.push({
            ...older,
            status: 'replaced',
            events: [],
            replacedBy: record.hash,
          });
      }
    }
    await store.commit(scope, a, records);
    return record;
  }
  async function sync(user: string, wallet: string, deployment: string) {
    const pinned = await reads.pin(),
      head = blockNumber(pinned);
    const a = await store.remember(
      user,
      await reads.verify(
        historyAddress(wallet),
        historyHash(deployment),
        pinned,
      ),
    );
    const scope = { user, wallet: a.wallet, account: a.account };
    let reset = false;
    if (
      a.syncedBlock !== null &&
      (a.syncedBlock > head ||
        (await header(a.syncedBlock)).hash !== a.syncedBlockHash)
    )
      reset = true;
    // A matching checkpoint commits its ancestry. Rebuild after a mismatch rather than
    // shrinking an overlap behind the cursor and repeatedly importing the same blocks.
    const from =
      reset || a.syncedBlock === null
        ? a.deploymentBlock
        : Math.min(head, a.syncedBlock + 1);
    if (from > head)
      throw Error('The chain head is behind this account. Try syncing later.');
    let to = Math.min(head, from + 4999),
      logs: Record<string, unknown>[] = [],
      endpoint = await header(to),
      previous: HistoryRecord[] = [];
    for (let attempt = 0; attempt < 8; attempt++) {
      endpoint = await header(to);
      const found = await reads.rpc('eth_getLogs', [
        {
          address: a.account,
          fromBlock: hex(from),
          toBlock: hex(to),
          topics: [eventTopics],
        },
      ]);
      if (!Array.isArray(found))
        throw Error('Account activity is unavailable.');
      logs = found.map(historyObject);
      const candidates = await store.candidates(scope, from, to);
      previous = candidates.records;
      if (
        !candidates.rangeTooLarge &&
        logs.length <= 200 &&
        new Set(logs.map((l) => l.transactionHash)).size <= 30
      )
        break;
      if (to === from)
        throw Error('This block contains too much activity to import safely.');
      to = from + Math.floor((to - from) / 2);
      if (attempt === 7)
        throw Error('This activity range needs a smaller sync window.');
    }
    const known = new Map(previous.map((r) => [r.hash, r]));
    const hashes = new Set<string>([
      a.deployment,
      ...previous.map((r) => r.hash),
    ]);
    // Follow the full saved replacement chain, including winners outside this range.
    const relatedQueue = [...previous];
    for (const r of relatedQueue) {
      for (const related of [r.replaces, r.replacedBy]) {
        if (!related || hashes.has(related)) continue;
        const saved = await store.transaction(scope, related);
        if (saved) {
          known.set(saved.hash, saved);
          hashes.add(saved.hash);
          relatedQueue.push(saved);
          if (relatedQueue.length > 80)
            throw Error(
              'Too many linked wallet requests to reconcile in one sync.',
            );
        }
      }
    }
    for (const log of logs) {
      if (
        !sameAddress(log.address, a.account) ||
        log.removed === true ||
        blockNumber(log.blockNumber) < from ||
        blockNumber(log.blockNumber) > to ||
        !Array.isArray(log.topics) ||
        !eventTopics.includes(String(log.topics[0]))
      )
        throw Error('Account activity returned an unrelated event.');
      hashes.add(historyHash(log.transactionHash));
    }
    const records: HistoryRecord[] = [];
    const all = Array.from(hashes);
    for (let i = 0; i < all.length; i += 4)
      records.push(
        ...(await Promise.all(
          all.slice(i, i + 4).map((h) => transaction(a, h, known.get(h))),
        )),
      );
    for (const log of logs) {
      const record = records.find(
        (r) => r.hash === historyHash(log.transactionHash),
      );
      if (
        !record ||
        record.status !== 'confirmed' ||
        record.blockHash !== historyHash(log.blockHash) ||
        !record.events.some((e) => e.logIndex === blockNumber(log.logIndex))
      )
        throw Error('The event is missing from its canonical receipt.');
    }
    const winners = new Map<string, HistoryRecord>();
    for (const r of records)
      if (r.status === 'confirmed' || r.status === 'reverted') {
        if (winners.has(r.nonce) && winners.get(r.nonce)!.hash !== r.hash)
          throw Error('Conflicting confirmations for the same wallet nonce.');
        winners.set(r.nonce, r);
      }
    for (const winner of winners.values()) {
      for (const old of await store.nonceRecords(scope, winner.nonce))
        if (!records.some((r) => r.hash === old.hash)) records.push(old);
      for (const old of records)
        if (old.nonce === winner.nonce && old.hash !== winner.hash) {
          old.status = 'replaced';
          old.events = [];
          old.replacedBy = winner.hash;
        }
    }
    if ((await header(to)).hash !== endpoint.hash)
      throw Error(
        'The chain changed during sync. No partial history was saved.',
      );
    await store.commit(scope, a, records, {
      block: to,
      hash: endpoint.hash,
      head,
      reset,
      from,
    });
    return { ...(await store.page(scope)), more: to < head };
  }
  return { register, track, sync, transaction };
}
