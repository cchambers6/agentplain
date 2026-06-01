/**
 * Inngest event handler: agentplain/onboarding.backfill-pick-skills.requested
 *
 * Wave-10 phase-1 data backfill. Rewinds in-flight wave-8 customers from
 * `set_preferences` / `first_fire_watch` back to the new `pick_skills`
 * step so they pass through the wave-9 picker rather than land on
 * first_fire_watch with an empty `pickedSkillSlugs` column.
 *
 * Dispatched once after wave-10 deploys via the operator script in
 * `scripts/migrations/2026-05-31_backfill_onboarding_pick_skills.ts` —
 * or by `inngest.send({ name: ONBOARDING_BACKFILL_PICK_SKILLS_EVENT })`
 * from anywhere. Idempotent: re-running scans zero candidates once
 * everyone's been rewound.
 *
 * Per `feedback_no_silent_vendor_lock.md`: the core lives in
 * `lib/onboarding/backfill.ts` behind a dependency-injected interface —
 * Prisma stays at the I/O boundary, the loop logic is testable in
 * isolation.
 *
 * Per `project_no_outbound_architecture.md`: the function only mutates
 * `OnboardingState`. No customer-visible writes, no vendor calls.
 */

import { inngest } from '../client';
import { runWithDisableGate } from '../run-with-disable-gate';
import {
  reportInngestItemFailure,
  withInngestErrorReporting,
} from '../with-error-reporting';
import { getLogger } from '@/lib/observability';
import { withSystemContext } from '@/lib/db/rls';
import {
  backfillOnboardingPickSkills,
  type OnboardingBackfillRow,
  type OnboardingBackfillStats,
} from '@/lib/onboarding/backfill';

export const ONBOARDING_BACKFILL_PICK_SKILLS_FUNCTION_ID =
  'agentplain-onboarding-backfill-pick-skills';

export const ONBOARDING_BACKFILL_PICK_SKILLS_EVENT =
  'agentplain/onboarding.backfill-pick-skills.requested';

export interface OnboardingBackfillPickSkillsEventData {
  /** Optional — when true, count without writing. Defaults to false. */
  dryRun?: boolean;
}

export async function runOnboardingBackfillPickSkills(
  options: { dryRun?: boolean } = {},
): Promise<OnboardingBackfillStats> {
  const logger = getLogger().child({
    boundary: 'inngest',
    function_id: ONBOARDING_BACKFILL_PICK_SKILLS_FUNCTION_ID,
  });

  return backfillOnboardingPickSkills({
    dryRun: options.dryRun ?? false,
    log: (line) => logger.info(line),
    listCandidates: async (): Promise<OnboardingBackfillRow[]> => {
      // System context — this is an operator pass that crosses workspaces.
      return withSystemContext(async (tx) => {
        const rows = await tx.onboardingState.findMany({
          where: {
            completedAt: null,
            currentStep: { in: ['set_preferences', 'first_fire_watch'] },
            // pickedSkillSlugs default is `[]`; column is NOT NULL.
            pickedSkillSlugs: { equals: [] },
          },
          select: {
            id: true,
            workspaceId: true,
            currentStep: true,
            pickedSkillSlugs: true,
            firstFireRequestedAt: true,
            firstFireCompletedAt: true,
            completedAt: true,
          },
        });
        return rows.map((r) => ({
          id: r.id,
          workspaceId: r.workspaceId,
          currentStep: r.currentStep,
          pickedSkillSlugs: r.pickedSkillSlugs,
          firstFireRequestedAt: r.firstFireRequestedAt,
          firstFireCompletedAt: r.firstFireCompletedAt,
          completedAt: r.completedAt,
        }));
      });
    },
    rewindRow: async (id): Promise<boolean> => {
      // Conditional update — `updateMany` with the filter re-checked at
      // write time means a row that raced past the filter between scan
      // and write returns count=0 (we report it as raceSkipped, not an
      // error).
      return withSystemContext(async (tx) => {
        const res = await tx.onboardingState.updateMany({
          where: {
            id,
            completedAt: null,
            currentStep: { in: ['set_preferences', 'first_fire_watch'] },
            pickedSkillSlugs: { equals: [] },
          },
          data: {
            currentStep: 'pick_skills',
            firstFireRequestedAt: null,
            firstFireCompletedAt: null,
          },
        });
        return res.count > 0;
      });
    },
  });
}

function parseEventData(
  raw: unknown,
): OnboardingBackfillPickSkillsEventData {
  if (!raw || typeof raw !== 'object') return {};
  const r = raw as Record<string, unknown>;
  return {
    dryRun: typeof r.dryRun === 'boolean' ? r.dryRun : false,
  };
}

export const onboardingBackfillPickSkillsFn = inngest.createFunction(
  {
    id: ONBOARDING_BACKFILL_PICK_SKILLS_FUNCTION_ID,
    name: 'agentplain onboarding pick-skills backfill',
    concurrency: { limit: 1 },
    retries: 1,
    triggers: [{ event: ONBOARDING_BACKFILL_PICK_SKILLS_EVENT }],
  },
  async ({ event }) =>
    runWithDisableGate(
      ONBOARDING_BACKFILL_PICK_SKILLS_FUNCTION_ID,
      () =>
        withInngestErrorReporting(
          {
            functionId: ONBOARDING_BACKFILL_PICK_SKILLS_FUNCTION_ID,
          },
          async () => {
            const logger = getLogger().child({
              boundary: 'inngest',
              function_id: ONBOARDING_BACKFILL_PICK_SKILLS_FUNCTION_ID,
            });
            const data = parseEventData(event?.data);
            logger.info('onboarding pick-skills backfill started', {
              dry_run: data.dryRun ?? false,
            });
            try {
              const stats = await runOnboardingBackfillPickSkills(data);
              logger.info('onboarding pick-skills backfill finished', {
                scanned: stats.scanned,
                rewound: stats.rewound,
                race_skipped: stats.raceSkipped,
                failed: stats.failed,
                dry_run: data.dryRun ?? false,
              });
              return stats;
            } catch (err) {
              reportInngestItemFailure(err, {
                functionId: ONBOARDING_BACKFILL_PICK_SKILLS_FUNCTION_ID,
                extraTags: { phase: 'run-backfill' },
              });
              throw err;
            }
          },
        ),
    ),
);
