/**
 * lib/integrations/ephemeral-pass-through.ts
 *
 * The pass-through contract for connector data, made explicit.
 *
 * agentplain already reads connector data in-flight and never persists it
 * (see `lib/integrations/inbox/mcp-inbox-fetcher.ts` — it lists + hydrates
 * messages and returns an ephemeral array). This module turns that implicit
 * pattern into a named, enforceable seam so every NEW connector read inherits
 * the same guarantees:
 *
 *   1. FETCH → RETURN → FORGET. The fetcher runs, its result is handed back
 *      to the caller, and nothing touches the database. There is no Prisma
 *      client in this file by design.
 *
 *   2. SHORT-LIVED IN-MEMORY CACHE ONLY. An optional cache lives in process
 *      memory with a hard-capped TTL (≤ 30 min). It is lost on container
 *      restart, never written to disk or DB, and keyed by workspace so one
 *      tenant's fetch can never satisfy another's. This is the "Redis or
 *      in-memory" cache the data-minimization plan calls for; we ship the
 *      in-memory implementation and leave a swap seam (ICache) for Redis.
 *
 *   3. TRANSPARENCY BREADCRUMB. Every fetch records a `storage.ephemeral_fetch`
 *      audit row ("we read N items from your <provider> <resource> at <time>
 *      and did NOT store them") so the customer can SEE the pass-through on
 *      the storage surface — proof, not just a promise.
 *
 * Per `feedback_no_silent_vendor_lock`: this wrapper is vendor-neutral — it
 * takes a `() => Promise<T>` fetcher, so it composes with any MCP server /
 * adapter without importing a single vendor SDK.
 */

import { recordEphemeralFetch } from '../storage/audit';

/** Hard ceiling on the in-memory cache TTL. Connector data must never linger
 *  in memory longer than this, even if a caller asks for more. */
export const MAX_CACHE_TTL_MS = 30 * 60 * 1000;

export interface EphemeralFetchContext {
  /** Workspace the data belongs to — scopes the cache + the audit row. */
  workspaceId: string;
  /** Connector provider key ("GOOGLE", "HUBSPOT", …) for the audit record. */
  provider: string;
  /** What is being read ("inbox", "deals", "contacts") for the audit record. */
  resource: string;
}

/** Minimal cache port. The in-memory implementation ships today; a Redis-
 *  backed one can be dropped in behind the same interface (no DB ever). */
export interface IEphemeralCache {
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T, ttlMs: number): void;
  delete(key: string): void;
  clear(): void;
}

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

/**
 * Process-memory cache with per-entry TTL. NOT a store — it holds connector
 * data transiently to avoid re-hitting a provider within a short window, and
 * evaporates on restart. Bounded by `maxEntries` (LRU-ish: oldest-expiring
 * evicted first) so a long-lived process can't grow it without bound.
 */
export class InMemoryEphemeralCache implements IEphemeralCache {
  private readonly store = new Map<string, CacheEntry>();
  private readonly maxEntries: number;
  private readonly now: () => number;

  constructor(opts: { maxEntries?: number; now?: () => number } = {}) {
    this.maxEntries = opts.maxEntries ?? 1000;
    this.now = opts.now ?? (() => Date.now());
  }

  get<T>(key: string): T | undefined {
    const hit = this.store.get(key);
    if (!hit) return undefined;
    if (hit.expiresAt <= this.now()) {
      this.store.delete(key);
      return undefined;
    }
    return hit.value as T;
  }

  set<T>(key: string, value: T, ttlMs: number): void {
    const clamped = Math.max(0, Math.min(ttlMs, MAX_CACHE_TTL_MS));
    if (clamped === 0) return; // ttl 0 = do not cache
    if (this.store.size >= this.maxEntries) this.evictOldest();
    this.store.set(key, { value, expiresAt: this.now() + clamped });
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  /** Drop every entry for a workspace — called on disconnect/closure so a
   *  closing workspace's data can't linger in memory past its lifetime. */
  clearWorkspace(workspaceId: string): void {
    const prefix = `${workspaceId}:`;
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }

  private evictOldest(): void {
    let oldestKey: string | undefined;
    let oldestExpiry = Infinity;
    for (const [k, v] of this.store) {
      if (v.expiresAt < oldestExpiry) {
        oldestExpiry = v.expiresAt;
        oldestKey = k;
      }
    }
    if (oldestKey) this.store.delete(oldestKey);
  }
}

/** Default process-wide cache. Tests construct their own isolated instance. */
export const defaultEphemeralCache = new InMemoryEphemeralCache();

export interface PassThroughOptions<T> {
  /** When set, cache the result under this key for `ttlMs` (capped at 30 min).
   *  Omit to never cache (the safest default). */
  cacheKey?: string;
  ttlMs?: number;
  /** Cache implementation. Defaults to the process-wide in-memory cache. */
  cache?: IEphemeralCache;
  /** Extract the item count for the transparency record. Defaults to array
   *  length (or 1 for non-arrays). */
  countOf?: (result: T) => number;
  /** Set false to skip the audit breadcrumb (tests / internal probes). */
  audit?: boolean;
  /** Override the breadcrumb recorder (tests). Defaults to the real
   *  best-effort `recordEphemeralFetch`. */
  recordFetch?: (args: {
    workspaceId: string;
    provider: string;
    resource: string;
    itemCount: number;
    durationMs?: number;
  }) => Promise<void>;
  /** Clock injection for tests. */
  now?: () => number;
}

function defaultCount(result: unknown): number {
  if (Array.isArray(result)) return result.length;
  if (result && typeof result === 'object' && 'length' in result) {
    const n = (result as { length: unknown }).length;
    if (typeof n === 'number') return n;
  }
  return result === undefined || result === null ? 0 : 1;
}

/**
 * Run a connector fetch as a pass-through: optionally serve from the short-
 * TTL in-memory cache, otherwise call the fetcher, record the "did not store"
 * breadcrumb, and return the value. NOTHING is persisted to the database.
 */
export async function passThroughFetch<T>(
  ctx: EphemeralFetchContext,
  fetcher: () => Promise<T>,
  opts: PassThroughOptions<T> = {},
): Promise<T> {
  const cache = opts.cache ?? defaultEphemeralCache;
  const fullKey =
    opts.cacheKey !== undefined
      ? `${ctx.workspaceId}:${ctx.provider}:${ctx.resource}:${opts.cacheKey}`
      : undefined;

  if (fullKey) {
    const cached = cache.get<T>(fullKey);
    if (cached !== undefined) return cached;
  }

  const clock = opts.now ?? (() => Date.now());
  const startedAt = clock();
  const result = await fetcher();
  const durationMs = Math.max(0, clock() - startedAt);

  if (fullKey && opts.ttlMs && opts.ttlMs > 0) {
    cache.set(fullKey, result, opts.ttlMs);
  }

  if (opts.audit !== false) {
    const count = (opts.countOf ?? defaultCount)(result);
    const record = opts.recordFetch ?? recordEphemeralFetch;
    // record is best-effort + non-throwing by contract.
    await record({
      workspaceId: ctx.workspaceId,
      provider: ctx.provider,
      resource: ctx.resource,
      itemCount: count,
      durationMs,
    });
  }

  return result;
}
