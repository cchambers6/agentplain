import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async redirects() {
    return [
      {
        // The old pilot pricing model ($1,500 / $2,750 / $4,500 tiers, 30-day
        // paid pilot) was killed per project_stripe_both_surfaces.md. Old
        // /pilot links from outreach 308-redirect to home so they don't 404.
        source: "/pilot",
        destination: "/#pricing",
        permanent: true,
      },
      // NOTE: no /how-it-works redirect here. The standalone page at
      // app/(marketing)/how-it-works/page.tsx (PR #283) is the canonical
      // explainer; a stale `permanent: true` redirect to /#how shadowed it
      // for weeks because Next.js applies redirects() before filesystem
      // routes (audit-2026-07-02 dept-1 P0). Browsers that cached the old
      // 308 keep bouncing until their cache expires — do not re-add a
      // redirect on this path.
      // ── Workspace IA collapse (13 tabs → 5) backward-compat ──────────────
      // docs/specs/workspace-ia-simplification-2026-06-14.md. The five-tab IA
      // (Today / Plaino / Connections / Reports / Account) drops two routes
      // entirely; keep their old URLs alive so no bookmark, onboarding deep
      // link, or operator link 404s. Query strings carry through automatically.
      {
        // /help was the dead predecessor of /support/new — a different,
        // untracked note form. One support intake now, reached from Account.
        // Onboarding's "stuck?" deep links carried a ?subject= that survives.
        source: "/app/workspace/:id/help",
        destination: "/app/workspace/:id/support/new",
        permanent: true,
      },
      {
        // Fleet ("mission control") was pure engineer-built redundancy — all
        // five panels duplicated other tabs. It dissolves into Today, the new
        // "what needs me right now" home.
        source: "/app/workspace/:id/fleet",
        destination: "/app/workspace/:id",
        permanent: true,
      },
    ];
  },
};

// withSentryConfig handles client-config injection, edge/Node split, and
// (when SENTRY_AUTH_TOKEN is set) source-map upload + release tagging. When
// the auth token is absent the wrapper is a no-op build-time pass-through —
// safe for dev / preview / Production-before-Conner-pastes-the-token.
export default withSentryConfig(nextConfig, {
  silent: !process.env.CI,
  // Read both names so a rename on either side (Vercel env var or this file)
  // can't silently disable source-map upload + release tagging again. The
  // 2026-05-24 prod build skipped the upload because the existing Vercel var
  // is `SENTRY_ORG_SLUG` while this file only read `SENTRY_ORG` — runtime
  // ingestion still worked (DSN is read separately) but prod stack traces
  // were minified and releases weren't tagged. `SENTRY_ORG_SLUG` wins when
  // both are set so the existing Vercel var keeps working without an env
  // edit, and the canonical Sentry SDK name (`SENTRY_ORG`) stays a valid
  // fallback for any future environment that uses it.
  org: process.env.SENTRY_ORG_SLUG ?? process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  hideSourceMaps: true,
  // Skip telemetry pings to Sentry on every build.
  telemetry: false,
  webpack: {
    // Replaces the deprecated `disableLogger` flag (Sentry SDK ≥ 10).
    treeshake: { removeDebugLogging: true },
  },
});
