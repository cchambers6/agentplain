// Next.js instrumentation hook (App Router). Runs once per server boot.
//
// We load the runtime-specific Sentry config dynamically so the Node SDK
// surface never ships to Edge runtime bundles (and vice versa). This is
// the convention the Sentry Next.js docs prescribe for App Router.
//
// `onRequestError` is Next.js 15's hook for capturing Server Component +
// Server Action + Route Handler errors. The Sentry SDK re-exports it as
// `captureRequestError`; on Next.js 14 the hook is a no-op but the export
// is forwards-compatible for the eventual Next.js upgrade.

import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
