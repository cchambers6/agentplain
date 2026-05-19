// No-op reporter for environments without a SENTRY_DSN (dev, preview, tests).
// Per feedback_no_prod_secrets_in_dev: a missing prod-tier secret should not
// crash the app — it should resolve to a quiet fallback that callers don't
// have to special-case at every site.

import type { ErrorReporter, ErrorReporterContext } from "./types";

export class NoopErrorReporter implements ErrorReporter {
  readonly providerName = "noop";
  captureException(_err: unknown, _ctx?: ErrorReporterContext): void {
    // intentional no-op
  }
  captureMessage(_msg: string, _ctx?: ErrorReporterContext): void {
    // intentional no-op
  }
  async flush(_timeoutMs?: number): Promise<boolean> {
    return true;
  }
}
