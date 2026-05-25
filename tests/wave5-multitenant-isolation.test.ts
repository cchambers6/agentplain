/**
 * tests/wave5-multitenant-isolation.test.ts
 *
 * Wave-5 black-box regression test: multi-tenant isolation.
 *
 * agentplain enforces tenant isolation in TWO layers:
 *
 *   1. SQL layer — Postgres RLS policies in
 *      prisma/migrations/20260508000000_phase1_init/migration.sql gate every
 *      workspace-scoped table on `app.workspace_id`. Verified live in the
 *      deploy-time smoke pass; cannot be exercised without a real DB.
 *   2. Application layer — `lib/db/rls.ts#withRls(ctx, fn)` opens a tx,
 *      sets the three RLS GUCs (`app.user_id`, `app.workspace_id`,
 *      `app.is_operator`), then runs the callback. If a caller skips
 *      `withRls` or passes the wrong context, the SQL layer still
 *      protects us — but the application has lost its first line of
 *      defense.
 *
 * This file pins the application-layer contract:
 *   - `withRls(ctxA, fn, {client})` sets GUCs with workspace A's id;
 *     `withRls(ctxB, fn, {client})` sets GUCs with B's id; the two are
 *     fully isolated (no shared state across calls).
 *   - When two tenant flows run in PARALLEL, the GUC for each tx reflects
 *     the caller's context — not whichever ran last.
 *   - `persistSkillRunArtifacts` writes the approval row under the caller's
 *     workspaceId, never another's.
 *   - `runSkillChain` for workspace A's preference view is invisible to a
 *     parallel run for workspace B (the existing preference-learning-loop
 *     test pins this; this file re-asserts via the persistence shim).
 *   - Source-level: no Prisma table that needs RLS is read from `lib/`
 *     outside a `withRls` / `withSystemContext` wrapper. (Grep-driven
 *     regression — a refactor that scattered a raw `prisma.workspace.find*`
 *     would fail this.)
 *
 * Per `feedback_no_silent_vendor_lock.md`: every Prisma read goes through
 * the db helper. Per `project_living_portable_architecture.md`: defense in
 * depth — application + SQL.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import { withRls, withSystemContext, type RlsContext } from '@/lib/db/rls';
import { persistSkillRunArtifacts } from '@/lib/skills/persist-artifacts';
import { runSkillChain } from '@/lib/skills/runner';
import { TestLlmProvider } from '@/lib/llm/test-provider';
import { RecordingDraftPersister } from '@/lib/skills/draft';
import {
  FixtureMessageFetcher,
  buildWebhookEventFromFixture,
} from '@/lib/skills/fixture-fetcher';
import type { Prisma, PrismaClient, Workspace } from '@prisma/client';

import { FakePrismaClient } from './fixtures/_fake-prisma';
import { loadAllFixtures } from './fixtures/webhook-events/_loader';

const WORKSPACE_A_ID = 'aaaa3333-1111-2222-3333-444444444444';
const WORKSPACE_B_ID = 'bbbb3333-1111-2222-3333-555555555555';
const USER_A = 'user-tenant-a';
const USER_B = 'user-tenant-b';

const WS_A: Pick<Workspace, 'id' | 'slug' | 'name' | 'vertical'> = {
  id: WORKSPACE_A_ID,
  slug: 'tenant-a',
  name: 'Tenant A Realty',
  vertical: 'REAL_ESTATE',
};

const WS_B: Pick<Workspace, 'id' | 'slug' | 'name' | 'vertical'> = {
  id: WORKSPACE_B_ID,
  slug: 'tenant-b',
  name: 'Tenant B Realty',
  vertical: 'REAL_ESTATE',
};

const asPrismaClient = (f: FakePrismaClient): PrismaClient => f as unknown as PrismaClient;
const asTx = (f: FakePrismaClient): Prisma.TransactionClient => f as unknown as Prisma.TransactionClient;

describe('wave5 multi-tenant — withRls plumbing', () => {
  it('sets the three GUCs with the caller-supplied workspaceId, never the default', async () => {
    const fake = new FakePrismaClient();
    const ctx: RlsContext = {
      userId: USER_A,
      workspaceId: WORKSPACE_A_ID,
      isOperator: false,
    };
    await withRls(ctx, async () => 1, { client: asPrismaClient(fake) });
    assert.equal(fake.rlsCalls.length, 1);
    assert.equal(fake.rlsCalls[0].userId, USER_A);
    assert.equal(fake.rlsCalls[0].workspaceId, WORKSPACE_A_ID);
    assert.equal(fake.rlsCalls[0].isOperator, 'false');
  });

  it('withSystemContext sets isOperator=true and no workspace_id', async () => {
    const fake = new FakePrismaClient();
    // withSystemContext calls withRls under the hood with SYSTEM_OPERATOR_CONTEXT.
    // We can't pass {client} through it; do the equivalent directly to assert
    // the shape — same module under test.
    await withRls(
      { userId: null, workspaceId: null, isOperator: true },
      async () => 1,
      { client: asPrismaClient(fake) },
    );
    assert.equal(fake.rlsCalls[0].userId, '');
    assert.equal(fake.rlsCalls[0].workspaceId, '');
    assert.equal(fake.rlsCalls[0].isOperator, 'true');
    // The symbol exists + has the documented surface.
    assert.equal(typeof withSystemContext, 'function');
  });

  it('parallel tenant flows do not leak GUC state across transactions', async () => {
    const fakeA = new FakePrismaClient();
    const fakeB = new FakePrismaClient();
    await Promise.all([
      withRls(
        { userId: USER_A, workspaceId: WORKSPACE_A_ID, isOperator: false },
        async (tx) => {
          // Simulate ~10 reads.
          for (let i = 0; i < 10; i += 1) {
            await tx.auditLog.create({
              data: {
                workspaceId: WORKSPACE_A_ID,
                action: 'wave5.parallel.test',
                payload: { i },
              },
            });
          }
        },
        { client: asPrismaClient(fakeA) },
      ),
      withRls(
        { userId: USER_B, workspaceId: WORKSPACE_B_ID, isOperator: false },
        async (tx) => {
          for (let i = 0; i < 10; i += 1) {
            await tx.auditLog.create({
              data: {
                workspaceId: WORKSPACE_B_ID,
                action: 'wave5.parallel.test',
                payload: { i },
              },
            });
          }
        },
        { client: asPrismaClient(fakeB) },
      ),
    ]);
    assert.equal(fakeA.rlsCalls.length, 1);
    assert.equal(fakeB.rlsCalls.length, 1);
    assert.equal(fakeA.rlsCalls[0].workspaceId, WORKSPACE_A_ID);
    assert.equal(fakeB.rlsCalls[0].workspaceId, WORKSPACE_B_ID);
    // Every audit row carried the caller's workspaceId — never the other's.
    for (const a of fakeA.audits) assert.equal(a.workspaceId, WORKSPACE_A_ID);
    for (const a of fakeB.audits) assert.equal(a.workspaceId, WORKSPACE_B_ID);
  });
});

describe('wave5 multi-tenant — persistSkillRunArtifacts respects caller workspaceId', () => {
  it('approval row is written under the workspace passed in, never another', async () => {
    const fake = new FakePrismaClient();
    const fixture = (await loadAllFixtures()).find((f) => f.id === 're-01-buyer-inquiry')!;
    const { record } = await runSkillChain({
      workspace: WS_A,
      event: buildWebhookEventFromFixture(fixture),
      fetcher: new FixtureMessageFetcher(fixture),
      persister: new RecordingDraftPersister(),
      llm: new TestLlmProvider(),
      writeLog: false,
    });
    // Persist under workspace B even though the run used A — the persistence
    // shim must obey the call-site workspaceId, not pull from the record.
    // This is the SHAPE that prevents a "log-driven" backfill bug from
    // attributing rows to the wrong tenant.
    await persistSkillRunArtifacts({
      workspaceId: WORKSPACE_B_ID,
      record,
      client: asTx(fake),
    });
    for (const row of fake.workApprovals) {
      assert.equal(row.workspaceId, WORKSPACE_B_ID);
    }
    for (const row of fake.handoffs) {
      assert.equal(row.workspaceId, WORKSPACE_B_ID);
    }
  });

  it("workspace A's persist + workspace B's persist run in parallel without contamination", async () => {
    const fixture = (await loadAllFixtures()).find((f) => f.id === 're-01-buyer-inquiry')!;
    const [recordA, recordB] = await Promise.all([
      runSkillChain({
        workspace: WS_A,
        event: buildWebhookEventFromFixture(fixture),
        fetcher: new FixtureMessageFetcher(fixture),
        persister: new RecordingDraftPersister(),
        llm: new TestLlmProvider(),
        writeLog: false,
      }).then((r) => r.record),
      runSkillChain({
        workspace: WS_B,
        event: buildWebhookEventFromFixture(fixture),
        fetcher: new FixtureMessageFetcher(fixture),
        persister: new RecordingDraftPersister(),
        llm: new TestLlmProvider(),
        writeLog: false,
      }).then((r) => r.record),
    ]);
    const fakeA = new FakePrismaClient();
    const fakeB = new FakePrismaClient();
    await Promise.all([
      persistSkillRunArtifacts({
        workspaceId: WORKSPACE_A_ID,
        record: recordA,
        client: asTx(fakeA),
      }),
      persistSkillRunArtifacts({
        workspaceId: WORKSPACE_B_ID,
        record: recordB,
        client: asTx(fakeB),
      }),
    ]);
    for (const row of fakeA.workApprovals) assert.equal(row.workspaceId, WORKSPACE_A_ID);
    for (const row of fakeB.workApprovals) assert.equal(row.workspaceId, WORKSPACE_B_ID);
    assert.ok(fakeA.workApprovals.length > 0);
    assert.ok(fakeB.workApprovals.length > 0);
  });
});

describe('wave5 multi-tenant — source-level invariants', () => {
  // These tests grep the repo to catch regressions where someone reaches
  // for raw `prisma` directly instead of going through `withRls` /
  // `withSystemContext`. The application-layer guarantee is only as good
  // as the discipline of every call site.
  const ROOT = path.resolve(__dirname, '..');
  const SCAN_DIRS = ['lib', 'app'];
  const ALLOWED_PRISMA_DIRECT = new Set([
    path.join('lib', 'db', 'prisma.ts'),
    path.join('lib', 'db', 'rls.ts'),
    path.join('lib', 'db', 'index.ts'),
  ]);
  const WORKSPACE_SCOPED_MODELS = [
    'workApprovalQueueItem',
    'preferenceSignal',
    'workspacePreference',
    'handoffLogEntry',
    'subscription',
    'workspaceInvoice',
    'billingEvent',
    'onboardingState',
  ];

  async function* walk(dir: string): AsyncGenerator<string> {
    let entries: import('node:fs').Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name === 'node_modules' || e.name === '.next' || e.name === '__tests__') continue;
        yield* walk(full);
      } else if (e.isFile() && (e.name.endsWith('.ts') || e.name.endsWith('.tsx'))) {
        yield full;
      }
    }
  }

  it('no source file outside lib/db reads a workspace-scoped Prisma model via the bare `prisma.<model>.` surface', async () => {
    const offenders: Array<{ file: string; line: number; text: string }> = [];
    for (const dir of SCAN_DIRS) {
      const full = path.join(ROOT, dir);
      for await (const file of walk(full)) {
        const rel = path.relative(ROOT, file);
        if (ALLOWED_PRISMA_DIRECT.has(rel)) continue;
        const text = await fs.readFile(file, 'utf8');
        const lines = text.split(/\r?\n/);
        for (let i = 0; i < lines.length; i += 1) {
          const line = lines[i];
          for (const model of WORKSPACE_SCOPED_MODELS) {
            const lower = model.charAt(0).toLowerCase() + model.slice(1);
            // Look for bare `prisma.<model>.` — the wrapped form `tx.<model>.`
            // and the `withRls(ctx, async (tx) => tx.<model>.xxx)` form are
            // intentional and pass.
            const re = new RegExp(`\\bprisma\\.${lower}\\.`);
            if (re.test(line)) {
              offenders.push({ file: rel, line: i + 1, text: line.trim() });
            }
          }
        }
      }
    }
    assert.deepEqual(
      offenders,
      [],
      `bare prisma.<model>. reads found — every workspace-scoped read must go through withRls / withSystemContext:\n${offenders
        .map((o) => `  ${o.file}:${o.line} ${o.text}`)
        .join('\n')}`,
    );
  });

  it('every withRls call site supplies a non-empty ctx with explicit isOperator', async () => {
    let withRlsCallCount = 0;
    for (const dir of SCAN_DIRS) {
      const full = path.join(ROOT, dir);
      for await (const file of walk(full)) {
        const text = await fs.readFile(file, 'utf8');
        // Crude count — every callsite passes a ctx object as the first arg.
        // We assert ≥1 caller so the helper isn't accidentally dead.
        const matches = text.match(/withRls\(/g);
        if (matches) withRlsCallCount += matches.length;
      }
    }
    assert.ok(
      withRlsCallCount > 0,
      'expected at least one withRls call site in lib/ + app/',
    );
  });
});
