/**
 * lib/skills/model-assignment.ts
 *
 * The single source of truth for "which model tier does each skill run on?"
 *
 * Today that decision is correct but SCATTERED: each skill hard-codes a
 * `model: MODEL_OPUS | MODEL_SONNET | MODEL_HAIKU` constant at its call site
 * (see `lib/llm/model-tiers.ts`), and the forward-looking routing safety net
 * (`lib/llm/routing-provider.ts`) maps a coarse `sourceSurface` tag to a tier.
 * Neither gives you one place to answer "what does the whole fleet cost per
 * tier, and is any customer-facing surface accidentally on Haiku?"
 *
 * This registry is that place. It pins every skill in `SKILL_CATALOG` to an
 * explicit tier with a rationale, so:
 *   - the cost-projection math (`docs/scaling/api-cost-projection-*.md`) has a
 *     ground-truth tier mix instead of a guess;
 *   - a new skill that forgets to set `model:` can be routed from here;
 *   - a consistency test (`model-assignment.test.ts`) guarantees the registry
 *     covers the catalog and never contradicts the routing policy.
 *
 * The calibration is Conner's (see `model-tiers.ts` header): keep Opus on
 * every surface a CUSTOMER READS (drafts, briefings, reports, compliance,
 * support replies, research synthesis), downgrade to Sonnet for moderate
 * reasoning / extraction / coordination / routine chase nudges, and use Haiku
 * only for narrow internal classifiers where it reaches the same answer at
 * ~25× lower cost. Customer never picks the model — this file does.
 *
 * Per `feedback_no_silent_vendor_lock`: this maps to the in-house
 * `MODEL_*` tier surface, not a raw vendor string — one file changes the day
 * Anthropic ships a new model.
 */

import { MODEL_HAIKU, MODEL_OPUS, MODEL_SONNET } from '@/lib/llm/model-tiers';
import type { LlmSourceSurfaceTag } from '@/lib/llm/types';

export type ModelTier = 'opus' | 'sonnet' | 'haiku';

export interface SkillModelAssignment {
  /** Matches a `SKILL_CATALOG` slug. */
  slug: string;
  tier: ModelTier;
  /** The resolved model id for this tier (from `model-tiers.ts`). */
  model: string;
  /** The `sourceSurface` tag the skill should tag its calls with, when one of
   *  the canonical surfaces applies (drives the routing policy + usage
   *  breakdown). `OTHER` for surfaces without a dedicated tag yet. */
  sourceSurface: LlmSourceSurfaceTag;
  /** Why this tier — the one-line cost/quality justification. */
  rationale: string;
}

const TIER_MODEL: Record<ModelTier, string> = {
  opus: MODEL_OPUS,
  sonnet: MODEL_SONNET,
  haiku: MODEL_HAIKU,
};

// Internal authoring shape — `model` is derived from `tier` so the two can
// never drift.
interface Assignment {
  slug: string;
  tier: ModelTier;
  sourceSurface: LlmSourceSurfaceTag;
  rationale: string;
}

const ASSIGNMENTS: Assignment[] = [
  // ── OPUS — customer reads the output. Quality over cost. ─────────────────
  {
    slug: 'support-handler',
    tier: 'opus',
    sourceSurface: 'SUPPORT_HANDLER',
    rationale: 'Customer-facing support reply — the customer reads every word.',
  },
  {
    slug: 'analytics-weekly-pulse-general',
    tier: 'opus',
    sourceSurface: 'OTHER',
    rationale: 'Weekly analytics briefing the owner reads — synthesis quality matters.',
  },
  {
    slug: 'finance-pulse-general',
    tier: 'opus',
    sourceSurface: 'OTHER',
    rationale: 'Financial pulse report — numbers narrated to the owner; Opus reasoning.',
  },
  {
    slug: 'compliance-watch-general',
    tier: 'opus',
    sourceSurface: 'OTHER',
    rationale: 'Compliance alerts — highest-stakes accuracy; never downgrade.',
  },
  {
    slug: 'content-calendar-drafter-general',
    tier: 'opus',
    sourceSurface: 'OTHER',
    rationale: 'Creative content drafts the owner publishes — voice quality matters.',
  },
  {
    slug: 'process-doc-drafter-general',
    tier: 'opus',
    sourceSurface: 'PROCESS_DOC_DRAFTER',
    rationale: 'Synthesizes how an office works into a doc the team relies on.',
  },
  {
    slug: 'research-on-demand-general',
    tier: 'opus',
    sourceSurface: 'OTHER',
    rationale: 'On-demand research synthesis the owner acts on — depth matters.',
  },
  {
    slug: 'lead-triage-realestate',
    tier: 'opus',
    sourceSurface: 'DRAFT',
    rationale: 'Lead reply drafts the agent sends to prospects — first impression.',
  },
  {
    slug: 'ria-client-update-draft',
    tier: 'opus',
    sourceSurface: 'DRAFT',
    rationale: 'Client-facing financial update — fiduciary tone; the client reads it.',
  },

  // ── SONNET — moderate reasoning, coordination, routine chase drafts. ─────
  {
    slug: 'chief-of-staff-scheduler',
    tier: 'sonnet',
    sourceSurface: 'SCHEDULE',
    rationale: 'Proposes meetings/replies/to-dos from a snapshot — extraction + logic.',
  },
  {
    slug: 'customer-support-triage',
    tier: 'sonnet',
    sourceSurface: 'OTHER',
    rationale: 'KB-relevance judgment — moderate reasoning, not customer-read prose.',
  },
  {
    slug: 'follow-up-chaser-general',
    tier: 'sonnet',
    sourceSurface: 'FOLLOW_UP_CHASER',
    rationale: 'Nudges quiet threads — short, templated drafts; Sonnet is plenty.',
  },
  {
    slug: 'home-services-estimate-followup',
    tier: 'sonnet',
    sourceSurface: 'FOLLOW_UP_CHASER',
    rationale: 'Estimate-followup nudge — routine chase, not high-stakes synthesis.',
  },
  {
    slug: 'invoice-chase-general',
    tier: 'sonnet',
    sourceSurface: 'FOLLOW_UP_CHASER',
    rationale: 'Unpaid-invoice nudge — templated chase; Sonnet matches the bar.',
  },
  {
    slug: 'invoice-chasing-realestate',
    tier: 'sonnet',
    sourceSurface: 'FOLLOW_UP_CHASER',
    rationale: 'Commission/invoice chase — routine reminder draft.',
  },
  {
    slug: 'insurance-coi-request',
    tier: 'sonnet',
    sourceSurface: 'COORDINATE',
    rationale: 'Certificate-of-insurance request — structured, templated extraction.',
  },
  {
    slug: 'law-intake-conflict-screen',
    tier: 'sonnet',
    sourceSurface: 'COORDINATE',
    rationale: 'Conflict screen — rule-driven matching + short summary, not long prose.',
  },
  {
    slug: 'month-end-close-cpa',
    tier: 'sonnet',
    sourceSurface: 'COORDINATE',
    rationale: 'Close-checklist coordination — task assembly, moderate reasoning.',
  },
  {
    slug: 'mortgage-document-chase',
    tier: 'sonnet',
    sourceSurface: 'FOLLOW_UP_CHASER',
    rationale: 'Missing-doc chase — templated reminder; Sonnet is the right tier.',
  },
  {
    slug: 'property-management-rent-collection-chase',
    tier: 'sonnet',
    sourceSurface: 'FOLLOW_UP_CHASER',
    rationale: 'Rent-collection nudge — routine reminder draft.',
  },
  {
    slug: 'recruiting-candidate-status-update',
    tier: 'sonnet',
    sourceSurface: 'COORDINATE',
    rationale: 'Candidate status update — short, templated coordination message.',
  },
  {
    slug: 'title-escrow-closing-doc-chase',
    tier: 'sonnet',
    sourceSurface: 'FOLLOW_UP_CHASER',
    rationale: 'Closing-doc chase — templated reminder across parties.',
  },

  // ── HAIKU — narrow internal classifiers. Same answer, ~25× cheaper. ──────
  {
    slug: 'inbox-triage-general',
    tier: 'haiku',
    sourceSurface: 'INBOX_TRIAGE',
    rationale: 'Discrete inbox categorization — binary/categorical; Haiku nails it.',
  },
  {
    slug: 'office-admin',
    tier: 'haiku',
    sourceSurface: 'OFFICE_ADMIN',
    rationale: 'Verification-code / admin-mail routing — narrow classifier.',
  },
];

export const SKILL_MODEL_REGISTRY: readonly SkillModelAssignment[] =
  ASSIGNMENTS.map((a) => ({
    slug: a.slug,
    tier: a.tier,
    model: TIER_MODEL[a.tier],
    sourceSurface: a.sourceSurface,
    rationale: a.rationale,
  }));

const BY_SLUG: ReadonlyMap<string, SkillModelAssignment> = new Map(
  SKILL_MODEL_REGISTRY.map((a) => [a.slug, a]),
);

/** The model id a skill should run on, or `undefined` when the slug is not in
 *  the registry (caller falls back to the routing policy / global default). */
export function getSkillModel(slug: string): string | undefined {
  return BY_SLUG.get(slug)?.model;
}

/** The full assignment record for a skill, or `undefined`. */
export function getSkillModelAssignment(
  slug: string,
): SkillModelAssignment | undefined {
  return BY_SLUG.get(slug);
}

/** Count of skills per tier — used by the cost-projection report + the
 *  consistency test. */
export function tierDistribution(): Record<ModelTier, number> {
  const dist: Record<ModelTier, number> = { opus: 0, sonnet: 0, haiku: 0 };
  for (const a of SKILL_MODEL_REGISTRY) dist[a.tier] += 1;
  return dist;
}
