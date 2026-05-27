// Sentry Edge-runtime boot. Loaded by `instrumentation.ts` when
// `NEXT_RUNTIME === "edge"`. Middleware + edge route handlers run here.
//
// Same notes as `sentry.server.config.ts`: SDK init boundary, not a
// public surface. Application code goes through `lib/observability`.

import * as Sentry from "@sentry/nextjs";
import { scrubSentryEvent } from "./lib/observability/sentry-scrub";

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment:
      process.env.SENTRY_ENVIRONMENT ??
      process.env.VERCEL_ENV ??
      process.env.NODE_ENV ??
      "development",
    release: process.env.SENTRY_RELEASE ?? process.env.VERCEL_GIT_COMMIT_SHA,
    tracesSampleRate: 0.1,
    // Strip customer content before shipping — same discipline as the
    // node-runtime config. See `lib/observability/sentry-scrub.ts`.
    beforeSend(event) {
      return scrubSentryEvent(event);
    },
    beforeBreadcrumb(crumb) {
      if (crumb && typeof crumb.message === "string") {
        crumb.message = scrubSentryEvent({ message: crumb.message })
          .message;
      }
      return crumb;
    },
  });
}
