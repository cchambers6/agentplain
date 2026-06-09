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

// ── V31 — BeforeAfterCard ───────────────────────────────────────────────────

export interface BeforeAfterRow {
  /** A specific task or pain point, e.g. "chasing overdue invoices". */
  task: string;
  /** How it looked before, e.g. "manual spreadsheet, 2 hrs/week". */
  before: string;
  /** How it looks with agentplain, e.g. "auto-drafted + queued for review". */
  after: string;
}

/** V31 — "can it help me?" → side-by-side before/after comparison.
 *  Max 4 rows; every row must have all three fields (text fallback is the
 *  `text` field on the persisted message body — this card is enhancement only). */
export interface BeforeAfterCard {
  type: 'before-after';
  /** Short context label, e.g. "for a property management company". */
  context?: string;
  rows: BeforeAfterRow[];
}

// ── V32 — DecisionTreeCard ──────────────────────────────────────────────────

export interface DecisionBranch {
  /** The condition label, e.g. "I have a contractor team". */
  condition: string;
  /** Where this branch routes, e.g. "contracts & scheduling". */
  outcome: string;
  /** Deep link into the workspace for this path. */
  href: string;
  /** Optional: which discipline/skill covers this branch. */
  discipline?: string;
}

/** V32 — "which workflow fits me?" → a branching decision card.
 *  2–4 branches; each branch is a real deep link. The question is the
 *  routing question the card answers. */
export interface DecisionTreeCard {
  type: 'decision-tree';
  /** The routing question, e.g. "Which kind of work is most urgent?" */
  question: string;
  branches: DecisionBranch[];
}

// ── V33 — CompliancePostureCard ─────────────────────────────────────────────

export interface ComplianceArea {
  /** Area label, e.g. "real estate license disclosures". */
  label: string;
  /** Whether the sentinel has coverage for this area. */
  covered: boolean;
}

/** V33 — compliance posture mini — read-only coverage + recent flags.
 *  Surfaces sentinel coverage state without triggering an LLM call.
 *  `coverageAreas` is the list of areas the sentinel monitors for this
 *  workspace's vertical; `recentFlags` is the count over the last 30 days. */
export interface CompliancePostureCard {
  type: 'compliance-posture';
  vertical: string;
  coverageAreas: ComplianceArea[];
  recentFlags: number;
  openFlags: number;
  /** Deep link to the workspace's compliance page. */
  complianceHref: string;
}

// ── V34 — OnboardingProgressCard ────────────────────────────────────────────

export interface OnboardingMilestone {
  /** Step label, e.g. "Pick your vertical". */
  label: string;
  /** Whether this milestone has been completed. */
  done: boolean;
  /** Deep link to complete this step (only relevant when !done). */
  href: string;
}

/** V34 — onboarding progress — sequential milestone trail with completion state.
 *  Shows the customer exactly where they are in setup and what's left.
 *  Never throws: missing `milestones` defaults to empty (degrades to nothing). */
export interface OnboardingProgressCard {
  type: 'onboarding-progress';
  /** 0–100 integer percentage (computed from milestones). */
  pct: number;
  milestones: OnboardingMilestone[];
}

export type PlainoCard =
  | NextStepsCard
  | CapabilityCard
  | WorkStatusCard
  | NavCard
  | BeforeAfterCard
  | DecisionTreeCard
  | CompliancePostureCard
  | OnboardingProgressCard;

const CARD_TYPES = new Set([
  'next-steps',
  'capability',
  'work-status',
  'nav',
  'before-after',
  'decision-tree',
  'compliance-posture',
  'onboarding-progress',
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
    case 'before-after': {
      if (!Array.isArray(v.rows)) return null;
      const rows = v.rows.filter(isBeforeAfterRow);
      if (rows.length === 0) return null;
      const card: BeforeAfterCard = { type: 'before-after', rows };
      if (typeof v.context === 'string') card.context = v.context;
      return card;
    }
    case 'decision-tree': {
      if (typeof v.question !== 'string' || !Array.isArray(v.branches)) return null;
      const branches = v.branches.filter(isDecisionBranch);
      if (branches.length === 0) return null;
      return { type: 'decision-tree', question: v.question, branches };
    }
    case 'compliance-posture': {
      if (
        typeof v.vertical !== 'string' ||
        !Array.isArray(v.coverageAreas) ||
        typeof v.recentFlags !== 'number' ||
        typeof v.openFlags !== 'number' ||
        typeof v.complianceHref !== 'string'
      ) {
        return null;
      }
      const coverageAreas = v.coverageAreas.filter(isComplianceArea);
      return {
        type: 'compliance-posture',
        vertical: v.vertical,
        coverageAreas,
        recentFlags: v.recentFlags,
        openFlags: v.openFlags,
        complianceHref: v.complianceHref,
      };
    }
    case 'onboarding-progress': {
      if (typeof v.pct !== 'number' || !Array.isArray(v.milestones)) return null;
      const milestones = v.milestones.filter(isOnboardingMilestone);
      return {
        type: 'onboarding-progress',
        pct: Math.max(0, Math.min(100, Math.round(v.pct))),
        milestones,
      };
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

function isBeforeAfterRow(x: unknown): x is BeforeAfterRow {
  if (!x || typeof x !== 'object') return false;
  const r = x as Record<string, unknown>;
  return (
    typeof r.task === 'string' &&
    typeof r.before === 'string' &&
    typeof r.after === 'string'
  );
}

function isDecisionBranch(x: unknown): x is DecisionBranch {
  if (!x || typeof x !== 'object') return false;
  const b = x as Record<string, unknown>;
  return (
    typeof b.condition === 'string' &&
    typeof b.outcome === 'string' &&
    typeof b.href === 'string'
  );
}

function isComplianceArea(x: unknown): x is ComplianceArea {
  if (!x || typeof x !== 'object') return false;
  const a = x as Record<string, unknown>;
  return typeof a.label === 'string' && typeof a.covered === 'boolean';
}

function isOnboardingMilestone(x: unknown): x is OnboardingMilestone {
  if (!x || typeof x !== 'object') return false;
  const m = x as Record<string, unknown>;
  return (
    typeof m.label === 'string' &&
    typeof m.done === 'boolean' &&
    typeof m.href === 'string'
  );
}
