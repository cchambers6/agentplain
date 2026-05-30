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
 * This module is intentionally tiny — no Prisma import, no LLM import.
 * Pure env-check + canned copy. Callable from the Server Action and the
 * page renderer.
 *
 * Per reference_product_claims_vs_reality_2026_05_22: the UI never
 * pretends the chat is working when it isn't.
 *
 * Per project_no_outbound_architecture: this notice is in-chat only,
 * not an outbound message. Nothing leaves the workspace.
 */

import { isEncryptionConfigured } from '../security/encryption';

export type DegradedMode =
  | { degraded: false }
  | {
      degraded: true;
      reason: 'ENCRYPTION_KEY_MISSING' | 'ANTHROPIC_API_KEY_MISSING';
      /** Customer-facing one-liner — what they see in the thread. */
      customerNotice: string;
      /** Operator-facing follow-on — what `settings` should display. */
      operatorNotice: string;
    };

/** Inspect the environment for credentials the dispatcher needs. The
 *  check is intentionally permissive in test mode (`LLM_PROVIDER=test`):
 *  tests don't need a real Anthropic key, and the encryption-test path
 *  injects its own key. */
export function checkDegradedMode(env: NodeJS.ProcessEnv = process.env): DegradedMode {
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
  return { degraded: false };
}

/** Stable metadata kind for a degraded-mode notice. The chat page
 *  renderer can switch on this to show a distinct visual treatment
 *  (and the operator-facing prose) rather than treating it as a
 *  normal Plaino message. */
export const DEGRADED_MODE_METADATA_KIND = 'DEGRADED_MODE_NOTICE' as const;
