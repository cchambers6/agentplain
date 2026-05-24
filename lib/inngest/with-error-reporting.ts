// Inngest function error-reporting wrapper.
//
// Why this exists: the original Inngest functions caught per-item errors
// into a result object and let top-level throws escape to Inngest, neither
// of which reach the observability adapter. That mirrored the flatsbo
// `task_budget` 400 incident where a cron threw and the only signal was
// Conner noticing the symptom. Per docs/runtime-alerting-2026-05-18.md and
// feedback_no_silent_vendor_lock the cron path must report through the
// adapter, not directly to Sentry.
//
// Composition: this wrapper sits INSIDE runWithDisableGate so a paused
// function never spuriously reports. Outside the disable gate the wrapper
// would fire on every disabled tick — the wrong shape.
//
// Inngest short-lived workers: serverless invocations exit as soon as the
// handler returns. Sentry buffers events for batching, so without an
// explicit flush the report can be lost when the worker terminates. We
// flush with a 2s budget before rethrowing.

import { getErrorReporter, reportError } from "../observability";

export interface InngestErrorReportingOptions {
  /** Inngest function id. Becomes the `function_id` tag in Sentry. */
  functionId: string;
  /** Optional extra tags merged onto the report (always strings). */
  extraTags?: Record<string, string>;
}

/**
 * Wrap an Inngest function body so a thrown error is reported via the
 * observability adapter (with `boundary=inngest` + `function_id` tags),
 * flushed, and then rethrown so Inngest still records the failure and
 * applies its own retry policy.
 *
 * Success path: returns the inner value with no allocations beyond the
 * try/catch frame — call sites stay readable.
 */
export async function withInngestErrorReporting<T>(
  opts: InngestErrorReportingOptions,
  fn: () => Promise<T>,
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    reportError(err, {
      level: "error",
      tags: {
        boundary: "inngest",
        function_id: opts.functionId,
        ...opts.extraTags,
      },
    });
    await getErrorReporter().flush(2000);
    throw err;
  }
}

/**
 * Report a per-item failure inside a cron sweep WITHOUT rethrowing.
 *
 * The cron sweeps (process-webhook-event, integration-renewal-sweep,
 * trial-expiration-warnings) catch per-item errors so one bad row doesn't
 * stall the batch — that pattern is correct, but it swallowed the only
 * signal Conner had. This helper preserves the keep-going behavior and
 * still surfaces the error through the adapter with the structured tags
 * that make Sentry's "issues by tag" view useful.
 */
export function reportInngestItemFailure(
  err: unknown,
  opts: InngestErrorReportingOptions,
): void {
  reportError(err, {
    level: "error",
    tags: {
      boundary: "inngest-item",
      function_id: opts.functionId,
      ...opts.extraTags,
    },
  });
}
