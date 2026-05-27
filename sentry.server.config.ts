// Sentry Node-runtime boot. Loaded by `instrumentation.ts` when
// `NEXT_RUNTIME === "nodejs"`. The file must live at the repo root because
// the Sentry SDK's webpack plugin (wired via `withSentryConfig` in
// `next.config.mjs`) resolves it by name.
//
// Application code does NOT import from here — it goes through
// `lib/observability` (feedback_no_silent_vendor_lock). This file is the
// SDK's required init boundary, not a public surface.

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
    // Performance sampling kept conservative — at current traffic the cost
    // of full traces would exceed the free tier within days. Per-route
    // adjustments live in lib/observability if traffic warrants.
    tracesSampleRate: 0.1,
    // Strip customer content (email bodies, draft replies, file text,
    // raw addresses) before any event leaves the process. The scrub helper
    // walks message/exception/breadcrumbs/extra/contexts. Defense-in-depth
    // for the data-privacy audit (PR #91, must-close #3).
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
    // Default integrations + auto-instrumentation. We rely on the SDK to
    // wire up unhandled-rejection + uncaught-exception listeners; the
    // `captureRequestError` export from `instrumentation.ts` covers Server
    // Components, Server Actions, and Route Handlers.
  });
}
