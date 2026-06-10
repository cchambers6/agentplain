/**
 * lib/plaino/reply-card.ts
 *
 * Deterministic card-attach logic for Plaino chat replies.
 *
 * WHY THIS EXISTS: the dispatcher produces a text reply in every turn.
 * The talk-view already renders `metadata.card` via `parsePlainoCard`.
 * This module closes the seam: when should a reply carry the activation /
 * what-next card, and what does that card contain?
 *
 * TWO QUESTIONS:
 *
 *   1. WHEN should the card attach?
 *      A card is helpful at the right frequency; attached to every single
 *      reply it becomes noise. The rule (pure, tested):
 *        (a) the first Plaino reply in the conversation (history empty),
 *        (b) or the customer's message matches an onboarding/what-next
 *            intent (regex-tested against the trimmed customer message), OR
 *        (c) the turn is a degraded placeholder (LLM offline) — this is
 *            when the card is MOST valuable: the customer still gets a
 *            useful next action even though Plaino can't answer.
 *        NOT attached on every ANSWER/REGISTER/INSTRUCT/PREFERENCE turn
 *        after the first — that would spam the thread.
 *
 *   2. WHAT does the card contain?
 *      `buildActivationCard` from `lib/plaino/next-steps` is the seam:
 *      it is pure, deterministic, zero LLM. It reads the workspace vertical
 *      + the capability snapshot the dispatcher already computed, so there
 *      is NO second DB read. `firstSession` is derived from the onboarding
 *      state embedded in the capability snapshot (or defaults to `true`
 *      when absent — new workspaces always see the killer-workflow lead).
 *
 * PER PROJECT_NO_OUTBOUND: the card contains only deep-links into the
 * workspace's own surfaces. Nothing here sends.
 *
 * ADDITIVE: the card is `metadata.card` on the existing `PersistedChatMessage`.
 * The prose reply is always the source of truth; the card is enhancement.
 * A missing or malformed card degrades silently (talk-view guards this).
 * Zero migration, zero new approval kinds.
 *
 * MARKETING MODE: the `/api/chat` marketing route does not use the dispatcher
 * at all — it has no workspace context. The card is only attached by the
 * dispatcher, which is only called in the workspace (`/talk`) surface.
 * There is therefore no risk of leaking workspace cards into the anonymous
 * marketing widget.
 */

import type { Vertical } from '@prisma/client';
import { buildActivationCard } from './next-steps';
import type {
  NextStepsApprovalState,
  NextStepsComplianceState,
  NextStepsOnboardingState,
} from './next-steps';
import type { PlainoCapabilitySnapshot } from './types';
import type { NextStepsCard } from './visual-card';

// ── Intent detection ─────────────────────────────────────────────────────────

/**
 * Customer messages that map to "what can you do?" / "what should I do next?"
 * intents. Regex-tested against the trimmed, lowercased message. When any
 * pattern fires, the card attaches regardless of how far through the
 * conversation the customer is.
 *
 * Conservative set: we only match messages that are genuinely asking Plaino
 * about its own capabilities or what the customer should do next. We do NOT
 * match generic greetings so regular "hi" messages don't get the card.
 */
const CARD_INTENT_PATTERNS: RegExp[] = [
  // "what can you do" / "what are your capabilities" / "what do you do"
  /what\s+(?:can\s+you|do\s+you|are\s+you\s+able\s+to)\s+(?:do|help|assist)/i,
  // "what should I do next" / "what's next" / "what next" / "what do I do next"
  /what(?:'s|\s+is)?\s+next/i,
  /what\s+(?:should\s+i|do\s+i)\s+do\s+next/i,
  // "help me get started" / "how do I start" / "where do I start" / "get started"
  /(?:get|getting|how\s+do\s+i|where\s+do\s+i)\s+start(?:ed)?/i,
  // "show me what you can do" / "walk me through"
  /show\s+me\s+what\s+you\s+can/i,
  /walk\s+me\s+through/i,
  // "set up" / "onboard" / "onboarding"
  /\bonboard(?:ing)?\b/i,
  /\bset\s+(?:me\s+)?up\b/i,
  // "what's the killer workflow" / "killer workflow"
  /\bkiller.?workflow\b/i,
];

/**
 * Does the customer message carry an intent that warrants the card?
 * Pure, tested, no I/O.
 */
export function messageHasCardIntent(customerMessage: string): boolean {
  return CARD_INTENT_PATTERNS.some((re) => re.test(customerMessage));
}

// ── Frequency rule ───────────────────────────────────────────────────────────

export interface ShouldAttachCardArgs {
  /** True when the conversation has no prior Plaino replies (first turn). */
  isFirstReply: boolean;
  /** True when the customer's message matches an onboarding/what-next intent. */
  hasCardIntent: boolean;
  /** True when this is a degraded placeholder reply (LLM offline). */
  isDegradedPlaceholder: boolean;
}

/**
 * Pure rule: should the card attach to this Plaino reply?
 *
 * Attaches when:
 *   (a) it's the first reply in the conversation, OR
 *   (b) the customer explicitly asked "what can you do / what's next", OR
 *   (c) this is a degraded placeholder (LLM offline) — most valuable moment.
 *
 * Does NOT attach on every regular ANSWER/REGISTER/INSTRUCT turn after
 * the first — that would spam the thread.
 */
export function shouldAttachCard(args: ShouldAttachCardArgs): boolean {
  return args.isFirstReply || args.hasCardIntent || args.isDegradedPlaceholder;
}

// ── Card assembly ────────────────────────────────────────────────────────────

export interface BuildReplyCardArgs {
  workspaceId: string;
  /** The capability snapshot the dispatcher already computed — zero extra DB read. */
  snapshot: PlainoCapabilitySnapshot;
  /** The workspace vertical (null = not yet picked). */
  vertical: Vertical | null;
  /** Onboarding state for the card's setup-gap steps. Defaults to all-false
   *  (new workspace) when not provided — conservative, never over-claims. */
  onboarding?: NextStepsOnboardingState;
  /** Approval-queue snapshot. Defaults to empty. */
  approvals?: NextStepsApprovalState;
  /** Compliance snapshot. Defaults to no open flags. */
  compliance?: NextStepsComplianceState;
  /** Whether the workspace is still in its first session (leads the card with
   *  the killer workflow). Default true — new workspaces always see the
   *  killer-workflow lead. Callers that know onboarding is complete pass false. */
  firstSession?: boolean;
}

const DEFAULT_ONBOARDING: NextStepsOnboardingState = {
  verticalPicked: false,
  firstToolConnected: false,
  scheduleWindowSet: false,
  firstDraftReviewed: false,
};

const EMPTY_APPROVALS: NextStepsApprovalState = {
  draftsWaiting: 0,
  oldestAgeHrs: 0,
};

const EMPTY_COMPLIANCE: NextStepsComplianceState = {
  openFlags: 0,
};

/**
 * Build the activation/next-steps card from the dispatcher's in-hand
 * capability snapshot. Pure, zero LLM, zero extra DB read.
 *
 * In production the dispatcher passes the snapshot it already loaded at
 * the start of the turn; the card branches on the same connected-provider
 * set the system prompt was built from — no drift.
 */
export function buildReplyCard(args: BuildReplyCardArgs): NextStepsCard {
  return buildActivationCard({
    workspaceId: args.workspaceId,
    vertical: args.vertical ?? null,
    snapshot: args.snapshot,
    onboarding: args.onboarding ?? DEFAULT_ONBOARDING,
    approvals: args.approvals ?? EMPTY_APPROVALS,
    compliance: args.compliance ?? EMPTY_COMPLIANCE,
    firstSession: args.firstSession ?? true,
  });
}

// ── Test surface ─────────────────────────────────────────────────────────────

export const __testing = {
  CARD_INTENT_PATTERNS,
};
