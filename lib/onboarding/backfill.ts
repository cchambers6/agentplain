/**
 * lib/onboarding/backfill.ts
 *
 * Wave-10 phase-1 data backfill: rewind in-flight wave-8 customers to the
 * NEW `pick_skills` step so they pass through the wave-9 picker rather
 * than land on `first_fire_watch` with an empty `pickedSkillSlugs`
 * column. Without this, the first-fire dispatches with no slugs, no
 * skills run, and the watch panel renders the "No skills picked"
 * placeholder.
 *
 * Selection rules — every condition must hold:
 *   * `completedAt IS NULL`            (the customer hasn't finished)
 *   * `currentStep IN ('set_preferences', 'first_fire_watch')`
 *                                      (they're past the gap)
 *   * `pickedSkillSlugs` is empty `[]` (they never picked)
 *
 * Write rules — touch only these columns:
 *   * `currentStep = 'pick_skills'`
 *   * `firstFireRequestedAt = NULL`   (clear if set)
 *   * `firstFireCompletedAt = NULL`   (clear if set)
 *
 * Idempotent: a row already at `pick_skills` (or that has picked skills)
 * doesn't match the filter on the second run.
 *
 * Mirrors `lib/security/payload-crypto-backfill.ts` shape — dependency-
 * injected so the test in `lib/onboarding/__tests__/backfill.test.ts`
 * wires `listCandidates` + `rewindRow` to an in-memory fixture, and the
 * script in `scripts/migrations/2026-05-31_backfill_onboarding_pick_skills.ts`
 * wires them to Prisma + `withSystemContext`.
 */

export interface OnboardingBackfillRow {
  id: string;
  workspaceId: string;
  currentStep: string;
  pickedSkillSlugs: unknown;
  firstFireRequestedAt: Date | null;
  firstFireCompletedAt: Date | null;
  completedAt: Date | null;
}

export interface OnboardingBackfillStats {
  scanned: number;
  rewound: number;
  /** Rows the loader returned that no longer match the filter at write
   *  time (e.g. customer advanced between scan + write). The row is
   *  skipped without error. */
  raceSkipped: number;
  failed: number;
}

export interface OnboardingBackfillOptions {
  /** Returns the next page of candidate rows. The loader is responsible
   *  for applying the selection filter at the DB layer; this function
   *  re-checks every row before writing to defend against a race where
   *  the customer advances the wizard between scan + write. */
  listCandidates: () => Promise<OnboardingBackfillRow[]>;
  /** Writes the rewind. Returning false signals the row no longer
   *  matches and was skipped (race). */
  rewindRow: (id: string) => Promise<boolean>;
  dryRun?: boolean;
  log?: (line: string) => void;
}

/** Returns true when the row STILL matches the backfill filter at write
 *  time. Idempotency hinges on this — a row already rewound has
 *  `currentStep = 'pick_skills'` so the check rejects it and `rewindRow`
 *  is never called. */
export function rowMatchesBackfillFilter(row: OnboardingBackfillRow): boolean {
  if (row.completedAt !== null) return false;
  if (row.currentStep !== 'set_preferences' && row.currentStep !== 'first_fire_watch') {
    return false;
  }
  if (!isEmptyPickedSlugs(row.pickedSkillSlugs)) return false;
  return true;
}

function isEmptyPickedSlugs(raw: unknown): boolean {
  if (raw === null || raw === undefined) return true;
  if (Array.isArray(raw) && raw.length === 0) return true;
  return false;
}

export async function backfillOnboardingPickSkills(
  opts: OnboardingBackfillOptions,
): Promise<OnboardingBackfillStats> {
  const log = opts.log ?? (() => {});
  const dryRun = opts.dryRun ?? false;
  const stats: OnboardingBackfillStats = {
    scanned: 0,
    rewound: 0,
    raceSkipped: 0,
    failed: 0,
  };

  const rows = await opts.listCandidates();
  log(`scanned ${rows.length} candidate rows`);

  for (const row of rows) {
    stats.scanned += 1;
    if (!rowMatchesBackfillFilter(row)) {
      stats.raceSkipped += 1;
      continue;
    }
    if (dryRun) {
      stats.rewound += 1;
      continue;
    }
    try {
      const wrote = await opts.rewindRow(row.id);
      if (wrote) {
        stats.rewound += 1;
      } else {
        stats.raceSkipped += 1;
      }
    } catch (err) {
      stats.failed += 1;
      const msg = err instanceof Error ? err.message : String(err);
      log(`  workspace ${row.workspaceId}: rewind failed — ${msg}`);
    }
  }

  log(
    `done: scanned=${stats.scanned} rewound=${stats.rewound} raceSkipped=${stats.raceSkipped} failed=${stats.failed}`,
  );
  return stats;
}
