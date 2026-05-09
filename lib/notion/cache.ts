// Tiny in-process TTL cache for the BriefingsProvider read-through layer.
//
// Per engineering_plan §4.3:
//   * 5-min TTL on briefings (default here)
//   * cache key includes workspaceId so per-workspace briefings don't collide
//   * StaleBadge rendering: callers check `isStale` flag set when serving past TTL
//
// This is an in-memory cache keyed on the running Node process. For
// horizontal-scale (Vercel functions), Phase 2 swaps in Vercel KV or
// Postgres-mirrored briefings — same interface.

export interface CacheEntry<T> {
  value: T;
  fetchedAt: number;
  ttlMs: number;
}

export class TtlCache<T> {
  private store = new Map<string, CacheEntry<T>>();

  get(key: string): { value: T; isStale: boolean; fetchedAt: number } | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    const isStale = Date.now() - entry.fetchedAt > entry.ttlMs;
    return { value: entry.value, isStale, fetchedAt: entry.fetchedAt };
  }

  set(key: string, value: T, ttlMs: number): void {
    this.store.set(key, { value, fetchedAt: Date.now(), ttlMs });
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  size(): number {
    return this.store.size;
  }
}
