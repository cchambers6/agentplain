/**
 * tests/fixtures/_install-fake-webhook-prisma.ts
 *
 * Side-effect setup module for `tests/webhook-idempotency.test.ts`.
 *
 * The prisma singleton in `lib/db/prisma.ts` reads a pre-existing
 * `globalThis.__agentplainPrisma` if one is set. This file installs a
 * minimal stub on the global BEFORE the production `prisma` binding is
 * evaluated, so `withSystemContext` (which uses the singleton) calls
 * INTO this fake instead of constructing a real PrismaClient.
 *
 * Import this module as a side-effect import FIRST in the test file so
 * its top-level code runs before any transitive load of `lib/db/prisma`.
 * ES/TS imports are evaluated in source order — the install happens
 * before `lib/integrations/webhook-idempotency` evaluates.
 *
 * Honesty note: this is a structural mock. It records `$transaction`
 * invocations and lets tests script `webhookEvent.create` to throw a
 * fake P2002. It DOES NOT model Postgres' transaction-abort semantics
 * (SQLSTATE 25P02) — a real DB would reject the next statement after a
 * uniqueness violation inside the same tx, and this mock does not. The
 * regression we're guarding (a single-tx idempotency path) therefore
 * cannot be reproduced end-to-end in unit tests; the value here is in
 * pinning the STRUCTURE (two separate $transaction calls on the dupe
 * path) so a future refactor can't silently re-nest them.
 */

interface RecordedTx {
  ops: string[];
  threw: boolean;
}

interface CreateArgs {
  data: {
    subscriptionId: string;
    workspaceId: string;
    rawPayload: unknown;
    dedupeKey?: string;
    processed: boolean;
  };
  select?: { id: true };
}

interface FindUniqueArgs {
  where: {
    subscriptionId_dedupeKey: { subscriptionId: string; dedupeKey: string };
  };
  select?: { id: true };
}

export interface FakeWebhookPrismaState {
  txInvocations: RecordedTx[];
  /** If 'p2002', the NEXT `webhookEvent.create` throws a fake P2002. */
  nextCreateBehavior: 'success' | 'p2002';
  /** id returned by webhookEvent.findUnique on the dupe path. */
  existingId: string;
  /** id returned by a successful webhookEvent.create. */
  createdId: string;
  /** Captured args for asserting wiring (workspaceId, dedupeKey, ...). */
  lastCreateArgs: CreateArgs | null;
  lastFindUniqueArgs: FindUniqueArgs | null;
  /** If true, the find on the dupe path returns null (transient case). */
  findReturnsNull: boolean;
}

export const fakeWebhookPrismaState: FakeWebhookPrismaState = {
  txInvocations: [],
  nextCreateBehavior: 'success',
  existingId: 'we_existing_fixture',
  createdId: 'we_created_fixture',
  lastCreateArgs: null,
  lastFindUniqueArgs: null,
  findReturnsNull: false,
};

export function resetFakeWebhookPrismaState(): void {
  fakeWebhookPrismaState.txInvocations.length = 0;
  fakeWebhookPrismaState.nextCreateBehavior = 'success';
  fakeWebhookPrismaState.existingId = 'we_existing_fixture';
  fakeWebhookPrismaState.createdId = 'we_created_fixture';
  fakeWebhookPrismaState.lastCreateArgs = null;
  fakeWebhookPrismaState.lastFindUniqueArgs = null;
  fakeWebhookPrismaState.findReturnsNull = false;
}

const fakePrisma = {
  async $transaction<T>(cb: (tx: unknown) => Promise<T>): Promise<T> {
    const recorded: RecordedTx = { ops: [], threw: false };
    const tx = {
      $executeRawUnsafe: async (): Promise<number> => {
        recorded.ops.push('set_config');
        return 0;
      },
      webhookEvent: {
        create: async (args: CreateArgs): Promise<{ id: string }> => {
          recorded.ops.push('create');
          fakeWebhookPrismaState.lastCreateArgs = args;
          if (fakeWebhookPrismaState.nextCreateBehavior === 'p2002') {
            const err = new Error('Unique constraint failed on the fields: (`subscriptionId`,`dedupeKey`)');
            (err as unknown as { code: string }).code = 'P2002';
            throw err;
          }
          return { id: fakeWebhookPrismaState.createdId };
        },
        findUnique: async (
          args: FindUniqueArgs,
        ): Promise<{ id: string } | null> => {
          recorded.ops.push('findUnique');
          fakeWebhookPrismaState.lastFindUniqueArgs = args;
          if (fakeWebhookPrismaState.findReturnsNull) return null;
          return { id: fakeWebhookPrismaState.existingId };
        },
      },
    };
    try {
      const result = await cb(tx);
      fakeWebhookPrismaState.txInvocations.push(recorded);
      return result;
    } catch (err) {
      recorded.threw = true;
      fakeWebhookPrismaState.txInvocations.push(recorded);
      throw err;
    }
  },
};

(globalThis as { __agentplainPrisma?: unknown }).__agentplainPrisma = fakePrisma;
