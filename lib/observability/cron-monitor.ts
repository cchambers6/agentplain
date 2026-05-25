// Cron monitor — "who watches the watchdog" for the Inngest fleet.
//
// The renewal sweep + webhook-event drain + trial-expiration warnings +
// file-ingestion sweep are themselves the things that surface failures
// elsewhere. They have no peer to notice when *they* stop firing. This
// helper sends a check-in (start + ok/error) around each cron body so an
// external system can alert on missed runs.
//
// Sentry has first-class cron monitors (captureCheckIn / withMonitor). We
// route through the same provider seam as captureException so the cron
// monitor doesn't lock the codebase to Sentry — a future swap to Better
// Stack Heartbeats / Healthchecks.io / Datadog Synthetics changes ONE file
// (sentry-provider.ts), not every cron body.
//
// Composition with the existing wrappers (per process-webhook-event.ts):
//
//   runWithDisableGate(fnId, () =>
//     withCronMonitor({ slug: fnId, schedule: '*/5 * * * *' }, () =>
//       withInngestErrorReporting({ functionId: fnId }, () => doWork())))
//
// Order matters: disable-gate OUTSIDE so a paused function doesn't ping
// the monitor (which would mask the pause). Cron-monitor wraps the error
// reporter so a throw is reported THEN the monitor flips to "error".

import * as Sentry from "@sentry/nextjs";

import { reportError } from "./index";

export interface CronMonitorOptions {
  /**
   * Stable identifier (the Sentry monitor "slug"). Reuse the Inngest
   * function id so the alert page reads the same name as the cron itself.
   */
  slug: string;
  /**
   * Cron expression in standard 5-field form (matching the Inngest cron).
   * Sentry uses this to compute the expected schedule + miss window.
   */
  schedule: string;
  /**
   * IANA timezone for the schedule. Defaults to UTC — the agentplain
   * Inngest crons all fire on UTC.
   */
  timezone?: string;
  /**
   * Margin in minutes around the expected fire time before Sentry alerts.
   * Defaults to 5 — the renewal sweep allows up to 5 minutes of drift.
   */
  checkinMargin?: number;
  /**
   * Max minutes a run is expected to take before Sentry alerts "in
   * progress too long". Defaults to 10 — the sweeps cap themselves at 25
   * events × a few seconds of LLM time each.
   */
  maxRuntime?: number;
}

export interface CronMonitorRunner {
  /**
   * Mark a run "started". Returns the check-in id (or null when the
   * provider is noop). Send this id back on the completion call so the
   * provider can pair them.
   */
  start(opts: CronMonitorOptions): string | null;
  /**
   * Mark a run "ok". Pass the id from start() so the provider closes the
   * paired check-in instead of opening a new one.
   */
  ok(opts: CronMonitorOptions, checkInId: string | null): void;
  /**
   * Mark a run "error" with the same pairing rule.
   */
  error(opts: CronMonitorOptions, checkInId: string | null): void;
}

// =====================================================================
// Provider seam
// =====================================================================

let cachedRunner: CronMonitorRunner | null = null;

/**
 * Get the active cron monitor runner. Defaults to the Sentry-backed
 * implementation when @sentry/nextjs has a DSN configured; otherwise
 * returns a no-op runner so dev/preview/test paths don't try to ship.
 *
 * Tests replace via __setCronMonitorRunnerForTests.
 */
export function getCronMonitorRunner(): CronMonitorRunner {
  if (cachedRunner) return cachedRunner;
  // Lazy-import the Sentry binding so this file is safe to import in test
  // suites that haven't initialized Sentry. The DSN check mirrors the
  // pattern in sentry.server.config.ts.
  if (process.env.SENTRY_DSN) {
    cachedRunner = buildSentryRunner();
  } else {
    cachedRunner = noopRunner;
  }
  return cachedRunner;
}

export function __setCronMonitorRunnerForTests(
  runner: CronMonitorRunner | null,
): void {
  cachedRunner = runner;
}

const noopRunner: CronMonitorRunner = {
  start: () => null,
  ok: () => {},
  error: () => {},
};

function buildSentryRunner(): CronMonitorRunner {
  const buildConfig = (opts: CronMonitorOptions) => ({
    schedule: { type: "crontab" as const, value: opts.schedule },
    timezone: opts.timezone ?? "UTC",
    checkinMargin: opts.checkinMargin ?? 5,
    maxRuntime: opts.maxRuntime ?? 10,
  });
  return {
    start(opts) {
      try {
        return Sentry.captureCheckIn(
          { monitorSlug: opts.slug, status: "in_progress" },
          buildConfig(opts),
        );
      } catch {
        // Never let a monitor failure cascade into the cron body.
        return null;
      }
    },
    ok(opts, checkInId) {
      try {
        Sentry.captureCheckIn(
          {
            monitorSlug: opts.slug,
            status: "ok",
            ...(checkInId ? { checkInId } : {}),
          },
          buildConfig(opts),
        );
      } catch {
        // ignored
      }
    },
    error(opts, checkInId) {
      try {
        Sentry.captureCheckIn(
          {
            monitorSlug: opts.slug,
            status: "error",
            ...(checkInId ? { checkInId } : {}),
          },
          buildConfig(opts),
        );
      } catch {
        // ignored
      }
    },
  };
}

// =====================================================================
// Wrapper used by Inngest function bodies
// =====================================================================

/**
 * Wrap a cron body so Sentry (or the swapped-in monitor) sees a
 * start/ok/error trace per fire. Rethrows on failure so Inngest's retry
 * still kicks in.
 *
 * Cron-monitor errors are reported through the standard error reporter
 * with `boundary=cron-monitor` so they're visible in the same Sentry
 * Issues feed as a missed cron — but they don't fail the cron itself.
 */
export async function withCronMonitor<T>(
  opts: CronMonitorOptions,
  fn: () => Promise<T>,
): Promise<T> {
  const runner = getCronMonitorRunner();
  const checkInId = runner.start(opts);
  try {
    const result = await fn();
    runner.ok(opts, checkInId);
    return result;
  } catch (err) {
    try {
      runner.error(opts, checkInId);
    } catch (monitorErr) {
      reportError(monitorErr, {
        level: "warning",
        tags: { boundary: "cron-monitor", monitor_slug: opts.slug },
      });
    }
    throw err;
  }
}
