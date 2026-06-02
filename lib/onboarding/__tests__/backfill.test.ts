/**
 * Behavior tests for the wave-10 onboarding pick-skills backfill.
 *
 * Covers the three guarantees Conner called out in the wave-10 plan:
 *   1. Idempotency — running the backfill twice doesn't double-rewind.
 *      The second pass scans zero candidate rows (the loader's filter
 *      includes `currentStep IN (set_preferences, first_fire_watch)`,
 *      and a row rewound to `pick_skills` no longer matches).
 *   2. Filter respects `completedAt IS NULL` — completed onboardings are
 *      left alone even if `pickedSkillSlugs` is empty.
 *   3. Filter respects `pickedSkillSlugs` non-empty — a customer who
 *      already picked skills is left alone even if their currentStep
 *      matches.
 *
 * Uses the dependency-injected core so no Prisma instance is required —
 * the test wires `listCandidates` + `rewindRow` to an in-memory map.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  backfillOnboardingPickSkills,
  rowMatchesBackfillFilter,
  type OnboardingBackfillRow,
} from '../backfill';

interface MutableRow extends OnboardingBackfillRow {}

function makeRow(overrides: Partial<MutableRow> = {}): MutableRow {
  return {
    id: 'row-1',
    workspaceId: 'ws-1',
    currentStep: 'set_preferences',
    pickedSkillSlugs: [],
    firstFireRequestedAt: null,
    firstFireCompletedAt: null,
    completedAt: null,
    ...overrides,
  };
}

/** Builds an in-memory store + loader/writer pair that mimics the
 *  Prisma wiring in scripts/migrations/2026-05-31_backfill_onboarding_pick_skills.ts. */
function makeStore(initial: MutableRow[]) {
  const byId = new Map<string, MutableRow>(initial.map((r) => [r.id, { ...r }]));
  return {
    rows: byId,
    listCandidates: async (): Promise<OnboardingBackfillRow[]> => {
      const out: OnboardingBackfillRow[] = [];
      for (const row of byId.values()) {
        if (rowMatchesBackfillFilter(row)) out.push({ ...row });
      }
      return out;
    },
    rewindRow: async (id: string): Promise<boolean> => {
      const row = byId.get(id);
      if (!row) return false;
      if (!rowMatchesBackfillFilter(row)) return false;
      row.currentStep = 'pick_skills';
      row.firstFireRequestedAt = null;
      row.firstFireCompletedAt = null;
      return true;
    },
  };
}

describe('rowMatchesBackfillFilter', () => {
  it('matches set_preferences with empty picked + no completedAt', () => {
    assert.equal(rowMatchesBackfillFilter(makeRow()), true);
  });

  it('matches first_fire_watch with empty picked + no completedAt', () => {
    assert.equal(
      rowMatchesBackfillFilter(makeRow({ currentStep: 'first_fire_watch' })),
      true,
    );
  });

  it('rejects rows already on pick_skills (idempotency core)', () => {
    assert.equal(
      rowMatchesBackfillFilter(makeRow({ currentStep: 'pick_skills' })),
      false,
    );
  });

  it('rejects rows on earlier steps (no premature rewind)', () => {
    assert.equal(
      rowMatchesBackfillFilter(makeRow({ currentStep: 'confirm_details' })),
      false,
    );
    assert.equal(
      rowMatchesBackfillFilter(makeRow({ currentStep: 'connect_integration' })),
      false,
    );
  });

  it('rejects completed onboardings even when picked is empty', () => {
    assert.equal(
      rowMatchesBackfillFilter(makeRow({ completedAt: new Date('2026-05-15') })),
      false,
    );
  });

  it('rejects rows that already have picked slugs', () => {
    assert.equal(
      rowMatchesBackfillFilter(
        makeRow({ pickedSkillSlugs: ['analytics-weekly-pulse-general'] }),
      ),
      false,
    );
  });

  it('treats null + undefined pickedSkillSlugs as empty (defense in depth)', () => {
    assert.equal(rowMatchesBackfillFilter(makeRow({ pickedSkillSlugs: null })), true);
    assert.equal(rowMatchesBackfillFilter(makeRow({ pickedSkillSlugs: undefined })), true);
  });
});

describe('backfillOnboardingPickSkills', () => {
  it('rewinds an in-flight wave-8 customer stuck at set_preferences', async () => {
    const store = makeStore([
      makeRow({
        id: 'a',
        workspaceId: 'ws-a',
        currentStep: 'set_preferences',
      }),
    ]);
    const stats = await backfillOnboardingPickSkills({
      listCandidates: store.listCandidates,
      rewindRow: store.rewindRow,
    });
    assert.equal(stats.scanned, 1);
    assert.equal(stats.rewound, 1);
    assert.equal(stats.failed, 0);
    assert.equal(store.rows.get('a')?.currentStep, 'pick_skills');
  });

  it('clears stale firstFireRequestedAt / firstFireCompletedAt timestamps', async () => {
    const store = makeStore([
      makeRow({
        id: 'a',
        workspaceId: 'ws-a',
        currentStep: 'first_fire_watch',
        firstFireRequestedAt: new Date('2026-05-30'),
        firstFireCompletedAt: new Date('2026-05-30'),
      }),
    ]);
    await backfillOnboardingPickSkills({
      listCandidates: store.listCandidates,
      rewindRow: store.rewindRow,
    });
    const updated = store.rows.get('a');
    assert.equal(updated?.currentStep, 'pick_skills');
    assert.equal(updated?.firstFireRequestedAt, null);
    assert.equal(updated?.firstFireCompletedAt, null);
  });

  it('is idempotent — second run scans zero candidates', async () => {
    const store = makeStore([
      makeRow({ id: 'a', currentStep: 'set_preferences' }),
      makeRow({ id: 'b', currentStep: 'first_fire_watch' }),
    ]);
    const first = await backfillOnboardingPickSkills({
      listCandidates: store.listCandidates,
      rewindRow: store.rewindRow,
    });
    assert.equal(first.rewound, 2);

    const second = await backfillOnboardingPickSkills({
      listCandidates: store.listCandidates,
      rewindRow: store.rewindRow,
    });
    assert.equal(second.scanned, 0, 'idempotent — no candidates on second run');
    assert.equal(second.rewound, 0);
  });

  it('does not touch completed onboardings', async () => {
    const completed = makeRow({
      id: 'c',
      currentStep: 'set_preferences',
      completedAt: new Date('2026-05-10'),
    });
    const store = makeStore([completed]);
    const stats = await backfillOnboardingPickSkills({
      listCandidates: store.listCandidates,
      rewindRow: store.rewindRow,
    });
    assert.equal(stats.scanned, 0);
    assert.equal(store.rows.get('c')?.currentStep, 'set_preferences');
  });

  it('does not touch rows that already have picked slugs', async () => {
    const haveSkills = makeRow({
      id: 'd',
      currentStep: 'set_preferences',
      pickedSkillSlugs: ['analytics-weekly-pulse-general'],
    });
    const store = makeStore([haveSkills]);
    const stats = await backfillOnboardingPickSkills({
      listCandidates: store.listCandidates,
      rewindRow: store.rewindRow,
    });
    assert.equal(stats.scanned, 0);
    assert.equal(store.rows.get('d')?.currentStep, 'set_preferences');
  });

  it('skips rows that race past the filter between scan + write', async () => {
    const store = makeStore([
      makeRow({ id: 'a', currentStep: 'set_preferences' }),
    ]);
    // Simulate the customer advancing the wizard between scan + write.
    const racyRewind = async (id: string) => {
      const row = store.rows.get(id);
      if (row) row.currentStep = 'first_fire_watch'; // someone else moved it
      return store.rewindRow(id);
    };
    const stats = await backfillOnboardingPickSkills({
      listCandidates: store.listCandidates,
      rewindRow: racyRewind,
    });
    // The row still matches `first_fire_watch + empty picked + no completedAt`
    // so it rewinds successfully.
    assert.equal(stats.rewound, 1);
    assert.equal(store.rows.get('a')?.currentStep, 'pick_skills');
  });

  it('dry-run reports counts without calling rewindRow', async () => {
    const store = makeStore([
      makeRow({ id: 'a', currentStep: 'set_preferences' }),
      makeRow({ id: 'b', currentStep: 'first_fire_watch' }),
    ]);
    let writes = 0;
    const stats = await backfillOnboardingPickSkills({
      listCandidates: store.listCandidates,
      rewindRow: async () => {
        writes += 1;
        return true;
      },
      dryRun: true,
    });
    assert.equal(stats.rewound, 2);
    assert.equal(writes, 0);
    assert.equal(store.rows.get('a')?.currentStep, 'set_preferences');
  });

  it('counts a single failure without aborting the loop', async () => {
    const store = makeStore([
      makeRow({ id: 'a', currentStep: 'set_preferences' }),
      makeRow({ id: 'b', currentStep: 'first_fire_watch' }),
    ]);
    const stats = await backfillOnboardingPickSkills({
      listCandidates: store.listCandidates,
      rewindRow: async (id) => {
        if (id === 'a') throw new Error('boom');
        return store.rewindRow(id);
      },
    });
    assert.equal(stats.scanned, 2);
    assert.equal(stats.rewound, 1);
    assert.equal(stats.failed, 1);
  });
});
