/**
 * b2b-ceo daily floor — ported from flatsbo on 2026-05-29 (wave 8).
 *
 * Why this lives here now: the b2b-* agents do agentplain work but were
 * deployed under flatsbo, burning flatsbo's ANTHROPIC_API_KEY for
 * agentplain output. Wave 8 moves the registration so usage bills to
 * agentplain when the function runs. See PR description for the move
 * + linked flatsbo deletion PR.
 *
 * Stub body (honest concession): the original flatsbo runner depends on
 * `scripts/cron-skills/b2b-ceo-daily.md`, a flatsbo-specific memory tree
 * (`memory/b2b_*`), and a `CronRun` Prisma model that agentplain does
 * not have. Porting those is a follow-up infra harmonization PR. For
 * now this function registers cleanly with Inngest, executes through
 * the same disable-gate + observability stack as the other agentplain
 * crons, and emits a structured log noting the pending port. It does
 * NOT call Anthropic — zero API cost until the runner is harmonized.
 *
 * Disable flag: INNGEST_FN_DISABLE_B2B_CEO_DAILY. Default OFF (function
 * runs the stub body). Once the runner is harmonized, the stub body
 * becomes the real prompt-execution path and the disable flag remains
 * the same control surface.
 *
 * Cron: '0 10 * * *' (06:00 ET during EDT). Mirrors the schedule used
 * on flatsbo so the consolidated B2B + consumer picture lands at the
 * same wall-clock time after the move.
 */

import { inngest } from '../client';
import { runWithDisableGate } from '../run-with-disable-gate';
import { withInngestErrorReporting } from '../with-error-reporting';
import { getLogger, withCronMonitor } from '@/lib/observability';

export const B2B_CEO_DAILY_FUNCTION_ID = 'b2b-ceo-daily';
export const B2B_CEO_DAILY_CRON = '0 10 * * *';

export interface B2bCeoDailyResult {
  status: 'pending-runner-port';
  reason: string;
}

export async function runB2bCeoDaily(): Promise<B2bCeoDailyResult> {
  return {
    status: 'pending-runner-port',
    reason:
      'b2b-ceo-daily moved from flatsbo on 2026-05-29; CronDefinition runner ' +
      '(scripts/cron-skills/*.md + memory/b2b_* + CronRun model) pending port. ' +
      'Disable flag remains the control surface once the runner lands.',
  };
}

export const b2bCeoDailyFn = inngest.createFunction(
  {
    id: B2B_CEO_DAILY_FUNCTION_ID,
    name: 'B2B CEO — daily state-of-the-portfolio (stub, awaiting runner port)',
    triggers: [{ cron: B2B_CEO_DAILY_CRON }],
  },
  async () =>
    runWithDisableGate(B2B_CEO_DAILY_FUNCTION_ID, () =>
      withCronMonitor(
        {
          slug: B2B_CEO_DAILY_FUNCTION_ID,
          schedule: B2B_CEO_DAILY_CRON,
          checkinMargin: 15,
          maxRuntime: 15,
        },
        () =>
          withInngestErrorReporting(
            { functionId: B2B_CEO_DAILY_FUNCTION_ID },
            async () => {
              const logger = getLogger().child({
                boundary: 'inngest',
                function_id: B2B_CEO_DAILY_FUNCTION_ID,
              });
              const out = await runB2bCeoDaily();
              logger.info('b2b-ceo-daily stub fired', {
                status: out.status,
                reason: out.reason,
              });
              return out;
            },
          ),
      ),
    ),
);
