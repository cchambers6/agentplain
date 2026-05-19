// Observability boundary types.
//
// The adapter exists so application code never imports `@sentry/nextjs`
// directly (feedback_no_silent_vendor_lock). Sentry is one implementation;
// the noop provider keeps dev / preview / test runs quiet, and a future
// OpenTelemetry or self-hosted target can land here without touching any
// caller (project_living_portable_architecture).

export type ErrorReporterLevel = "fatal" | "error" | "warning" | "info";

export interface ErrorReporterContext {
  /** Indexed key/value tags (Sentry tags column). Strings only. */
  tags?: Record<string, string>;
  /** Larger contextual payloads that don't need to be indexed. */
  extra?: Record<string, unknown>;
  /** Event severity. Defaults to "error" for captureException. */
  level?: ErrorReporterLevel;
  /** Authenticated user metadata. Never include secrets. */
  user?: { id?: string; email?: string };
}

export interface ErrorReporter {
  readonly providerName: string;
  /** Report a thrown value. Safe to call with non-Error values. */
  captureException(err: unknown, ctx?: ErrorReporterContext): void;
  /** Report a string-level event. */
  captureMessage(msg: string, ctx?: ErrorReporterContext): void;
  /**
   * Flush queued events. Returns false if the timeout expired before drain.
   * Call before process exit in short-lived runtimes (cron jobs, edge fns).
   */
  flush(timeoutMs?: number): Promise<boolean>;
}
