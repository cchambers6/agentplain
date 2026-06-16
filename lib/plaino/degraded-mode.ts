/**
 * lib/plaino/degraded-mode.ts
 *
 * Phase-1 honesty seam for /talk. If a load-bearing env var (the
 * encryption key, the LLM credential) is missing in production, the
 * dispatcher would either throw on the very first `encrypt(args.body)`
 * call in PrismaChatStore (MissingKeyError) or silently fall through to
 * the TestLlmProvider heuristic stub — from the customer's POV either
 * looks like "the chat doesn't work."
 *
 * Resolution: detect degraded-mode at the page/server-action seam
 * BEFORE any DB write. When degraded:
 *   - The page renders a synthetic, in-memory "Plaino is offline" notice
 *     above the conversation so the customer sees the state on first
 *     load (no need to send a message to discover).
 *   - The composer still posts; the Server Action returns the customer
 *     notice as a `formError` and does NOT call `runPlainoTurn` — no
 *     DB write, no encryption seam touched, no customer content
 *     persisted in plaintext.
 *
 * This module is intentionally tiny — no Prisma import. Its only LLM
 * dependency is the PURE `isPausedApiKey` prefix-check from the provider
 * seam (`lib/llm/paused.ts`), which pulls in no SDK — so the sentinel
 * SHAPE (`sk-ant-PAUSED-…`) stays defined in exactly one place
 * (feedback_no_silent_vendor_lock) rather than being re-hardcoded here.
 * Otherwise: pure env-check + canned copy. Callable from the Server
 * Action and the page renderer.
 *
 * Per reference_product_claims_vs_reality_2026_05_22: the UI never
 * pretends the chat is working when it isn't.
 *
 * The PAUSED-sentinel branch is the fix for the 2026-06-13 outage: prod's
 * `ANTHROPIC_API_KEY` was the `sk-ant-PAUSED-…` sentinel (set on the
 * 2026-06-02 pause, never restored). It is a NON-EMPTY string, so the
 * old "is the key set?" check passed, the dispatcher ran, every LLM call
 * came back PAUSED, and the customer saw the generic "had trouble drafting
 * a reply" with NO operator alert. Detecting the sentinel HERE means the
 * customer gets the calm honest "briefly offline" notice, no DB write is
 * burned, and the page renderer surfaces the operator restore steps. This
 * matches the stack's real behavior: `SentinelLlmProvider` sits OUTSIDE
 * `KeyRotationLlmProvider` in the compose order, so a sentinel primary
 * short-circuits to PAUSED before any failover — declaring degraded here
 * is faithful, not a guess. (See `lib/llm/paused.ts` + `lib/llm/index.ts`.)
 *
 * Per project_no_outbound_architecture: this notice is in-chat only,
 * not an outbound message. Nothing leaves the workspace.
 */

import { isEncryptionConfigured } from '../security/encryption';
import { isPausedApiKey } from '../llm/paused';

export type DegradedReason =
  | 'ENCRYPTION_KEY_MISSING'
  | 'ANTHROPIC_API_KEY_MISSING'
  | 'ANTHROPIC_API_KEY_PAUSED'
  | 'LLM_DEGRADED_MODE_FORCED';

export type DegradedMode =
  | { degraded: false }
  | {
      degraded: true;
      reason: DegradedReason;
      /** Customer-facing one-liner — what they see in the thread. */
      customerNotice: string;
      /** Operator-facing follow-on — what `settings` should display. */
      operatorNotice: string;
    };

/**
 * Customer-facing "Plaino's resting" line — the calm, intentional framing
 * used for an EXPECTED pause (the `LLM_DEGRADED_MODE` override and, by
 * extension, the default copy the reusable `PlainoRestingBanner` falls back
 * to). It says nothing about *why* (key, quota, vendor) on purpose — the
 * customer surface never names a model vendor or a credential
 * (feedback_no_silent_vendor_lock). The dog is resting; that's all they
 * need to know, and it reads as a deliberate state, not a broken button.
 */
export const PLAINO_RESTING_CUSTOMER_NOTICE =
  "Plaino's resting just now — he'll be back for the next round of work " +
  "as soon as we're ready. Nothing you've set up is lost; it picks right " +
  'back up when he wakes.';

/** Inspect the environment for credentials the dispatcher needs. The
 *  check is intentionally permissive in test mode (`LLM_PROVIDER=test`):
 *  tests don't need a real Anthropic key, and the encryption-test path
 *  injects its own key. */
export function checkDegradedMode(env: NodeJS.ProcessEnv = process.env): DegradedMode {
  // Manual override — checked FIRST, ahead of every other signal including
  // the `LLM_PROVIDER=test` bypass. Two jobs:
  //   1. Local testing. Conner sets `LLM_DEGRADED_MODE=true` in `.env.local`
  //      to see exactly what a customer sees during a pause — the calm
  //      "Plaino's resting" state on every LLM surface — without rotating
  //      the prod key or pausing real spend.
  //   2. A generic forward kill-switch. The current production trigger is the
  //      paused `ANTHROPIC_API_KEY` sentinel (caught below), but if Anthropic
  //      has an outage, quota is exhausted, or the dispatch service degrades
  //      for any reason the env signals haven't yet caught, flipping this on
  //      puts every surface into the same honest resting state in one move.
  if (isDegradedModeForced(env)) {
    return {
      degraded: true,
      reason: 'LLM_DEGRADED_MODE_FORCED',
      customerNotice: PLAINO_RESTING_CUSTOMER_NOTICE,
      operatorNotice:
        'LLM_DEGRADED_MODE is set on this deployment, so every customer-' +
        'facing Plaino surface is showing the calm "resting" state and no ' +
        'model calls are being attempted. This is a manual override (local ' +
        'testing or a deliberate dispatch pause) — unset LLM_DEGRADED_MODE ' +
        '(or set it to off/0/false) and redeploy to bring Plaino back online.',
    };
  }
  if (!isEncryptionConfigured(env.ENCRYPTION_KEY ?? undefined)) {
    return {
      degraded: true,
      reason: 'ENCRYPTION_KEY_MISSING',
      customerNotice:
        "Plaino is offline for the moment — the workspace credential needed " +
        "to save your message securely isn't set. I've flagged this for the " +
        "team. Once it's resolved, I'll be back here waiting.",
      operatorNotice:
        'ENCRYPTION_KEY env var is missing on the production deployment. ' +
        'Generate a 32-byte hex string (`openssl rand -hex 32`), set it via ' +
        '`vercel env add ENCRYPTION_KEY production`, redeploy, then Plaino ' +
        'will come back online for this workspace.',
    };
  }
  // LLM_PROVIDER=test bypasses the LLM credential check — the test
  // provider does not need a real Anthropic key.
  if (env.LLM_PROVIDER === 'test') return { degraded: false };
  const anthropic = env.ANTHROPIC_API_KEY;
  if (!anthropic || anthropic.trim().length === 0) {
    return {
      degraded: true,
      reason: 'ANTHROPIC_API_KEY_MISSING',
      customerNotice:
        "Plaino is offline for the moment — the model credential I need to " +
        "fetch and herd is missing on this deployment. I've flagged it for " +
        "the team and they'll wire it up; once it's set, I'll be back here.",
      operatorNotice:
        'ANTHROPIC_API_KEY env var is missing on the production deployment. ' +
        'Without it the dispatcher falls through to the TestLlmProvider stub, ' +
        'producing canned heuristic output. Set it via `vercel env add ' +
        'ANTHROPIC_API_KEY production` and redeploy.',
    };
  }
  // The deliberate "paused spend" sentinel (`sk-ant-PAUSED-…`) is a
  // non-empty string, so it slips past the check above — then EVERY model
  // call short-circuits to PAUSED at the SentinelLlmProvider layer. Catch
  // it here so the customer gets the calm "briefly offline" notice instead
  // of a confusing post-send "had trouble drafting a reply", and no DB
  // write is burned persisting a doomed turn. Respect the dev kill-switch
  // `LLM_SENTINEL_BYPASS` (a dev pointing a real key through the full
  // stack) — when bypass is on, the stack does NOT short-circuit, so we
  // must not declare degraded here either.
  if (isPausedApiKey(anthropic) && !isSentinelBypassed(env)) {
    return {
      degraded: true,
      reason: 'ANTHROPIC_API_KEY_PAUSED',
      customerNotice:
        "Plaino's resting right now — model spend is paused on this " +
        "deployment, so I can't draft a reply yet. I've flagged it for the " +
        "team; once it's switched back on, I'll be right here.",
      operatorNotice:
        'ANTHROPIC_API_KEY is the paused sentinel (`sk-ant-PAUSED-…`) — spend ' +
        'was paused and never restored. Every Plaino turn short-circuits to ' +
        'PAUSED, so customers get no replies. Restore a live key via ' +
        '`vercel env add ANTHROPIC_API_KEY production` (or rotate back the ' +
        'real key) and redeploy.',
    };
  }
  return { degraded: false };
}

/** True when an operator has forced degraded mode via `LLM_DEGRADED_MODE`.
 *  Accepts the on-ish values `true` / `1` / `on` so it matches the other
 *  env switches in `lib/llm/index.ts`. Unset (or `off` / `0` / `false`)
 *  leaves the real key-state signals in charge. */
function isDegradedModeForced(env: NodeJS.ProcessEnv): boolean {
  const v = env.LLM_DEGRADED_MODE;
  return v === 'true' || v === '1' || v === 'on';
}

/** Mirror of `lib/llm/index.ts`'s `sentinelEnabled()` bypass read, inlined
 *  to keep this module free of the provider graph (and its SDK import).
 *  `LLM_SENTINEL_BYPASS` set to an on-ish value disables the short-circuit. */
function isSentinelBypassed(env: NodeJS.ProcessEnv): boolean {
  const v = env.LLM_SENTINEL_BYPASS;
  return v === 'on' || v === '1' || v === 'true';
}

/** Stable metadata kind for a degraded-mode notice. The chat page
 *  renderer can switch on this to show a distinct visual treatment
 *  (and the operator-facing prose) rather than treating it as a
 *  normal Plaino message. */
export const DEGRADED_MODE_METADATA_KIND = 'DEGRADED_MODE_NOTICE' as const;
