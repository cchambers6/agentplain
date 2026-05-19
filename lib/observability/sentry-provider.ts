// Sentry-backed implementation of ErrorReporter.
//
// This is the ONLY file in the repo (outside the root-level sentry.*.config.ts
// boot files that the SDK requires by convention) that imports `@sentry/nextjs`
// directly — feedback_no_silent_vendor_lock. Application code and error
// boundaries call `reportError(...)` from `lib/observability` instead.

import * as Sentry from "@sentry/nextjs";
import type {
  ErrorReporter,
  ErrorReporterContext,
  ErrorReporterLevel,
} from "./types";

function applyContext(
  scope: Sentry.Scope,
  ctx: ErrorReporterContext | undefined,
): void {
  if (!ctx) return;
  if (ctx.level) scope.setLevel(ctx.level);
  if (ctx.tags) {
    for (const [k, v] of Object.entries(ctx.tags)) scope.setTag(k, v);
  }
  if (ctx.extra) {
    for (const [k, v] of Object.entries(ctx.extra)) scope.setExtra(k, v);
  }
  if (ctx.user) scope.setUser(ctx.user);
}

function severityForMessage(
  level: ErrorReporterLevel | undefined,
): ErrorReporterLevel {
  return level ?? "info";
}

export class SentryErrorReporter implements ErrorReporter {
  readonly providerName = "sentry";

  captureException(err: unknown, ctx?: ErrorReporterContext): void {
    Sentry.withScope((scope) => {
      applyContext(scope, ctx);
      Sentry.captureException(err);
    });
  }

  captureMessage(msg: string, ctx?: ErrorReporterContext): void {
    Sentry.withScope((scope) => {
      applyContext(scope, ctx);
      Sentry.captureMessage(msg, severityForMessage(ctx?.level));
    });
  }

  async flush(timeoutMs = 2000): Promise<boolean> {
    return Sentry.flush(timeoutMs);
  }
}
