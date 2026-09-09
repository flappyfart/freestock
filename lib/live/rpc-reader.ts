const READ_METHODS = new Set([
  "eth_chainId",
  "eth_blockNumber",
  "eth_getBlockByNumber",
  "eth_getBalance",
  "eth_call",
  "eth_getCode",
  "eth_estimateGas",
  "eth_gasPrice",
  "eth_getTransactionByHash",
  "eth_getTransactionReceipt",
  "eth_getTransactionCount",
  "eth_getLogs",
]);
const TRANSIENT_HTTP = new Set([408, 429, 500, 502, 503, 504]);
export type RpcDiagnostic = {
  method: string;
  attempt: number;
  kind: "http" | "network" | "rpc" | "invalid";
  upstreamStatus?: number;
  retryAfterMs?: number;
  ray?: string;
};
export class RpcReadError extends Error {
  readonly code: "unsupported" | "upstream" | "simulation";
  readonly upstreamStatus?: number;
  constructor(message: string, code: RpcReadError["code"], upstreamStatus?: number) {
    super(message);
    this.code = code;
    this.upstreamStatus = upstreamStatus;
  }
}
type Options = {
  fetcher?: typeof fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
  report?: (event: RpcDiagnostic) => void;
};
function retryAfter(value: string | null, now: number) {
  if (value === null) return undefined;
  if (/^\d+(?:\.\d+)?$/.test(value.trim())) return Number(value) * 1000;
  const time = Date.parse(value);
  return Number.isFinite(time) ? Math.max(0, time - now) : undefined;
}
function unavailable(status?: number) {
  if (status === 429)
    return new RpcReadError(
      "The chain data provider is busy. Wait briefly, then request a fresh preview.",
      "upstream",
      status,
    );
  if (status === 401 || status === 403)
    return new RpcReadError(
      "The chain data provider refused the connection. Please try again later.",
      "upstream",
      status,
    );
  return new RpcReadError(
    "Robinhood Chain data is temporarily unavailable. Please request a fresh preview shortly.",
    "upstream",
    status,
  );
}
/** One reader per inbound request. Coalesces exact concurrent reads only; never caches results. */
export function createRpcReader(options: Options = {}) {
  const fetcher = options.fetcher ?? fetch;
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? ((ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const random = options.random ?? Math.random;
  const inflight = new Map<string, Promise<unknown>>();
  // These limits live only for this inbound request, never across Worker requests.
  const endpoints = new Map<string, { cooldownUntil: number; limited: number; blocked: boolean }>();
  let active = 0;
  const waiting: (() => void)[] = [];
  async function acquire(deadline: number) {
    if (now() >= deadline) throw unavailable();
    if (active < 3) {
      active++;
      return;
    }
    await new Promise<void>((resolve, reject) => {
      const grant = () => {
        clearTimeout(timer);
        if (now() >= deadline) reject(unavailable());
        else {
          active++;
          resolve();
        }
      };
      const timer = setTimeout(() => {
        const index = waiting.indexOf(grant);
        if (index >= 0) waiting.splice(index, 1);
        reject(unavailable());
      }, Math.max(0, deadline - now()));
      waiting.push(grant);
    });
  }
  function release() {
    active--;
    while (active < 3 && waiting.length) waiting.shift()!();
  }
  const report = (event: RpcDiagnostic) => {
    // Only fixed method/status metadata is reported: no URL, key, payload, response body, or wallet.
    try {
      options.report?.(event);
    } catch {
      /* Diagnostics must not affect a read. */
    }
  };
  async function perform(endpoint: string, method: string, body: string, deadline: number) {
    let state = endpoints.get(endpoint);
    if (!state) {
      state = { cooldownUntil: 0, limited: 0, blocked: false };
      endpoints.set(endpoint, state);
    }
    for (let attempt = 1; attempt <= 3; attempt++) {
      // Every read (including queued first attempts) observes the same provider cooldown.
      while (true) {
        if (state.blocked) throw unavailable(429);
        const delay = state.cooldownUntil - now();
        if (delay <= 0) break;
        if (now() + delay >= deadline) throw unavailable(429);
        await sleep(delay);
      }
      const remaining = deadline - now();
      if (remaining <= 0) throw unavailable();
      const signal = AbortSignal.timeout(Math.min(4000, remaining));
      let response: Response;
      try {
        response = await fetcher(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          signal,
          redirect: "manual",
          cache: "no-store",
        });
      } catch {
        report({ method, attempt, kind: "network" });
        const delay = 300 * 2 ** (attempt - 1) + Math.floor(random() * 150);
        if (attempt === 3 || now() + delay >= deadline) throw unavailable();
        await sleep(delay);
        continue;
      }
      if (!response.ok) {
        const delayHint = retryAfter(response.headers.get("retry-after"), now());
        const rawRay = response.headers.get("cf-ray");
        report({
          method,
          attempt,
          kind: "http",
          upstreamStatus: response.status,
          ...(delayHint === undefined ? {} : { retryAfterMs: delayHint }),
          ...(/^[a-zA-Z0-9-]{1,80}$/.test(rawRay ?? "") ? { ray: rawRay! } : {}),
        });
        const delay = Math.max(
          delayHint ?? 0,
          300 * 2 ** (attempt - 1) + Math.floor(random() * 150),
        );
        if (response.status === 429) {
          state.limited++;
          state.cooldownUntil = Math.max(state.cooldownUntil, now() + delay);
          // Two retry opportunities for the endpoint, not two for every fan-out read.
          // A long provider cooldown ends this inbound operation without retrying early.
          if (state.limited >= 3 || delay > 2000) state.blocked = true;
        }
        // Release the failed response body. Do not parse or expose gateway HTML or credentials.
        await response.body?.cancel().catch(() => undefined);
        if (
          !TRANSIENT_HTTP.has(response.status) ||
          attempt === 3 ||
          delay > 2000 ||
          state.blocked ||
          now() + delay >= deadline
        )
          throw unavailable(response.status);
        // 429 retries wait at the shared gate, which can also extend while we sleep.
        if (response.status !== 429) await sleep(delay);
        continue;
      }
      let data: { id?: unknown; error?: unknown; result?: unknown };
      try {
        data = (await response.json()) as typeof data;
      } catch {
        report({ method, attempt, kind: "invalid" });
        throw new RpcReadError("Invalid response from the chain data provider.", "upstream");
      }
      if (
        !data ||
        typeof data !== "object" ||
        Array.isArray(data) ||
        data.id !== 1 ||
        (!Object.hasOwn(data, "result") && !data.error)
      ) {
        report({ method, attempt, kind: "invalid" });
        throw new RpcReadError("Invalid response from the chain data provider.", "upstream");
      }
      if (data.error) {
        report({ method, attempt, kind: "rpc" });
        // Never repeat deterministic reverts or RPC errors. A new preview is a separate request.
        throw new RpcReadError(
          "The chain could not complete this read or simulation.",
          "simulation",
        );
      }
      return data.result;
    }
    throw unavailable();
  }
  return (endpoint: string, method: string, params: unknown[]): Promise<unknown> => {
    if (!READ_METHODS.has(method))
      return Promise.reject(new RpcReadError("Unsupported chain read.", "unsupported"));
    const body = JSON.stringify({ jsonrpc: "2.0", id: 1, method, params });
    const key = endpoint + "\n" + body;
    const prior = inflight.get(key);
    if (prior) return prior;
    const deadline = now() + 10000;
    const request = (async () => {
      await acquire(deadline);
      try {
        return await perform(endpoint, method, body, deadline);
      } finally {
        release();
      }
    })();
    inflight.set(key, request);
    // Both outcomes evict the request. No stale quote, balance or prepared transaction cache.
    void request.then(
      () => inflight.delete(key),
      () => inflight.delete(key),
    );
    return request;
  };
}
