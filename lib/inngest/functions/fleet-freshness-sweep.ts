/**
 * Inngest cron: HOURLY fleet-freshness sweep (Conner-dead P0 #5 + #6).
 *
 * The daily fleet-health heartbeat (Pillar 6) is the deep snapshot. But two
 * failure modes need detection WITHIN AN HOUR, which a once-a-day cron can't
 * give — and one of them is "the daily cron itself stopped firing," which a
 * cron can't self-detect. This hourly sweep is the fast, shallow watchdog that
 * covers both:
 *
 *   #5  STRIPE SYNC STALE — the webhook endpoint has been failing to process
 *       VERIFIED Stripe events with no success since (signature-secret
 *       rotation, a 500ing deploy, a DB blip). Billing state drifts from
 *       Stripe's while every surface acts as if it's current. On detection we
 *       FREEZE billing-dependent auto-exec (an OpsFlag the bounded-execute gate
 *       reads) and page an admin. On recovery we clear the freeze.
 *
 *   #6  FLEET-HEALTH HEARTBEAT MISSED — `OPS_FLEET_HEALTH_LAST_SUCCESS` has not
 *       advanced past its daily cadence + grace, i.e. the daily heartbeat
 *       (Pillar 6) stopped running (its Inngest function wedged / was disabled).
 *       We page an admin so a dead pillar surfaces within the hour instead of
 *       going unnoticed until someone happens to look at the operator panel.
 *
 * Honest boundary on #6: this sweep is ALSO an Inngest cron, so a TOTAL Inngest
 * outage takes it down too. That class of failure is covered by the EXTERNAL
 * watchdog — Sentry Cron Monitors via `withCronMonitor` (`captureCheckIn`) —
 * which alerts when ANY monitored function misses its check-in regardless of
 * whether our code runs. This sweep covers the common case: Inngest alive, one
 * function wedged. The two together = within-the-hour coverage of both
 * "a function stopped" (this sweep) and "Inngest stopped" (Sentry).
 *
 * No migration — all state on OpsFlag rows. Cold-start safe: reads durable
 * flags every fire, no in-memory cache. No-throw core; each check degrades
 * independently so one failing read never blinds the other.
 *
 * FAIL_LOUD: every branch errs toward paging / freezing on doubt. A flag we
 * cannot read is a reason to surface, never to assume healthy.
 */

import { inngest } from '../client';
import { runWithDisableGate } from '../run-with-disable-gate';
import {
  reportInngestItemFailure,
  withInngestErrorReporting,
} from '../with-error-reporting';
import { getLogger, withCronMonitor } from '@/lib/observability';
import { pageHuman as defaultPageHuman } from '@/lib/ops/page-human';
import { PrismaOpsFlagStore } from '@/lib/ops/prisma-flag-store';
import type { OpsFlagStore } from '@/lib/ops/flag-store';
import {
  evaluateStripeSyncFreshness,
  isBillingSyncFrozen,
  setBillingSyncFrozen,
  DEFAULT_SYNC_STALE_AFTER_MS,
} from '@/lib/billing/sync-freshness';
import { FLEET_HEALTH_LAST_SUCCESS_FLAG } from './fleet-health-check';

export const FLEET_FRESHNESS_SWEEP_FUNCTION_ID = 'agentplain-fleet-freshness-sweep';
/** Hourly, on the hour. The fast watchdog above the daily heartbeat. */
export const FLEET_FRESHNESS_SWEEP_CRON = '0 * * * *';
export const FLEET_FRESHNESS_REQUESTED_EVENT =
  'agentplain/ops.fleet-freshness.requested';

/** Coalesce flag: ISO of the last heartbeat-stale page, so a missed daily
 *  heartbeat pages at most once per window (not every hour for days). */
export const HEARTBEAT_STALE_LAST_PAGED_FLAG = 'OPS_HEARTBEAT_STALE_LAST_PAGED';

const HOUR_MS = 60 * 60 * 1000;
/** The daily heartbeat's cadence + a 2h grace. Past this the daily Pillar-6
 *  cron has demonstrably missed a run. */
const HEARTBEAT_STALE_AFTER_MS = 26 * HOUR_MS;
/** Don't re-page a still-missing heartbeat more than once per 12h. */
const HEARTBEAT_PAGE_COALESCE_MS = 12 * HOUR_MS;

export interface FleetFreshnessSweepDeps {
  flagStore?: OpsFlagStore;
  page?: typeof defaultPageHuman;
  now?: Date;
  staleSyncAfterMs?: number;
  heartbeatStaleAfterMs?: number;
}

export interface FleetFreshnessSweepReport {
  /** Stripe sync was found stale this run. */
  billingSyncStale: boolean;
  /** The freeze flag was newly SET this run (transition into frozen). */
  billingFroze: boolean;
  /** The freeze flag was CLEARED this run (recovery). */
  billingUnfroze: boolean;
  /** The daily fleet-health heartbeat was found stale this run. */
  heartbeatStale: boolean;
  /** A page was delivered (either condition). */
  pagedFor: Array<'billing-sync' | 'heartbeat'>;
}

/**
 * Testable core. Never throws — each check is independent; a failure in one
 * is captured and the other still runs.
 */
export async function runFleetFreshnessSweep(
  deps: FleetFreshnessSweepDeps = {},
): Promise<FleetFreshnessSweepReport> {
  const now = deps.now ?? new Date();
  const store = deps.flagStore ?? new PrismaOpsFlagStore();
  const page = deps.page ?? defaultPageHuman;
  const logger = getLogger().child({
    boundary: 'inngest',
    function_id: FLEET_FRESHNESS_SWEEP_FUNCTION_ID,
  });

  const report: FleetFreshnessSweepReport = {
    billingSyncStale: false,
    billingFroze: false,
    billingUnfroze: false,
    heartbeatStale: false,
    pagedFor: [],
  };

  // ── #5 — Stripe sync freshness + freeze ─────────────────────────────────
  try {
    const verdict = await evaluateStripeSyncFreshness({
      store,
      now,
      staleAfterMs: deps.staleSyncAfterMs ?? DEFAULT_SYNC_STALE_AFTER_MS,
    });
    report.billingSyncStale = verdict.stale;
    const wasFrozen = await isBillingSyncFrozen(store).catch(() => false);

    if (verdict.stale && !wasFrozen) {
      // Transition INTO stale → freeze + page (once, on the transition).
      await setBillingSyncFrozen(store, true, verdict.reason);
      report.billingFroze = true;
      const res = await page({
        severity: 'critical',
        summary: 'Stripe billing sync is STALE — billing-dependent auto-exec FROZEN',
        details:
          `${verdict.reason}\n\n` +
          `Action taken automatically: billing-dependent auto-execute is now FROZEN ` +
          `(BILLING_SYNC_FROZEN=true) — those actions fail closed to the approval ` +
          `queue until sync recovers, so nothing runs on stale subscription state.\n\n` +
          `Last successful webhook: ${verdict.lastOkAt?.toISOString() ?? 'never on record'}\n` +
          `Last webhook error:      ${verdict.lastErrorAt?.toISOString() ?? 'n/a'} — ${verdict.lastErrorDetail ?? 'n/a'}\n\n` +
          `To restore: check the Stripe webhook endpoint (signature secret, ` +
          `recent deploy, DB health). Once a webhook processes successfully the ` +
          `next hourly sweep auto-clears the freeze.`,
        deadline: new Date(now.getTime() + 24 * HOUR_MS),
        source: FLEET_FRESHNESS_SWEEP_FUNCTION_ID,
      });
      if (res.delivered) report.pagedFor.push('billing-sync');
    } else if (!verdict.stale && wasFrozen) {
      // Recovery → clear the freeze (an info page so the human sees it lifted).
      await setBillingSyncFrozen(store, false, 'Stripe sync recovered — freeze cleared');
      report.billingUnfroze = true;
      await page({
        severity: 'info',
        summary: 'Stripe billing sync recovered — freeze cleared',
        details:
          `Stripe webhook processing recovered (${verdict.reason}). ` +
          `Billing-dependent auto-execute is un-frozen.`,
        source: FLEET_FRESHNESS_SWEEP_FUNCTION_ID,
      });
    }
  } catch (err) {
    reportInngestItemFailure(err, {
      functionId: FLEET_FRESHNESS_SWEEP_FUNCTION_ID,
      extraTags: { phase: 'billing-sync' },
    });
  }

  // ── #6 — daily heartbeat missed-cron detection ──────────────────────────
  try {
    const heartbeatStaleAfterMs = deps.heartbeatStaleAfterMs ?? HEARTBEAT_STALE_AFTER_MS;
    const lastSuccess = await readIsoFlag(store, FLEET_HEALTH_LAST_SUCCESS_FLAG);
    // FAIL_LOUD: no last-success on record OR a stale one both mean the daily
    // heartbeat is not proving itself alive. We treat "never recorded" as
    // stale only once the system has had time to run — guarded by the
    // coalesce so a brand-new deploy doesn't page immediately.
    const ageMs = lastSuccess ? now.getTime() - lastSuccess.getTime() : Infinity;
    if (ageMs >= heartbeatStaleAfterMs) {
      report.heartbeatStale = true;
      const lastPaged = await readIsoFlag(store, HEARTBEAT_STALE_LAST_PAGED_FLAG);
      const sincePaged = lastPaged ? now.getTime() - lastPaged.getTime() : Infinity;
      if (sincePaged >= HEARTBEAT_PAGE_COALESCE_MS) {
        const res = await page({
          severity: 'critical',
          summary: 'Daily fleet-health heartbeat has NOT run — Pillar 6 is dark',
          details:
            `The daily fleet-health heartbeat (Pillar 6) last succeeded ` +
            `${lastSuccess ? lastSuccess.toISOString() : 'NEVER (no record)'}, ` +
            `which is past its daily cadence. The fleet's deep health snapshot ` +
            `is not running, so breaches (LLM overspend, integration breakage, ` +
            `support backlog, aged past-due) are currently going UNDETECTED.\n\n` +
            `Likely cause: the agentplain-fleet-health-check Inngest function is ` +
            `wedged or disabled (check INNGEST_FN_DISABLE_* and the Inngest ` +
            `dashboard). If Inngest itself is down, Sentry Cron Monitors should ` +
            `also be alerting.\n\n` +
            `This page fires from the hourly freshness sweep, so a dead heartbeat ` +
            `surfaces within the hour.`,
          deadline: new Date(now.getTime() + 24 * HOUR_MS),
          source: FLEET_FRESHNESS_SWEEP_FUNCTION_ID,
        });
        await store.set(HEARTBEAT_STALE_LAST_PAGED_FLAG, now.toISOString(), {
          updatedBy: `system:${FLEET_FRESHNESS_SWEEP_FUNCTION_ID}`,
          note: 'paged for stale fleet-health heartbeat',
        });
        if (res.delivered) report.pagedFor.push('heartbeat');
      }
    }
  } catch (err) {
    reportInngestItemFailure(err, {
      functionId: FLEET_FRESHNESS_SWEEP_FUNCTION_ID,
      extraTags: { phase: 'heartbeat' },
    });
  }

  logger.info('fleet-freshness sweep finished', {
    billing_sync_stale: report.billingSyncStale,
    billing_froze: report.billingFroze,
    billing_unfroze: report.billingUnfroze,
    heartbeat_stale: report.heartbeatStale,
    paged_for: report.pagedFor,
  });
  return report;
}

async function readIsoFlag(
  store: OpsFlagStore,
  name: string,
): Promise<Date | null> {
  const res = await store.get(name);
  if (!res.ok || !res.value) return null;
  const d = new Date(res.value.value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export const fleetFreshnessSweepFn = inngest.createFunction(
  {
    id: FLEET_FRESHNESS_SWEEP_FUNCTION_ID,
    name: 'agentplain fleet freshness sweep',
    triggers: [
      { cron: FLEET_FRESHNESS_SWEEP_CRON },
      { event: FLEET_FRESHNESS_REQUESTED_EVENT },
    ],
  },
  async () =>
    runWithDisableGate(FLEET_FRESHNESS_SWEEP_FUNCTION_ID, () =>
      withCronMonitor(
        {
          slug: FLEET_FRESHNESS_SWEEP_FUNCTION_ID,
          schedule: FLEET_FRESHNESS_SWEEP_CRON,
          checkinMargin: 10,
          maxRuntime: 5,
        },
        () =>
          withInngestErrorReporting(
            { functionId: FLEET_FRESHNESS_SWEEP_FUNCTION_ID },
            async () => {
              const logger = getLogger().child({
                boundary: 'inngest',
                function_id: FLEET_FRESHNESS_SWEEP_FUNCTION_ID,
              });
              logger.info('fleet-freshness sweep started');
              return runFleetFreshnessSweep();
            },
          ),
      ),
    ),
);
