/**
 * lib/ops/admin-fallback.ts
 *
 * The LAST-RESORT human address. This is the floor under every "page a
 * human" / "route to a human" path in the fleet.
 *
 * THE BAR (Conner-dead simulation P0, mode 1): when the fleet decides a
 * person needs to know about something it could not self-heal, that alert
 * must ALWAYS reach a real inbox — even if every operator env var is
 * unset, blank, or fat-fingered. Before this module, `pageHuman` resolved
 * to ZERO recipients when both `FLEET_TRUSTED_HUMAN_EMAIL` and
 * `OPERATOR_EMAIL_ALLOWLIST` were empty: the page persisted to the audit
 * log but never emailed anyone. That is a silent failure — nobody is
 * watching the audit table at 2am. This module removes the "nobody"
 * branch: there is no env state in which a page has no addressee.
 *
 * Resolution order for the last resort:
 *   1. `ADMIN_FALLBACK_EMAIL` (env) — lets ops point the last resort at a
 *      monitored inbox without a code change.
 *   2. `HARDCODED_ADMIN_FALLBACK_EMAIL` — baked into the binary. The
 *      genuinely-last resort. If config is wiped, this still works.
 *
 * `resolveAdminFallbackEmail` NEVER returns empty — that invariant is the
 * whole point. Callers can rely on always having somewhere to send.
 *
 * `hasConfiguredHuman` is the companion test: it answers "did a human
 * deliberately wire themselves in, or are we running on the baked-in last
 * resort?" Surfaces use it to decide whether to shout LOUDER (we're
 * paging Conner's personal inbox because nobody set up routing) and to
 * tell a customer "we're routing this to a human now" honestly even when
 * the operator allowlist is empty.
 *
 * Cold-start safe (feedback_cold_start_safe_agents): pure over its env
 * snapshot, no in-memory state, reads fresh every call.
 */

/**
 * The baked-in, genuinely-last-resort admin inbox. Used only when neither
 * `ADMIN_FALLBACK_EMAIL` nor any operator/trusted-human env var is set.
 *
 * This is deliberately Conner's personal address per the Conner-dead
 * simulation remediation: the WHOLE failure mode is "config got wiped and
 * nobody noticed." A hardcoded default that lives in the source tree is
 * the one address that survives a blown-away environment. Set
 * `ADMIN_FALLBACK_EMAIL` (or, better, `FLEET_TRUSTED_HUMAN_EMAIL` to a
 * monitored shared inbox) in production to route the last resort somewhere
 * that survives any single person.
 */
export const HARDCODED_ADMIN_FALLBACK_EMAIL = "connerchambers6@gmail.com";

/** Env var name for the configurable last-resort admin inbox. */
export const ADMIN_FALLBACK_EMAIL_ENV = "ADMIN_FALLBACK_EMAIL";

/**
 * Resolve the last-resort admin email. ALWAYS returns a non-empty,
 * trimmed address — `ADMIN_FALLBACK_EMAIL` when set, otherwise the
 * hardcoded baked-in default.
 *
 * FAIL_LOUD: this is the function that guarantees a page can never resolve
 * to "nobody." If you change it to be able to return "" / null, you have
 * re-opened silent-fail mode #1 — a credential failure with no operator
 * configured will page into the void again.
 */
export function resolveAdminFallbackEmail(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const configured = (env[ADMIN_FALLBACK_EMAIL_ENV] ?? "").trim();
  if (configured.length > 0) return configured;
  return HARDCODED_ADMIN_FALLBACK_EMAIL;
}

/**
 * Did a human deliberately wire themselves into the escalation path?
 * True when `FLEET_TRUSTED_HUMAN_EMAIL` OR `OPERATOR_EMAIL_ALLOWLIST` has
 * at least one address. False means every page/escalation is currently
 * running on the baked-in last resort — a loud, surfaced condition, not a
 * silent one.
 *
 * Note: `ADMIN_FALLBACK_EMAIL` alone does NOT count as "configured human"
 * — it is the last-resort lever, not the primary on-call routing. A
 * surface that wants to know "should I shout that routing is missing?"
 * keys off THIS, so setting only ADMIN_FALLBACK_EMAIL still surfaces the
 * nudge to wire up real routing.
 */
export function hasConfiguredHuman(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const trusted = (env.FLEET_TRUSTED_HUMAN_EMAIL ?? "").trim();
  const allowlist = (env.OPERATOR_EMAIL_ALLOWLIST ?? "").trim();
  return trusted.length > 0 || allowlist.length > 0;
}
