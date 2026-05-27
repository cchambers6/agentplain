// Sentry browser-bundle boot. Inlined into the client JS by Next.js when
// `withSentryConfig` wraps `next.config.mjs`. The file must live at the
// repo root.
//
// Reads `NEXT_PUBLIC_SENTRY_DSN` because secrets prefixed `NEXT_PUBLIC_`
// are the ones webpack inlines into the client bundle. The DSN is
// public-by-design (ingest-only) but we still gate it on the env so dev
// builds don't ship a client-side init pointing at a non-existent project.

import * as Sentry from "@sentry/nextjs";
import { scrubSentryEvent } from "./lib/observability/sentry-scrub";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment:
      process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ??
      process.env.NEXT_PUBLIC_VERCEL_ENV ??
      "production",
    release:
      process.env.NEXT_PUBLIC_SENTRY_RELEASE ??
      process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
    tracesSampleRate: 0.1,
    // Browser-side errors generally carry less raw customer content than
    // server errors (the workspace screens render structured data, not
    // raw bodies), but we apply the same scrubber for consistency and to
    // protect against future shapes — e.g. a workspace screen pasting a
    // draft body into a thrown Error.
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
    // Session Replay disabled at launch — adds bundle weight and we don't
    // yet have a story for the privacy review of recorded sessions on
    // workspace screens with customer data. Revisit when error volume
    // makes replay's marginal cost worth it.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
  });
}
