/**
 * lib/inngest/disable-flag.ts
 *
 * In-house per-Inngest-function pause flag — capability_inbox proposal #13.
 *
 * Inngest itself does not publish a public REST API for pausing or resuming
 * cron functions (verified at https://www.inngest.com/docs/guides/pause-functions
 * on 2026-05-10 — pause is exclusively a Cloud-UI operation). To give the
 * org-ops-management infrastructure first-class control over Inngest crons
 * on the same footing as the GitHub Actions `USE_GHA_CRON` flag, every
 * Inngest function in `lib/inngest/functions/*.ts` checks this flag at the
 * top of its handler and early-returns when set.
 *
 * Mechanism:
 *   - Each Inngest function id (e.g. `flatsbo-capability-builder-morning`)
 *     maps to a normalized env-var name `INNGEST_FN_DISABLE_FLATSBO_CAPABILITY_BUILDER_MORNING`.
 *   - When that env var is the string `"true"`, the function fires but
 *     records a `disabled` CronRun row and returns without doing the
 *     expensive work (no Anthropic call, no Notion write, no memory load).
 *   - Any other value (`"false"`, unset, garbage) means the function runs
 *     normally. We deliberately use string equality rather than truthy
 *     coercion so a typo (`"yes"`, `"1"`) defaults to active rather than
 *     accidentally pausing the function.
 *
 * The Vercel REST API edits these env vars (lib/ops/inngest/control.ts).
 * The throttle CLI consumes that adapter. Keep this module dependency-free
 * (no Prisma, no fetch) so it can be imported from anywhere — Inngest
 * handler bodies, edge runtimes, tests, the adapter itself.
 *
 * Per `feedback_no_silent_vendor_lock` + `project_living_portable_architecture`:
 * the in-house flag pattern survives any future Inngest API addition. If
 * Inngest ships a real pause API tomorrow, the adapter swaps its
 * implementation while this file stays put.
 */

export const INNGEST_FN_DISABLE_PREFIX = 'INNGEST_FN_DISABLE_';

/**
 * Compute the env-var name that gates the given Inngest function id.
 *
 * Normalization: dashes → underscores, ASCII letters → upper-case. Other
 * characters pass through unchanged so a malformed id surfaces as a
 * malformed env-var name rather than getting silently rewritten.
 *
 *   flatsbo-capability-builder-morning
 *     → INNGEST_FN_DISABLE_FLATSBO_CAPABILITY_BUILDER_MORNING
 */
export function disableFlagEnvName(functionId: string): string {
  if (typeof functionId !== 'string' || functionId.length === 0) {
    throw new Error('disableFlagEnvName: functionId must be a non-empty string');
  }
  const normalized = functionId.replace(/-/g, '_').toUpperCase();
  return `${INNGEST_FN_DISABLE_PREFIX}${normalized}`;
}

/**
 * Returns `true` iff the env var that gates this Inngest function is set
 * to the literal string `"true"`. Any other value (including undefined,
 * empty string, `"false"`, `"True"`, `"1"`) returns `false`.
 *
 * The strict-equality semantic is deliberate — see header.
 *
 * Optional `env` argument exists only for tests; production callers
 * should pass nothing and let it read `process.env`.
 */
export function isFunctionDisabled(
  functionId: string,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const name = disableFlagEnvName(functionId);
  return env[name] === 'true';
}
