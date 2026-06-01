/**
 * lib/onboarding/picked-skills.ts
 *
 * Resolves which skills are pickable in the wave-9 wizard's "pick what
 * we'll watch" step, and persists the customer's selection. Encodes the
 * honesty bar from feedback_offer_tightening_2026_05_28: a skill is
 * pickable only when (a) the registry says it's runtime: 'live' AND
 * (b) every MCP dependency the skill actually needs to produce real
 * output on first fire is met for THIS workspace.
 *
 * "Real output on first fire" is the load-bearing phrase. Skills that
 * fail loudly when their dependency is missing (e.g. inbox-triage-
 * general needs Gmail/Outlook) are hidden when the dependency is absent.
 * Skills that degrade gracefully (e.g. finance-pulse-general writes a
 * "QuickBooks not connected" pulse) are always pickable.
 *
 * Per project_no_outbound_architecture.md: nothing in this module talks
 * to vendors. It composes existing registry + integration readers and
 * persists a JSON array on OnboardingState.
 */

import { z } from 'zod';
import { SKILL_CATALOG } from '@/lib/skills/registry';
import type { SkillCatalogEntry } from '@/lib/skills/registry';
import { SKILL_DISCIPLINE } from '@/lib/disciplines/skill-mapping';
import type { DisciplineId } from '@/lib/disciplines';

/** Slugs of skills the wizard surfaces by default when no inbox is
 *  connected — every one of these fires honestly on internal-only data
 *  (workspace activity, approval drafts, LLM-generated calendars) and
 *  writes a real WorkApprovalQueueItem row on first fire. */
const NO_INTEGRATION_REQUIRED: readonly string[] = [
  'analytics-weekly-pulse-general',
  'content-calendar-drafter-general',
  'finance-pulse-general',
  'compliance-watch-general',
];

/** Slugs of skills the wizard surfaces when an inbox (Gmail or Outlook)
 *  is connected. These read from the inbox and would write a SkillRun
 *  with outcome=SKIPPED_UNCONFIGURED if no inbox is wired — so the
 *  honesty bar hides them until an inbox is connected. */
const INBOX_REQUIRED: readonly string[] = [
  'inbox-triage-general',
  'office-admin',
  'chief-of-staff-scheduler',
  'follow-up-chaser-general',
  'process-doc-drafter-general',
];

/** Defensive: skills that exist as runtime: 'live' in the registry but
 *  cannot deliver real first-fire output without prior customer actions
 *  (e.g. research-on-demand-general needs a /talk turn tagged research;
 *  support-handler needs a /help submission). Excluded from the picker
 *  so the customer never picks something that returns nothing on day
 *  one. They still fire on their normal triggers later. */
const NEVER_IN_PICKER: readonly string[] = [
  'research-on-demand-general',
  'support-handler',
  // Vertical-specific live skill that requires an inbound lead webhook
  // to fire. Honest exclusion — customer-visible first fire on day-one
  // requires either a real inbound or a fixture seed.
  'lead-triage-realestate',
];

export interface PickableSkill {
  slug: string;
  /** Customer-facing name from the catalog. */
  name: string;
  /** Discipline tag from the sidecar map. */
  discipline: DisciplineId;
  /** One-sentence "what this delivers on first fire" — concrete enough
   *  for the customer to recognise the output when it lands. */
  firstFirePromise: string;
  /** True when the wizard pre-checks this skill by default. */
  defaultPicked: boolean;
}

/**
 * The promise the wizard makes about what the skill delivers on its
 * first fire. Customer-facing — read like Plaino is talking. Mapped per
 * slug rather than read from the registry's `description` so the
 * onboarding voice stays tight (the registry descriptions are operator-
 * oriented). Per project_plaino_named_agent.md.
 */
const FIRST_FIRE_PROMISE: Record<string, string> = {
  'analytics-weekly-pulse-general':
    'A weekly pulse on your workspace — what got done, where the fleet was underused, one concrete thing to lean into next week.',
  'content-calendar-drafter-general':
    'A 5-day content calendar for your week — one evergreen topic per business day with a channel hint and short hook.',
  'finance-pulse-general':
    'A weekly finance pulse — invoice-chase + close drafts produced, decisions made. (Pulls AR aging too if QuickBooks is connected.)',
  'compliance-watch-general':
    'A sweep of the last 24 hours of drafts against your vertical compliance corpus. Quiet if nothing flagged; a digest if something needs your eyes.',
  'inbox-triage-general':
    'Your inbox sorted into priority buckets — urgent, customer-active, vendor-pending, decision-needed, noise. Gentle acks drafted for the ones safe to acknowledge.',
  'office-admin':
    'Verification codes, password resets, billing notices, security alerts — each routed into the queue with the right affordance.',
  'chief-of-staff-scheduler':
    'Proposed meeting slots from your open calendar, reply drafts for stale threads, to-do items pulled from explicit asks.',
  'follow-up-chaser-general':
    'Drafted nudges for your stale outbound threads — the oldest unread reply gets attention first.',
  'process-doc-drafter-general':
    'A draft SOP for any work pattern we see you repeat — the procedure document you keep meaning to write.',
};

interface ResolvePickableInput {
  /** Workspace vertical slug — read from `Workspace.vertical`. Unused
   *  for the wave-9 cut (no vertical-specific picks land in first fire
   *  reliably), but threaded through for future-proofing. */
  verticalSlug?: string;
  /** True when the workspace has at least one ACTIVE inbox credential
   *  (Gmail or Outlook). Drives the inbox-required visibility branch. */
  hasInbox: boolean;
}

/**
 * Build the pickable-skills list for the wizard. Ordered so the most
 * concrete, lowest-friction outputs come first — the customer scans
 * top-down and sees something that looks like value immediately.
 *
 * Pre-checks every pickable skill by default. The customer can uncheck
 * to opt out; an empty pick list is valid (the wizard just notes
 * "you'll see Plaino's first move on the next cron" instead of
 * triggering an immediate fire).
 */
export function resolvePickableSkills(
  input: ResolvePickableInput,
): PickableSkill[] {
  const live = new Set(
    SKILL_CATALOG.filter((s) => s.runtime === 'live').map((s) => s.slug),
  );
  const candidates: string[] = [];
  for (const slug of NO_INTEGRATION_REQUIRED) {
    if (live.has(slug)) candidates.push(slug);
  }
  if (input.hasInbox) {
    for (const slug of INBOX_REQUIRED) {
      if (live.has(slug)) candidates.push(slug);
    }
  }
  const excluded = new Set(NEVER_IN_PICKER);
  const out: PickableSkill[] = [];
  for (const slug of candidates) {
    if (excluded.has(slug)) continue;
    const entry = lookupCatalogEntry(slug);
    const discipline = SKILL_DISCIPLINE[slug];
    if (!entry || !discipline) continue;
    out.push({
      slug,
      name: entry.name,
      discipline,
      firstFirePromise: FIRST_FIRE_PROMISE[slug] ?? entry.description,
      defaultPicked: true,
    });
  }
  return out;
}

function lookupCatalogEntry(slug: string): SkillCatalogEntry | null {
  return SKILL_CATALOG.find((s) => s.slug === slug) ?? null;
}

/**
 * Validate a free-form list of picked slugs against the pickable set.
 * Anything outside the pickable set is silently dropped (defense in
 * depth — a hand-crafted POST cannot enable a non-pickable skill).
 */
export function sanitizePickedSlugs(
  picked: readonly string[],
  pickable: readonly PickableSkill[],
): string[] {
  const allowed = new Set(pickable.map((p) => p.slug));
  const out: string[] = [];
  const seen = new Set<string>();
  for (const slug of picked) {
    if (!allowed.has(slug)) continue;
    if (seen.has(slug)) continue;
    seen.add(slug);
    out.push(slug);
  }
  return out;
}

/** Zod schema for the JSON column on OnboardingState.pickedSkillSlugs.
 *  Validates on every read so a hand-poisoned column never crashes the
 *  wizard render. */
export const PickedSkillSlugsSchema = z.array(z.string());

/** Coerce the raw JSON value into a slug array; returns [] on any
 *  malformed payload so the wizard reliably degrades. */
export function readPickedSlugs(raw: unknown): string[] {
  const parsed = PickedSkillSlugsSchema.safeParse(raw);
  if (!parsed.success) return [];
  return parsed.data;
}
