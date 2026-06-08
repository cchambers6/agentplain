/**
 * The Plaino chat "what next" visual-card carrier (V27–V30) — the retention
 * payload of the explainer visual system.
 *
 * Spec: docs/explainer-visual-system-2026-06-07.md §4.
 * Conner (verbatim 2026-06-07): "when someone asks Plaino, what do I do next,
 * there is not only readable material but visual explanations that help our
 * users be successful and retain them."
 *
 * ZERO SCHEMA CHANGE. PersistedChatMessage.metadata is already
 * `Record<string, unknown> | null` (lib/plaino/types.ts) and is persisted per
 * message. The card is ADDITIVE metadata on the existing Plaino reply — no
 * migration, no new table, no new approval kind (same discipline that kept the
 * chatbot clean in project_plaino_chatbot_two_surfaces).
 *
 * The text answer is ALWAYS the source of truth; the card is an enhancement
 * rendered beneath the prose. If metadata is absent or malformed, the renderer
 * degrades to text-only and never throws (feedback_cold_start_safe_agents +
 * the dispatcher's existing degraded-mode discipline).
 */

/** Reuses talk-view's instruction-state union; kept local so this module has no
 *  UI dependency. The values mirror the work lifecycle the InstructionTile
 *  already renders. */
export type PlainoCardInstructionState =
  | 'drafting'
  | 'awaiting-review'
  | 'approved';

export interface NextStep {
  /** Plain-language action, e.g. "review 3 drafts waiting on you". The card is
   *  screen-reader complete from this label alone. */
  label: string;
  /** Deep link into the workspace (relative path). */
  href: string;
  /** primary = clay; at most one primary per card. */
  weight: 'primary' | 'normal';
  /** One-line rationale. Optional. */
  why?: string;
}

export interface QueueGlance {
  drafts: number;
  flags: number;
  oldestAgeHrs: number;
}

export interface ConnectCta {
  /** Marketplace tile id to connect, e.g. "gmail". */
  integrationId: string;
  /** Human label, e.g. "Gmail". */
  label: string;
  /** Deep link to the connect surface. */
  href: string;
}

export interface NavTarget {
  label: string;
  href: string;
}

/** V27 — "what should I do next?" → 2–4 prioritized steps + an optional queue
 *  glance. The retention payload. */
export interface NextStepsCard {
  type: 'next-steps';
  steps: NextStep[];
  queue?: QueueGlance;
}

/** V28 — "can you do X?" → a verdict + detail, with a connect CTA when the
 *  gap is connectable. Also carries the DECLINE_HONESTLY named gap. */
export interface CapabilityCard {
  type: 'capability';
  verdict: 'yes' | 'not-yet' | 'roadmap';
  detail: string;
  /** The specific named gap on a not-yet/roadmap verdict. */
  namedGap?: string;
  connect?: ConnectCta;
}

/** V29 — any INSTRUCT hand-off → a work-status progress card deep-linking into
 *  the approvals queue. */
export interface WorkStatusCard {
  type: 'work-status';
  state: PlainoCardInstructionState;
  approvalId: string;
  discipline: string | null;
}

/** V30 — "where do I find X?" → workspace navigation tiles. */
export interface NavCard {
  type: 'nav';
  destinations: NavTarget[];
}

export type PlainoCard =
  | NextStepsCard
  | CapabilityCard
  | WorkStatusCard
  | NavCard;

const CARD_TYPES = new Set([
  'next-steps',
  'capability',
  'work-status',
  'nav',
]);

/**
 * Validate a `card` field pulled off message metadata. Returns the card if it
 * is structurally a `PlainoCard`, else null. The renderer calls this so a
 * malformed/legacy metadata blob degrades to text-only instead of throwing
 * (mirrors the dispatcher's degraded-mode discipline).
 *
 * This is intentionally shallow + total: it never throws, and it accepts the
 * `unknown` that comes off `metadata.card`.
 */
export function parsePlainoCard(value: unknown): PlainoCard | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (typeof v.type !== 'string' || !CARD_TYPES.has(v.type)) return null;

  switch (v.type) {
    case 'next-steps': {
      if (!Array.isArray(v.steps)) return null;
      const steps = v.steps.filter(isNextStep);
      if (steps.length === 0) return null;
      const card: NextStepsCard = { type: 'next-steps', steps };
      if (isQueueGlance(v.queue)) card.queue = v.queue;
      return card;
    }
    case 'capability': {
      if (
        (v.verdict !== 'yes' &&
          v.verdict !== 'not-yet' &&
          v.verdict !== 'roadmap') ||
        typeof v.detail !== 'string'
      ) {
        return null;
      }
      const card: CapabilityCard = {
        type: 'capability',
        verdict: v.verdict,
        detail: v.detail,
      };
      if (typeof v.namedGap === 'string') card.namedGap = v.namedGap;
      if (isConnectCta(v.connect)) card.connect = v.connect;
      return card;
    }
    case 'work-status': {
      if (
        (v.state !== 'drafting' &&
          v.state !== 'awaiting-review' &&
          v.state !== 'approved') ||
        typeof v.approvalId !== 'string'
      ) {
        return null;
      }
      return {
        type: 'work-status',
        state: v.state,
        approvalId: v.approvalId,
        discipline:
          typeof v.discipline === 'string' ? v.discipline : null,
      };
    }
    case 'nav': {
      if (!Array.isArray(v.destinations)) return null;
      const destinations = v.destinations.filter(isNavTarget);
      if (destinations.length === 0) return null;
      return { type: 'nav', destinations };
    }
    default:
      return null;
  }
}

function isNextStep(x: unknown): x is NextStep {
  if (!x || typeof x !== 'object') return false;
  const s = x as Record<string, unknown>;
  return (
    typeof s.label === 'string' &&
    typeof s.href === 'string' &&
    (s.weight === 'primary' || s.weight === 'normal')
  );
}

function isQueueGlance(x: unknown): x is QueueGlance {
  if (!x || typeof x !== 'object') return false;
  const q = x as Record<string, unknown>;
  return (
    typeof q.drafts === 'number' &&
    typeof q.flags === 'number' &&
    typeof q.oldestAgeHrs === 'number'
  );
}

function isConnectCta(x: unknown): x is ConnectCta {
  if (!x || typeof x !== 'object') return false;
  const c = x as Record<string, unknown>;
  return (
    typeof c.integrationId === 'string' &&
    typeof c.label === 'string' &&
    typeof c.href === 'string'
  );
}

function isNavTarget(x: unknown): x is NavTarget {
  if (!x || typeof x !== 'object') return false;
  const n = x as Record<string, unknown>;
  return typeof n.label === 'string' && typeof n.href === 'string';
}
