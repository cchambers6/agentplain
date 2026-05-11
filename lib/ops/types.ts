/**
 * OpsControlPlane — uniform interface for org-ops-management adapters.
 *
 * Per `feedback_no_silent_vendor_lock`: every vendor SDK / REST call lives
 * behind this interface. Per `feedback_runner_portability`: every adapter
 * category has at least two implementations (production + test/in-memory).
 *
 * This is the first concrete piece of capability_inbox proposal #12. The
 * remaining providers (Vercel, Anthropic Console, Stripe Console), the
 * secrets vault, the org-ops-management agent, and the Postgres audit log
 * are follow-on work and intentionally NOT in this file.
 *
 * Adding a new adapter:
 *   1. Implement this interface in `lib/ops/<provider>/<surface>.ts`.
 *   2. Constructor takes per-instance config (owner/repo, account id,
 *      environment), NEVER reads identity from env directly. Credentials
 *      may come from env today; they will move to the secrets vault
 *      (proposal #12 follow-on).
 *   3. Every method returns `OpsResult<T>`. Throw only on programmer
 *      error (bad arguments). Network failures → structured error.
 *   4. Add the adapter to the contract test parameterization in
 *      `lib/ops/__tests__/contract.test.ts`.
 */

/**
 * Discriminated union for every ops operation. Forces callers to handle
 * the failure path at the type level — no swallowing errors via
 * exceptions that escape the ops boundary.
 */
export type OpsResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: OpsError }

/**
 * Structured error reasons. Add codes here as new failure modes show up;
 * NEVER stringly-type new codes inline at call sites.
 */
export type OpsErrorCode =
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'RATE_LIMITED'
  | 'NETWORK'
  | 'MALFORMED_RESPONSE'
  | 'NOT_IMPLEMENTED'
  | 'INVALID_ARGUMENT'
  | 'CONFLICT'
  | 'UPSTREAM_ERROR'

export interface OpsError {
  code: OpsErrorCode
  message: string
  /** HTTP status if the failure was a remote response. */
  status?: number
  /** Vendor-specific identifier (e.g. GitHub `documentation_url`). */
  reference?: string
  /** Retry hint in milliseconds — populated for RATE_LIMITED. */
  retryAfterMs?: number
}

/** Repo-variable read shape. */
export interface RepoVariable {
  name: string
  value: string
  /** ISO-8601 timestamp of last update (vendor-supplied). */
  updatedAt?: string
}

/**
 * Inngest function status. We only return what we can verifiably observe
 * via documented public APIs. Pause state is currently UI-only per the
 * Inngest docs (see `lib/ops/inngest/control.ts` for the citation), so it
 * is intentionally typed as `'unknown'` when we can't determine it.
 */
export interface InngestFunctionStatus {
  functionId: string
  /** `'paused' | 'active' | 'unknown'`. `unknown` means the underlying API
   *  does not expose pause state — not a transient failure. */
  pauseState: 'paused' | 'active' | 'unknown'
  /** ISO-8601 of the most recent run we could observe (best-effort). */
  lastRunAt?: string
}

/**
 * The contract every ops adapter implements.
 *
 * NOTE: each method targets the smallest verb we actually need. Resist
 * the temptation to grow this surface speculatively — add a method when
 * a CLI subcommand or agent action requires it, not before.
 */
export interface OpsControlPlane {
  /**
   * Read a GitHub Actions repository variable (NOT a secret).
   *
   * Returns `NOT_FOUND` when the variable does not exist — callers can
   * treat that as "first run" rather than as an error.
   */
  getRepoVariable(key: string): Promise<OpsResult<RepoVariable>>

  /**
   * Set a GitHub Actions repository variable. Creates if missing,
   * updates in place if present. Read-back is the caller's
   * responsibility (per `feedback_verify_after_create`); the CLI
   * wrapper does that after every mutation.
   */
  setRepoVariable(key: string, value: string): Promise<OpsResult<RepoVariable>>

  /**
   * Pause an Inngest function so its triggers stop firing new runs.
   * Existing in-flight runs are unaffected.
   *
   * The current Inngest production adapter returns `NOT_IMPLEMENTED`
   * because pause is a UI-only operation per Inngest docs as of
   * 2026-05-10. The interface still exposes the verb so the contract is
   * stable when either (a) Inngest publishes a control-plane API or (b)
   * we adopt a per-function flag pattern (see lib/ops/inngest/control.ts
   * for the docs citation + path-forward).
   */
  pauseInngestFunction(functionId: string): Promise<OpsResult<void>>

  /** See `pauseInngestFunction`. Same NOT_IMPLEMENTED caveat applies. */
  resumeInngestFunction(functionId: string): Promise<OpsResult<void>>

  /**
   * Best-effort status. May return `pauseState: 'unknown'` from the
   * production Inngest adapter; the test adapter always returns a
   * concrete value.
   */
  getInngestFunctionStatus(functionId: string): Promise<OpsResult<InngestFunctionStatus>>
}

/**
 * Helper for wrapping an `OpsError` value. Production adapters compose
 * this rather than constructing object literals — keeps every ops error
 * shaped identically.
 */
export function opsError(code: OpsErrorCode, message: string, extra?: Omit<OpsError, 'code' | 'message'>): { ok: false; error: OpsError } {
  return { ok: false, error: { code, message, ...extra } }
}

/** Helper symmetry with `opsError`. */
export function opsOk<T>(value: T): { ok: true; value: T } {
  return { ok: true, value }
}
