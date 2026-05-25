// Observability boundary entry point. Domain code imports from here, NEVER
// from `@sentry/nextjs` or the sentry-provider directly — the swap to one
// file (this one) is the discipline per feedback_no_silent_vendor_lock and
// project_living_portable_architecture.
//
// Mirrors the shape of lib/auth, lib/billing, lib/email: a getter that
// caches a single provider, a test-shim hook for swapping in a recorder
// during suites, and re-exports of the public types + provider classes.

import { env } from "../env";
import { NoopErrorReporter } from "./noop-provider";
import { SentryErrorReporter } from "./sentry-provider";
import type { ErrorReporter, ErrorReporterContext } from "./types";

let cached: ErrorReporter | null = null;

export function getErrorReporter(): ErrorReporter {
  if (cached) return cached;
  switch (env.observabilityProvider()) {
    case "sentry":
      cached = new SentryErrorReporter();
      break;
    case "noop":
    default:
      cached = new NoopErrorReporter();
      break;
  }
  return cached;
}

/** Convenience wrapper — the most common call shape. */
export function reportError(err: unknown, ctx?: ErrorReporterContext): void {
  getErrorReporter().captureException(err, ctx);
}

/** Convenience wrapper for non-throwing events. */
export function reportMessage(msg: string, ctx?: ErrorReporterContext): void {
  getErrorReporter().captureMessage(msg, ctx);
}

export function __setErrorReporterForTests(r: ErrorReporter | null): void {
  cached = r;
}

export type {
  ErrorReporter,
  ErrorReporterContext,
  ErrorReporterLevel,
} from "./types";
export { NoopErrorReporter } from "./noop-provider";
export { SentryErrorReporter } from "./sentry-provider";
export { TestErrorReporter } from "./test-provider";

// Structured logging — JSON-emitting, vendor-portable. Domain code imports
// `getLogger()` and never console.* directly on the cron + webhook paths.
export {
  getLogger,
  __setLoggerWriterForTests,
  type Logger,
  type LogContext,
  type LogLevel,
} from "./logger";

// Cron monitor — Sentry check-ins behind the same provider seam so the
// watchdog has an external pulse.
export {
  withCronMonitor,
  getCronMonitorRunner,
  __setCronMonitorRunnerForTests,
  type CronMonitorOptions,
  type CronMonitorRunner,
} from "./cron-monitor";
