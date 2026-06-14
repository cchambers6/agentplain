/**
 * lib/plaino/turn-failure.ts
 *
 * Pure triage for a failed Plaino turn.
 *
 * `runPlainoTurn` returns a rich `SkillError` on the soft-fail path (LLM
 * provider failure, malformed classifier output, etc.) and the dispatcher
 * has ALREADY persisted a placeholder reply + the customer's message before
 * returning. The customer-facing `/talk` server action then has to decide
 * three things:
 *
 *   1. What HONEST line to show the customer under the composer — a paused
 *      credential is "Plaino's briefly offline", a rate-limit is "busy, try
 *      again", a real parse defect is the generic apology. Collapsing all of
 *      them into one opaque "had trouble drafting a reply" is the bug this
 *      module exists to kill: it read as "the product is broken" with no
 *      signal to the customer or to ops about WHY. (The symptom Conner hit
 *      2026-06-13 — see fix/plaino-chat-broken-diagnose-and-repair.)
 *
 *   2. Whether to PAGE A HUMAN. A dead/paused Anthropic key takes the whole
 *      chat surface down for every workspace — that is customer-impacting and
 *      a person must know NOW (the silent-fail-loud bar from PR #239). A
 *      transient rate-limit or a one-off malformed-JSON turn is NOT
 *      page-worthy — Sentry alone is enough, so we don't train the on-call to
 *      ignore the pager.
 *
 *   3. How loud to make the Sentry event (severity).
 *
 * Keeping this as a pure function over the `SkillError` (no env, no I/O) makes
 * the whole policy unit-testable without standing up Prisma / email / the LLM
 * stack — the server action just wires the result into `pageHuman` +
 * `reportMessage` + the returned `formError`.
 *
 * Per `reference_product_claims_vs_reality`: every customer line here is
 * honest — it never pretends the reply is coming when it isn't.
 */

import type { SkillError } from '../skills/types';
import type { PageSeverity } from '../ops/page-human';

/** Stable category for tags / filtering / test assertions. */
export type TurnFailureCategory =
  | 'credential'
  | 'budget'
  | 'transient'
  | 'defect'
  | 'unknown';

export interface TurnFailureTriage {
  /** Honest, calm, customer-facing line shown under the composer. */
  customerNotice: string;
  /** Page a human? True only for customer-impacting credential failures —
   *  the ones a transient retry can't fix and that take the surface down. */
  shouldPage: boolean;
  /** Severity for the page + the Sentry level. */
  severity: PageSeverity;
  /** Short, phone-lock-screen-scannable summary for the page subject +
   *  the Sentry message. Names the actual failure, never "an error". */
  opsSummary: string;
  /** Stable category for indexed tags + tests. */
  category: TurnFailureCategory;
}

// Calm, honest, heritage-voice copy — matches lib/plaino/degraded-mode.ts.
const CREDENTIAL_NOTICE =
  "Plaino's briefly offline and couldn't draft a reply just now — your note " +
  "is saved and the team's already been alerted. Try again in a little while.";

const BUDGET_NOTICE =
  "This workspace has reached its usage limit for the month, so I can't draft " +
  "new replies right now. Your note is saved — reach out to lift the limit and " +
  "I'll pick this right back up.";

const TRANSIENT_NOTICE =
  "Plaino's handling a lot right now and couldn't draft a reply this moment. " +
  "Your note is saved — try again in a few seconds.";

// The original generic apology, kept for genuine defects (a malformed model
// response, an unexpected classifier output) where "try again" is the honest
// advice and we don't want to over-claim a specific cause.
const DEFECT_NOTICE =
  "We saved your note but had trouble drafting a reply. Try again or post a " +
  "fresh message.";

/**
 * Triage a failed Plaino turn into (honest customer copy, page decision,
 * severity, ops summary). Keys primarily off the downstream LLM error code
 * carried in `error.reference` (set by the dispatcher when the LLM provider
 * fails), falling back to the `SkillError.code` for dispatcher-internal
 * failures (malformed classifier output, invalid decision shape).
 */
export function triagePlainoTurnFailure(error: SkillError): TurnFailureTriage {
  // The dispatcher stuffs the LlmErrorCode into `reference` for the
  // UPSTREAM_LLM_ERROR path; that is the most specific signal we have.
  const llmCode = error.code === 'UPSTREAM_LLM_ERROR' ? error.reference : undefined;

  switch (llmCode) {
    case 'PAUSED':
      return {
        customerNotice: CREDENTIAL_NOTICE,
        shouldPage: true,
        severity: 'critical',
        opsSummary:
          'Plaino chat down — Anthropic key is the PAUSED sentinel; every workspace gets no replies until a live key is restored.',
        category: 'credential',
      };
    case 'AUTHENTICATION':
      return {
        customerNotice: CREDENTIAL_NOTICE,
        shouldPage: true,
        severity: 'critical',
        opsSummary:
          'Plaino chat down — Anthropic rejected the API key (401/403); every workspace gets no replies until a valid key is set.',
        category: 'credential',
      };
    case 'NOT_CONFIGURED':
      return {
        customerNotice: CREDENTIAL_NOTICE,
        shouldPage: true,
        severity: 'critical',
        opsSummary:
          'Plaino chat down — Anthropic provider has no API key configured; every workspace gets no replies.',
        category: 'credential',
      };
    case 'OVER_BUDGET':
      return {
        customerNotice: BUDGET_NOTICE,
        shouldPage: false,
        severity: 'info',
        opsSummary:
          'Plaino turn blocked — workspace is over its monthly token budget (expected throttle, not an outage).',
        category: 'budget',
      };
    case 'RATE_LIMITED':
      return {
        customerNotice: TRANSIENT_NOTICE,
        shouldPage: false,
        severity: 'warn',
        opsSummary:
          'Plaino turn failed — Anthropic rate-limited the request (429). Transient; watch for a sustained spike.',
        category: 'transient',
      };
    case 'NETWORK':
    case 'UPSTREAM_ERROR':
      return {
        customerNotice: TRANSIENT_NOTICE,
        shouldPage: false,
        severity: 'warn',
        opsSummary:
          'Plaino turn failed — transient upstream/network error reaching Anthropic.',
        category: 'transient',
      };
    case 'INVALID_ARGUMENT':
      // A 400 usually means a malformed request — most often a stale/invalid
      // model identifier. That is a config DEFECT, not transient, so page at
      // warn so it gets looked at rather than retried forever.
      return {
        customerNotice: DEFECT_NOTICE,
        shouldPage: true,
        severity: 'warn',
        opsSummary:
          'Plaino turn failed — Anthropic rejected the request as invalid (400). Likely a stale model id or bad request shape; check lib/llm/model-tiers.ts.',
        category: 'defect',
      };
    default:
      break;
  }

  // No LlmErrorCode (dispatcher-internal failure) or an unmapped one.
  if (error.code === 'PARSE_ERROR') {
    return {
      customerNotice: DEFECT_NOTICE,
      shouldPage: false,
      severity: 'warn',
      opsSummary:
        'Plaino turn failed — classifier returned malformed/invalid output. Sentry has the parse detail.',
      category: 'defect',
    };
  }

  return {
    customerNotice: DEFECT_NOTICE,
    shouldPage: false,
    severity: 'warn',
    opsSummary: `Plaino turn failed — ${error.code}${
      error.reference ? ` (${error.reference})` : ''
    }.`,
    category: 'unknown',
  };
}
