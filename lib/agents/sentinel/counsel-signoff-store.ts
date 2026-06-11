/**
 * lib/agents/sentinel/counsel-signoff-store.ts
 *
 * In-memory `CounselSignoffStore` — the test peer of
 * `PrismaCounselSignoffStore` (two-implementation rule,
 * `feedback_runner_portability.md`). Also usable as a degraded default in
 * environments without a DB, where it returns "no row" for every vertical →
 * the gate fails closed.
 */

import type {
  CounselSignoff,
  CounselSignoffStore,
  RecordSignoffInput,
} from "./counsel-signoff";

export class InMemoryCounselSignoffStore implements CounselSignoffStore {
  readonly name = "in-memory" as const;
  private readonly rows = new Map<string, CounselSignoff>();

  /** Optional `throwOnGet` makes `get` throw — used to prove the gate fails
   *  closed on a store error. */
  constructor(
    seed: CounselSignoff[] = [],
    private readonly opts: { throwOnGet?: boolean } = {},
  ) {
    for (const s of seed) this.rows.set(s.verticalSlug, s);
  }

  async get(verticalSlug: string): Promise<CounselSignoff | null> {
    if (this.opts.throwOnGet) throw new Error("store unreachable (test)");
    return this.rows.get(verticalSlug) ?? null;
  }

  async list(): Promise<CounselSignoff[]> {
    return [...this.rows.values()];
  }

  async record(input: RecordSignoffInput): Promise<CounselSignoff> {
    const now = new Date();
    const row: CounselSignoff = {
      verticalSlug: input.verticalSlug,
      signedAt: input.signedAt,
      revokedAt: null, // recording always clears revocation
      artifactRef: input.artifactRef ?? null,
      signedByEmail: input.signedByEmail ?? null,
      signedByUserId: input.signedByUserId ?? null,
      note: input.note ?? null,
      updatedAt: now,
    };
    this.rows.set(input.verticalSlug, row);
    return row;
  }

  async revoke(
    verticalSlug: string,
    _actor: { email?: string | null; userId?: string | null },
  ): Promise<CounselSignoff | null> {
    const existing = this.rows.get(verticalSlug);
    if (!existing) return null;
    const updated: CounselSignoff = {
      ...existing,
      revokedAt: new Date(),
      updatedAt: new Date(),
    };
    this.rows.set(verticalSlug, updated);
    return updated;
  }
}
