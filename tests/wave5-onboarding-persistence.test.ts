/**
 * tests/wave5-onboarding-persistence.test.ts
 *
 * Wave-5 integration test: onboarding persistence contract.
 *
 * What this covers (without a live DB):
 *   - The onboarding state machine advances workspace → set_preferences → done
 *     and `nextStepAfter` agrees with `STEP_ORDER` at every transition.
 *   - The `set_preferences` write goes through `withRls(ctx, ...)` so the
 *     workspace context is asserted on every transaction. The fake Prisma
 *     client records the `set_config('app.workspace_id', ...)` call so we
 *     can prove the right workspace id reaches the GUC.
 *   - `WorkspacePreference` upsert is idempotent — running the same form
 *     twice produces a single row.
 *   - `PreferenceSignal` is append-only — every onboarding submission adds
 *     a row, never overwrites.
 *   - The fake client tracks calls per workspace; running two parallel
 *     onboarding flows for two workspaces does not cross-contaminate.
 *
 * What this CANNOT cover without a live Postgres:
 *   - That the RLS policies in 20260523*_phase1_init/migration.sql actually
 *     deny cross-tenant reads. Those policies are SQL-enforced; this test
 *     pins the application-layer contract above them.
 *   - That `upsertOnboardingPreference` (which calls `withRls` without a
 *     client override) actually issues the upsert. The store wires to the
 *     real `prisma` singleton, so we exercise the same SHAPE here against
 *     the fake client instead.
 *
 * Per `feedback_cold_start_safe_agents.md`: every fire reads durable state.
 * Per `project_no_outbound_architecture.md`: no outbound from onboarding.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  STEP_ORDER,
  STEP_META,
  isStepId,
  nextStepAfter,
  type StepId,
} from '@/lib/onboarding/steps';
import { withRls, type RlsContext } from '@/lib/db/rls';
import { onboardingPreferencesSchema } from '@/lib/preferences/types';
import { FakePrismaClient } from './fixtures/_fake-prisma';
import type { PrismaClient } from '@prisma/client';

const WORKSPACE_A = {
  id: 'aaaa1111-2222-3333-4444-555555555555',
  slug: 'wave5-onboard-a',
  name: 'Wave5 Onboard A',
  vertical: 'REAL_ESTATE',
};

const WORKSPACE_B = {
  id: 'bbbb1111-2222-3333-4444-666666666666',
  slug: 'wave5-onboard-b',
  name: 'Wave5 Onboard B',
  vertical: 'CPA',
};

function asPrismaClient(fake: FakePrismaClient): PrismaClient {
  return fake as unknown as PrismaClient;
}

describe('wave5 onboarding — state machine end-to-end', () => {
  it('walks confirm_details → connect_integration → set_preferences → done', () => {
    let step: StepId = 'confirm_details';
    const visited: StepId[] = [step];
    while (step !== 'done') {
      step = nextStepAfter(step);
      visited.push(step);
    }
    assert.deepEqual(visited, STEP_ORDER);
    for (const s of STEP_ORDER) {
      assert.ok(isStepId(s));
      assert.ok(STEP_META[s].label.length > 0);
    }
  });

  it('the set_preferences form schema accepts a well-formed payload', () => {
    const parsed = onboardingPreferencesSchema.safeParse({
      draftingTone: 'plain',
      categorizationNotes: 'treat anything from cl-co.example as a vendor email',
      calendarWindow: '9-5 weekdays',
    });
    assert.equal(parsed.success, true);
  });

  it('the set_preferences form schema rejects a malformed tone', () => {
    const parsed = onboardingPreferencesSchema.safeParse({
      draftingTone: 'wildly-wrong-tone',
    });
    assert.equal(parsed.success, false);
  });
});

describe('wave5 onboarding — persistence contract (fake-prisma)', () => {
  // Mirrors the SHAPE of advanceOnboardingAction's set_preferences branch.
  // The real action calls upsertOnboardingPreference + recordPreferenceSignal
  // which both go through withRls with the real prisma singleton; we run
  // the same tx operations against a fake client so the contract is pinned.
  async function persistOnboardingPrefs(
    ctx: RlsContext,
    client: PrismaClient,
    args: {
      workspaceId: string;
      draftingTone: string;
      categorizationNotes: string;
      calendarWindow: string;
    },
  ): Promise<void> {
    await withRls(
      ctx,
      async (tx) => {
        await tx.workspacePreference.upsert({
          where: { workspaceId: args.workspaceId },
          create: {
            workspaceId: args.workspaceId,
            draftingTone: args.draftingTone,
            categorizationNotes: args.categorizationNotes,
            calendarWindow: args.calendarWindow,
          },
          update: {
            draftingTone: args.draftingTone,
            categorizationNotes: args.categorizationNotes,
            calendarWindow: args.calendarWindow,
          },
        });
        const axes: Array<[string, string]> = [
          ['tone', args.draftingTone],
          ['categorization', args.categorizationNotes],
          ['calendar', args.calendarWindow],
        ];
        for (const [kind, value] of axes) {
          if (!value || value.trim().length === 0) continue;
          await tx.preferenceSignal.create({
            data: {
              workspaceId: args.workspaceId,
              source: 'ONBOARDING_FORM',
              kind,
              text: value,
            },
          });
        }
      },
      { client },
    );
  }

  it('set_preferences persistence creates one WorkspacePreference + one signal per axis', async () => {
    const fake = new FakePrismaClient();
    fake.seedWorkspace({ id: WORKSPACE_A.id, slug: WORKSPACE_A.slug });
    const ctx: RlsContext = {
      userId: 'user-a',
      workspaceId: WORKSPACE_A.id,
      isOperator: false,
    };

    await persistOnboardingPrefs(ctx, asPrismaClient(fake), {
      workspaceId: WORKSPACE_A.id,
      draftingTone: 'plain',
      categorizationNotes: 'treat pre-approved-buyer language as hot',
      calendarWindow: '8-7 + Sat AM',
    });

    assert.equal(fake.workspacePreferences.length, 1);
    assert.equal(fake.workspacePreferences[0].workspaceId, WORKSPACE_A.id);
    assert.equal(fake.workspacePreferences[0].draftingTone, 'plain');
    assert.equal(fake.preferenceSignals.length, 3);
    const kinds = new Set(fake.preferenceSignals.map((s) => s.kind));
    assert.deepEqual(kinds, new Set(['tone', 'categorization', 'calendar']));

    // GUC was set with the right workspace_id (RLS plumbing pinned).
    assert.equal(fake.rlsCalls.length, 1);
    assert.equal(fake.rlsCalls[0].workspaceId, WORKSPACE_A.id);
    assert.equal(fake.rlsCalls[0].userId, 'user-a');
    assert.equal(fake.rlsCalls[0].isOperator, 'false');
  });

  it('idempotent: running the form twice keeps a single WorkspacePreference row', async () => {
    const fake = new FakePrismaClient();
    fake.seedWorkspace({ id: WORKSPACE_A.id, slug: WORKSPACE_A.slug });
    const ctx: RlsContext = {
      userId: 'user-a',
      workspaceId: WORKSPACE_A.id,
      isOperator: false,
    };
    const payload = {
      workspaceId: WORKSPACE_A.id,
      draftingTone: 'plain',
      categorizationNotes: 'baseline',
      calendarWindow: '9-5 weekdays',
    };
    await persistOnboardingPrefs(ctx, asPrismaClient(fake), payload);
    await persistOnboardingPrefs(ctx, asPrismaClient(fake), {
      ...payload,
      draftingTone: 'warm',
    });
    assert.equal(
      fake.workspacePreferences.length,
      1,
      'second submission must upsert, not duplicate',
    );
    assert.equal(fake.workspacePreferences[0].draftingTone, 'warm');
    // PreferenceSignal is append-only — two submissions × 3 axes = 6 rows.
    assert.equal(fake.preferenceSignals.length, 6);
  });

  it('per-workspace isolation: two parallel onboarding flows do not cross-contaminate', async () => {
    const fake = new FakePrismaClient();
    fake.seedWorkspace({ id: WORKSPACE_A.id, slug: WORKSPACE_A.slug });
    fake.seedWorkspace({ id: WORKSPACE_B.id, slug: WORKSPACE_B.slug, vertical: 'CPA' });
    await Promise.all([
      persistOnboardingPrefs(
        { userId: 'user-a', workspaceId: WORKSPACE_A.id, isOperator: false },
        asPrismaClient(fake),
        {
          workspaceId: WORKSPACE_A.id,
          draftingTone: 'plain',
          categorizationNotes: 'A: realty notes',
          calendarWindow: '8-7 + Sat AM',
        },
      ),
      persistOnboardingPrefs(
        { userId: 'user-b', workspaceId: WORKSPACE_B.id, isOperator: false },
        asPrismaClient(fake),
        {
          workspaceId: WORKSPACE_B.id,
          draftingTone: 'formal',
          categorizationNotes: 'B: cpa notes',
          calendarWindow: '9-5 weekdays',
        },
      ),
    ]);

    assert.equal(fake.workspacePreferences.length, 2);
    const a = fake.workspacePreferences.find((r) => r.workspaceId === WORKSPACE_A.id)!;
    const b = fake.workspacePreferences.find((r) => r.workspaceId === WORKSPACE_B.id)!;
    assert.equal(a.draftingTone, 'plain');
    assert.equal(b.draftingTone, 'formal');
    assert.match(a.categorizationNotes ?? '', /realty/);
    assert.match(b.categorizationNotes ?? '', /cpa/);

    // Every signal in workspace A's slice references A, never B (and vice
    // versa). This is the application-layer half of multi-tenant isolation;
    // the RLS policy is the SQL-layer half (asserted live in CI smoke).
    const aSignals = fake.preferenceSignals.filter((s) => s.workspaceId === WORKSPACE_A.id);
    const bSignals = fake.preferenceSignals.filter((s) => s.workspaceId === WORKSPACE_B.id);
    assert.equal(aSignals.length, 3);
    assert.equal(bSignals.length, 3);
    for (const s of aSignals) assert.ok(!s.text.includes('cpa'));
    for (const s of bSignals) assert.ok(!s.text.includes('realty'));

    // GUC set twice — once per workspace, with no leakage.
    const wsIds = fake.rlsCalls.map((r) => r.workspaceId).sort();
    assert.deepEqual(wsIds, [WORKSPACE_A.id, WORKSPACE_B.id].sort());
  });
});
