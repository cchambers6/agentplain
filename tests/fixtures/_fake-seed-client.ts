/**
 * tests/fixtures/_fake-seed-client.ts
 *
 * In-memory `SeedClient` for the seeded-login E2E harness offline tests.
 * Implements just enough of the Prisma delegate surface (`upsert`,
 * `deleteMany`, `count`) for `seedTestWorkspace` / `teardownTestWorkspace`
 * to run with NO database. Each delegate keeps a `Map` keyed by a stable
 * identity so upsert-on-re-run is a true update, letting the idempotency
 * tests assert "second run did not duplicate".
 *
 * Per feedback_no_silent_vendor_lock.md: a TEST-ONLY adapter over Prisma's
 * call shape, never a production substitute.
 */

import type { SeedClient, SeedDelegate } from "@/tests/fixtures/seed-test-workspace";

interface Stored {
  identity: string;
  row: Record<string, unknown>;
}

/** Build a stable identity string from a Prisma `where` clause. Handles the
 *  three shapes the seed uses: `{ id }`, a single compound-unique object
 *  (`{ userId_workspaceId: {...} }` etc.), and `{ workspaceId }`. */
function identityOf(where: Record<string, unknown>): string {
  if (typeof where.id === "string") return `id:${where.id}`;
  if (typeof where.workspaceId === "string") return `ws:${where.workspaceId}`;
  // Compound unique — the only key is the @@unique tuple name.
  const keys = Object.keys(where);
  if (keys.length === 1) {
    const inner = where[keys[0]!];
    return `${keys[0]}:${JSON.stringify(inner)}`;
  }
  return JSON.stringify(where);
}

class FakeDelegate implements SeedDelegate {
  readonly store = new Map<string, Stored>();
  /** Counts every upsert call (not just inserts) so tests can assert apply
   *  ran. `inserts` counts only create-path upserts. */
  upsertCalls = 0;
  inserts = 0;
  updates = 0;
  deleteManyCalls = 0;

  /** Optional override so `count` can return a scripted number (the guard
   *  test drives the "looks like prod" path through here). */
  countOverride: number | null = null;

  async upsert(args: {
    where: Record<string, unknown>;
    create: Record<string, unknown>;
    update: Record<string, unknown>;
  }): Promise<unknown> {
    this.upsertCalls += 1;
    const identity = identityOf(args.where);
    const existing = this.store.get(identity);
    if (existing) {
      this.updates += 1;
      existing.row = { ...existing.row, ...args.update };
      return existing.row;
    }
    this.inserts += 1;
    const row = { ...args.create };
    this.store.set(identity, { identity, row });
    return row;
  }

  async deleteMany(args: { where: Record<string, unknown> }): Promise<unknown> {
    this.deleteManyCalls += 1;
    const identity = identityOf(args.where);
    let count = 0;
    if (this.store.delete(identity)) count = 1;
    return { count };
  }

  async count(): Promise<number> {
    return this.countOverride ?? this.store.size;
  }

  /** Convenience for assertions. */
  rows(): Record<string, unknown>[] {
    return [...this.store.values()].map((s) => s.row);
  }
}

export class FakeSeedClient implements SeedClient {
  user = new FakeDelegate();
  workspace = new FakeDelegate();
  membership = new FakeDelegate();
  onboardingState = new FakeDelegate();
  workspacePreference = new FakeDelegate();
  integrationCredential = new FakeDelegate();
  workApprovalQueueItem = new FakeDelegate();
  workspaceBriefing = new FakeDelegate();

  /** Script the non-test workspace count the guard sees (it calls
   *  `workspace.count`). */
  setExistingWorkspaceCount(n: number): void {
    this.workspace.countOverride = n;
  }
}

/** Deterministic crypto stand-in for offline tests — no ENCRYPTION_KEY needed.
 *  Wraps the value so tests can confirm "the seed encrypted before writing"
 *  without depending on the real AES key being present in env. */
export const FAKE_CRYPTO = {
  encryptPayload: (payload: unknown) => ({ enc: `fake:${JSON.stringify(payload)}` }),
  encryptString: (plaintext: string) => `fake:${plaintext}`,
};
