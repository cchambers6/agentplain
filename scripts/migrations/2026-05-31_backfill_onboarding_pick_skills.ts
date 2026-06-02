/**
 * scripts/migrations/2026-05-31_backfill_onboarding_pick_skills.ts
 *
 * Wave-10 phase-1 one-off data backfill. Rewinds in-flight wave-8
 * customers from `set_preferences` / `first_fire_watch` back to the new
 * `pick_skills` step so they pass through the wave-9 picker rather than
 * land on `first_fire_watch` with an empty `pickedSkillSlugs` column.
 *
 * Mirrors the operator-script shape of
 * `scripts/encrypt-payloads-at-rest.ts` — both wrap a dependency-
 * injected core (`lib/onboarding/backfill.ts`) with the Prisma I/O
 * boundary.
 *
 * Idempotent. Safe to run before OR after wave-10 ships. Re-running once
 * everyone's been rewound scans zero candidates.
 *
 * Equivalent: dispatch the Inngest event
 *   `agentplain/onboarding.backfill-pick-skills.requested`
 * (registered in `lib/inngest/functions/onboarding-backfill-pick-skills.ts`).
 * The script is the SSH-from-laptop path; the event is the
 * trigger-from-anywhere path. Both call the same core function.
 *
 * Run:
 *   DATABASE_URL=... npx tsx scripts/migrations/2026-05-31_backfill_onboarding_pick_skills.ts
 *
 * Flags:
 *   --dry-run    Count candidates + log them, but do not write.
 */

import { runOnboardingBackfillPickSkills } from '@/lib/inngest/functions/onboarding-backfill-pick-skills';

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  if (dryRun) {
    console.log('[backfill] DRY RUN — no writes will be performed');
  }
  const stats = await runOnboardingBackfillPickSkills({ dryRun });
  console.log('[backfill] done', {
    scanned: stats.scanned,
    rewound: stats.rewound,
    raceSkipped: stats.raceSkipped,
    failed: stats.failed,
    dryRun,
  });
  if (stats.failed > 0) {
    console.error(`[backfill] ${stats.failed} row(s) failed — review logs`);
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('[backfill] fatal error', err);
  process.exit(1);
});
