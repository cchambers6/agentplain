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
    ];
  },
};

// withSentryConfig handles client-config injection, edge/Node split, and
// (when SENTRY_AUTH_TOKEN is set) source-map upload + release tagging. When
// the auth token is absent the wrapper is a no-op build-time pass-through —
// safe for dev / preview / Production-before-Conner-pastes-the-token.
export default withSentryConfig(nextConfig, {
  silent: !process.env.CI,
  org: process.env.SENTRY_ORG,
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
