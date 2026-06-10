/**
 * lib/llm/key-rotation-provider.ts
 *
 * Self-healing Anthropic key rotation as a composable wrapper layer.
 *
 * Bar (the "if Conner died tomorrow" test): when the primary Anthropic key
 * dies — 401/403 (revoked/invalid), 429 (rate/quota), or a quota-exhaustion
 * signal — the customer must NOT see the blip. The stack automatically retries
 * the same request on the secondary key and keeps serving on it (sticky) until
 * the process restarts or the primary verifies healthy again. If the secondary
 * is missing or also failing, we degrade EXACTLY like the paused-sentinel path
 * (a calm `PAUSED` result → "Plaino is briefly offline" customer copy, never a
 * raw error string) AND page a human with which keys failed and a 24h deadline.
 *
 * Position in the stack (justified): this wrapper sits INNERMOST, wrapping the
 * actual Anthropic call, with caching OUTSIDE it:
 *
 *     Logging( Budget( Routing( Sentinel( Caching( KeyRotation( Anthropic ) ) ) ) ) )
 *
 * Why innermost:
 *   - Rotation is the *only* layer that re-issues the SAME model request under
 *     a different credential. It must own the call boundary where the 401/429
 *     actually surfaces, so it can transparently retry. A 401 surfaces from the
 *     Anthropic SDK as the adapter's `AUTHENTICATION` result; 429 as
 *     `RATE_LIMITED`. The wrapper inspects those codes on the result.
 *   - Caching sits OUTSIDE so a cache HIT short-circuits before we ever touch a
 *     key (no point rotating a credential for a call we won't make), and a cache
 *     WRITE on the successful (post-failover) call still happens normally.
 *   - The Sentinel layer (paused-spend short-circuit) stays OUTSIDE rotation:
 *     a deliberately-paused primary (`sk-ant-PAUSED-…`) is an intentional state,
 *     not a credential failure — it should short-circuit to PAUSED without
 *     burning the secondary. Rotation only reacts to genuine auth/quota
 *     failures from a key that was *meant* to work.
 *
 * Construction: the wrapper is given a primary inner provider AND a factory for
 * the secondary inner provider (so we don't build a second Anthropic client
 * unless/until we need it, and so tests inject fakes). The factory reads
 * `ANTHROPIC_API_KEY_SECONDARY` at build time; when unset the factory returns
 * null and a primary failure degrades-to-PAUSED + pages.
 *
 * Cold-start safe (feedback_cold_start_safe_agents): the only in-memory state
 * is the sticky "serving on secondary" flag, which is performance, not
 * correctness — a fresh process re-starts on the primary and re-discovers the
 * failure on the first call, failing over again. No durable state depends on it.
 *
 * Kill switch: `LLM_KEY_ROTATION=off` makes this a pure pass-through to the
 * primary (identical to a stack without the wrapper) — consistent with
 * `LLM_PROMPT_CACHE` / `LLM_BUDGET_ENFORCEMENT` / `LLM_SENTINEL_BYPASS`.
 *
 * Per feedback_no_silent_vendor_lock: this never imports the Anthropic SDK —
 * it composes `LlmProvider`s. The Anthropic-specific bits (key strings, error
 * mapping) stay in `anthropic-provider.ts`.
 */

import type {
  LlmCompletion,
  LlmCompletionRequest,
  LlmError,
  LlmProvider,
  LlmResult,
} from "./types";
import { llmError } from "./types";
import { isPausedApiKey } from "./paused";
import { pageHuman, type PageHumanResult } from "../ops/page-human";

/** Error codes from the inner adapter that mean "this credential is the
 *  problem; try the other key". 401/403 → AUTHENTICATION; 429/quota →
 *  RATE_LIMITED. We deliberately do NOT fail over on NETWORK/UPSTREAM_ERROR
 *  (a transient Anthropic outage isn't a key problem; rotating keys won't
 *  help and would mask the outage). */
export function isKeyFailure(error: LlmError): boolean {
  if (error.code === "AUTHENTICATION") return true;
  if (error.code === "RATE_LIMITED") return true;
  // Some quota-exhaustion responses arrive as a 400 with a quota message
  // rather than a clean 429. Treat an explicit quota/credit signal as a key
  // failure so a depleted prepaid balance fails over instead of erroring.
  if (
    error.code === "INVALID_ARGUMENT" &&
    /quota|credit|billing|insufficient/i.test(error.message)
  ) {
    return true;
  }
  return false;
}

/** Pager seam injected for tests. Production uses the real `pageHuman`. */
export type PageFn = typeof pageHuman;

export interface KeyRotationOptions {
  enabled?: boolean;
  /** Lazily build the secondary provider. Returns null when no secondary key
   *  is configured. Called at most once (memoized). */
  buildSecondary?: () => LlmProvider | null;
  /** Pager. Defaults to the real `pageHuman`. */
  page?: PageFn;
  /** Restore deadline for the page when BOTH keys are dead. Defaults to 24h
   *  from the failure (the bar's hard ceiling). */
  deadlineMs?: number;
  /** Coalesce window: don't page more than once per this interval for the
   *  same both-dead condition, so a burst of failing calls doesn't email a
   *  human hundreds of times. Defaults to 15 minutes. */
  pageCoalesceMs?: number;
}

const DEFAULT_DEADLINE_MS = 24 * 60 * 60 * 1000;
const DEFAULT_PAGE_COALESCE_MS = 15 * 60 * 1000;

export class KeyRotationLlmProvider implements LlmProvider {
  private readonly primary: LlmProvider;
  private readonly enabled: boolean;
  private readonly buildSecondary: () => LlmProvider | null;
  private readonly page: PageFn;
  private readonly deadlineMs: number;
  private readonly pageCoalesceMs: number;

  /** Performance-only sticky flag: once we fail over, prefer the secondary so
   *  we don't burn a doomed primary call on every subsequent request. Reset
   *  on process restart (cold-start re-discovers the failure). */
  private servingOnSecondary = false;
  private secondaryMemo: LlmProvider | null | undefined;
  private lastBothDeadPageAt = 0;

  constructor(primary: LlmProvider, opts: KeyRotationOptions = {}) {
    this.primary = primary;
    this.enabled = opts.enabled ?? true;
    this.buildSecondary = opts.buildSecondary ?? (() => null);
    this.page = opts.page ?? pageHuman;
    this.deadlineMs = opts.deadlineMs ?? DEFAULT_DEADLINE_MS;
    this.pageCoalesceMs = opts.pageCoalesceMs ?? DEFAULT_PAGE_COALESCE_MS;
  }

  /** Delegate identity so name-based branching is unaffected. */
  get name(): LlmProvider["name"] {
    return this.primary.name;
  }

  private secondary(): LlmProvider | null {
    if (this.secondaryMemo === undefined) {
      this.secondaryMemo = this.buildSecondary();
    }
    return this.secondaryMemo;
  }

  async complete(
    request: LlmCompletionRequest,
  ): Promise<LlmResult<LlmCompletion>> {
    // Kill switch or paused-sentinel primary → straight through. A paused key
    // is an intentional state the Sentinel layer handles; do not fail over it.
    if (!this.enabled || isPausedApiKey(process.env.ANTHROPIC_API_KEY)) {
      return this.primary.complete(request);
    }

    // Sticky: once we've failed over, try the secondary first.
    if (this.servingOnSecondary) {
      const sec = this.secondary();
      if (sec) {
        const result = await sec.complete(request);
        if (result.ok || !isKeyFailure(result.error)) return result;
        // Secondary itself now failing — re-probe the primary as a last
        // resort (maybe it was restored), else degrade.
        const reprobe = await this.primary.complete(request);
        if (reprobe.ok) {
          this.servingOnSecondary = false;
          return reprobe;
        }
        return this.bothDead(request, result.error, reprobe.error);
      }
      // Secondary vanished (shouldn't happen mid-process) — fall back to the
      // primary path below.
      this.servingOnSecondary = false;
    }

    // Primary path.
    const primaryResult = await this.primary.complete(request);
    if (primaryResult.ok || !isKeyFailure(primaryResult.error)) {
      return primaryResult;
    }

    // Primary is the problem — fail over to the secondary if we have one.
    const sec = this.secondary();
    if (!sec) {
      return this.bothDead(request, primaryResult.error, null);
    }
    const secResult = await sec.complete(request);
    if (secResult.ok) {
      // Become sticky on the secondary so we don't keep burning the dead
      // primary on every call. The customer never saw the blip.
      this.servingOnSecondary = true;
      return secResult;
    }
    if (!isKeyFailure(secResult.error)) {
      // Secondary returned a non-key error (e.g. transient network). Surface
      // it rather than degrade — it isn't a both-keys-dead situation.
      return secResult;
    }
    return this.bothDead(request, primaryResult.error, secResult.error);
  }

  /**
   * Both keys are unusable. Degrade EXACTLY like the paused path (calm
   * `PAUSED` result → customer-safe copy at the surface) AND page a human
   * with critical severity + a 24h deadline, naming which keys failed and how.
   */
  private async bothDead(
    _request: LlmCompletionRequest,
    primaryError: LlmError,
    secondaryError: LlmError | null,
  ): Promise<LlmResult<LlmCompletion>> {
    await this.maybePage(primaryError, secondaryError);
    // Customer-facing copy lives at the surface (degraded-mode / chat route),
    // keyed off this PAUSED code — same as the sentinel path. The message
    // here is operator-facing context, never shown raw to a customer.
    return llmError(
      "PAUSED",
      "Anthropic key rotation exhausted: primary and secondary both failed. " +
        "Serving the customer-safe degraded response; a human has been paged.",
    );
  }

  private async maybePage(
    primaryError: LlmError,
    secondaryError: LlmError | null,
  ): Promise<PageHumanResult | null> {
    const now = Date.now();
    if (now - this.lastBothDeadPageAt < this.pageCoalesceMs) {
      // Already paged recently for this condition — don't spam the human.
      return null;
    }
    this.lastBothDeadPageAt = now;

    const secondaryConfigured = this.secondary() !== null;
    const details = [
      "The Anthropic key rotation layer could not serve a model call.",
      "",
      `Primary key (ANTHROPIC_API_KEY): ${describeError(primaryError)}`,
      secondaryConfigured
        ? `Secondary key (ANTHROPIC_API_KEY_SECONDARY): ${
            secondaryError ? describeError(secondaryError) : "not attempted"
          }`
        : "Secondary key (ANTHROPIC_API_KEY_SECONDARY): NOT CONFIGURED — there was no key to fail over to.",
      "",
      "Customer impact: Plaino and every LLM-backed skill are serving the calm " +
        '"briefly offline" degraded response. No raw errors reach customers.',
      "",
      "To restore: rotate a healthy key into ANTHROPIC_API_KEY (and, if missing, " +
        "provision ANTHROPIC_API_KEY_SECONDARY) in Vercel Production, then redeploy. " +
        "The stack re-discovers a healthy primary on the next call.",
    ].join("\n");

    return this.page(
      {
        severity: "critical",
        summary: secondaryConfigured
          ? "Anthropic primary AND secondary keys both failing — LLM degraded"
          : "Anthropic primary key failing, no secondary configured — LLM degraded",
        details,
        deadline: new Date(now + this.deadlineMs),
        source: "llm-key-rotation",
      },
      // pageHuman resolves its own deps (email + db); the rotation layer holds
      // no DB handle of its own.
    );
  }

  /** Test seam: inspect/override the sticky state. */
  get isServingOnSecondary(): boolean {
    return this.servingOnSecondary;
  }
}

function describeError(error: LlmError): string {
  const status = error.status ? ` (HTTP ${error.status})` : "";
  return `${error.code}${status} — ${error.message}`;
}
