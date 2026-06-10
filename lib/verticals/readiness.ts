/**
 * lib/verticals/readiness.ts
 *
 * Vertical-readiness resolver — the SINGLE source of truth for "does
 * agentplain have a killer workflow that actually fires for this vertical
 * today?" Drives the signup gate (an unsupported vertical lands on the
 * honest waitlist screen instead of taking money) and the leak-path
 * auto-refund cron (find paying workspaces in an unsupported vertical that
 * never got value).
 *
 * Per the 2026-06-10 signup-to-go audit
 * (docs/audits/SIGNUP_TO_GO_AUDIT_2026_06_10.md): the audit found SILENT
 * registry gating — skills ship, but a missing SKILL_CATALOG entry or a
 * `runtime` defaulting to `'schema-only'` means the skill never fires, and
 * NOTHING surfaces that to the customer. The customer pays for a vertical
 * whose flagship workflow is permanently dark.
 *
 * THE BAR (Conner-dead test): a real local-business owner must never pay
 * for a vertical we cannot serve. This resolver is the gate that protects
 * them. It derives readiness from REGISTRY TRUTH — not a hardcoded "these
 * five are good" list — so the determination can never drift away from
 * what the code actually does:
 *
 *   A vertical is SUPPORTED iff
 *     (1) its killer-workflow skill resolves in SKILL_CATALOG, AND
 *     (2) that catalog entry's `runtime === 'live'`, AND
 *     (3) a PRODUCTION CALLER exists that fires the skill on real
 *         workspace data (a vertical-router registration, an Inngest
 *         sweep, or a webhook chain).
 *
 * Cold-start safe + CONSERVATIVE (feedback_cold_start_safe_agents):
 * `resolveVerticalReadiness` is a pure function over the registry + a
 * production-caller manifest, both of which are in-process module state —
 * there is no I/O to fail. But the public `isVerticalSupportedSafe`
 * wrapper catches ANY throw (a corrupt registry import, a refactor that
 * breaks the manifest) and fails toward UNSUPPORTED — i.e. toward the
 * honest waitlist screen, NEVER toward taking money. Silent failure that
 * lets a charge through is the one outcome this module exists to prevent.
 *
 * Per feedback_no_silent_vendor_lock: no vendor calls here — pure
 * registry + manifest composition.
 */

import type { Vertical } from '@prisma/client';
import { SKILL_CATALOG, type SkillCatalogEntry } from '@/lib/skills/registry';
import { verticalEnumFromSlug } from '@/lib/auth/vertical-enum';

/**
 * Map a vertical SLUG (the marketing/content + signup-form identity) to
 * the slug of its killer-workflow skill in SKILL_CATALOG.
 *
 * This is NOT a readiness judgement — it just names which skill IS the
 * flagship for each vertical. Whether that skill is actually live is read
 * from the catalog + caller manifest below. Source: the killer-workflow
 * activation mandate (lib/plaino/killer-workflow.ts headlines) cross-walked
 * to the registry slug that produces that workflow's drafts.
 *
 * `recruiting` has NO killer workflow defined in the activation mandate
 * (lib/plaino/killer-workflow.ts:184 falls back to the general invoice
 * chase), so it has no entry here — and is therefore unsupported, which is
 * the honest answer: we never built a recruiting flagship.
 */
const KILLER_WORKFLOW_SKILL_BY_VERTICAL_SLUG: Readonly<
  Record<string, string>
> = {
  'real-estate': 'lead-triage-realestate',
  cpa: 'month-end-close-cpa',
  'home-services': 'home-services-estimate-followup',
  law: 'law-intake-conflict-screen',
  insurance: 'insurance-coi-request',
  mortgage: 'mortgage-document-chase',
  'property-management': 'property-management-rent-collection-chase',
  'title-escrow': 'title-escrow-closing-doc-chase',
  ria: 'ria-client-update-draft',
  // recruiting: intentionally absent — no flagship workflow defined.
};

/**
 * The set of skill slugs that a PRODUCTION CALLER fires on real workspace
 * data today. This is the third leg of the readiness test: a skill can be
 * `runtime: 'live'` in the catalog yet have no caller wired (the catalog
 * `runtime` flag is honest about the MODULE, this manifest is honest about
 * the WIRING). Both must be true for "supported."
 *
 * Authoritative caller sources (verified 2026-06-10):
 *   - `lead-triage-realestate` — fired by the vertical-router REGISTRATIONS
 *     (lib/skills/vertical-router.ts:115) on every inbound webhook for a
 *     real-estate workspace, AND by the FUB / HubSpot / Salesforce sync
 *     sweeps (lib/inngest/functions/{follow-up-boss,hubspot,salesforce}-
 *     sync-sweep.ts). This is the ONLY vertical killer skill with a live
 *     caller today.
 *
 * The other nine vertical killer skills are registered (or, in the case of
 * home-services, not even flagged `runtime: 'live'`) but have NO production
 * caller — the audit's "silent registry gating" finding. They stay out of
 * this set until their caller lands, which is the honest signal.
 *
 * When a new caller ships, add its skill slug here AND set the catalog
 * entry's `runtime: 'live'`. The `verticalReadinessSelfCheck` invariant
 * (asserted by the test) catches a manifest entry that points at a
 * non-live catalog skill, so the two can never silently disagree.
 */
export const SKILLS_WITH_PRODUCTION_CALLER: ReadonlySet<string> = new Set([
  'lead-triage-realestate',
]);

export type VerticalReadinessReason =
  | 'supported'
  | 'no-killer-workflow-defined'
  | 'skill-not-in-catalog'
  | 'skill-not-live'
  | 'no-production-caller';

export interface VerticalReadiness {
  /** The vertical slug this readiness is for. */
  slug: string;
  /** True iff the killer workflow is catalog-live AND has a caller. */
  supported: boolean;
  /** The killer-workflow skill slug, or null when none is defined. */
  killerWorkflowSkillSlug: string | null;
  /** Machine reason — drives copy + audit payloads, never a bare boolean. */
  reason: VerticalReadinessReason;
}

function lookupCatalogEntry(slug: string): SkillCatalogEntry | null {
  return SKILL_CATALOG.find((s) => s.slug === slug) ?? null;
}

/**
 * Resolve readiness for a vertical SLUG from registry truth. Pure — reads
 * only in-process module state (the catalog + the caller manifest). Throws
 * nothing on a known slug; an unknown slug resolves to
 * `no-killer-workflow-defined` (unsupported) rather than throwing, so the
 * gate degrades safely on a stale slug.
 */
export function resolveVerticalReadiness(verticalSlug: string): VerticalReadiness {
  const slug = verticalSlug.trim().toLowerCase();
  const killerSlug = KILLER_WORKFLOW_SKILL_BY_VERTICAL_SLUG[slug] ?? null;

  if (!killerSlug) {
    return {
      slug,
      supported: false,
      killerWorkflowSkillSlug: null,
      reason: 'no-killer-workflow-defined',
    };
  }

  const entry = lookupCatalogEntry(killerSlug);
  if (!entry) {
    return {
      slug,
      supported: false,
      killerWorkflowSkillSlug: killerSlug,
      reason: 'skill-not-in-catalog',
    };
  }

  // The catalog default is `'schema-only'` (registry.ts:79) — an entry
  // WITHOUT an explicit `runtime: 'live'` is NOT live, which is exactly
  // the silent-gating case the audit caught. Strict equality, no
  // defaulting toward live.
  if (entry.runtime !== 'live') {
    return {
      slug,
      supported: false,
      killerWorkflowSkillSlug: killerSlug,
      reason: 'skill-not-live',
    };
  }

  if (!SKILLS_WITH_PRODUCTION_CALLER.has(killerSlug)) {
    return {
      slug,
      supported: false,
      killerWorkflowSkillSlug: killerSlug,
      reason: 'no-production-caller',
    };
  }

  return {
    slug,
    supported: true,
    killerWorkflowSkillSlug: killerSlug,
    reason: 'supported',
  };
}

/**
 * Cold-start-safe, CONSERVATIVE public entry point for the signup gate.
 *
 * Returns `true` ONLY when the resolver positively confirms the vertical
 * is supported. ANY exception — a corrupt registry import, a refactor that
 * breaks `resolveVerticalReadiness`, an unexpected catalog shape — is
 * caught and returns `false`. The whole point: if we cannot read the
 * registry and PROVE the vertical is serveable, we must NOT take the
 * customer's money. Failing closed routes them to the honest waitlist
 * screen, which still meets the bar (surface the gap, capture interest,
 * charge nothing).
 *
 * The optional `onError` hook lets the caller log the failure for an
 * operator to triage — a registry that throws is itself a bug worth
 * paging on — without ever letting the throw flip the answer toward "take
 * the money."
 */
export function isVerticalSupportedSafe(
  verticalSlug: string,
  onError?: (err: unknown) => void,
): boolean {
  try {
    return resolveVerticalReadiness(verticalSlug).supported;
  } catch (err) {
    if (onError) {
      try {
        onError(err);
      } catch {
        // An onError that itself throws must never re-throw into the
        // signup path. Swallow — the conservative `false` still stands.
      }
    }
    return false;
  }
}

/**
 * Enum-keyed convenience for the refund cron, which reads
 * `Workspace.vertical` (the Prisma `Vertical` enum). Bridges to the
 * slug-keyed resolver through the existing single enum↔slug boundary.
 */
export function resolveVerticalReadinessForEnum(
  vertical: Vertical,
): VerticalReadiness {
  // verticalSlugFromEnum is total over the enum; import lazily-free by
  // re-deriving from the SLUG_TO_ENUM inverse would duplicate the map, so
  // we reuse the enum→slug bridge.
  const slug = ENUM_TO_SLUG[vertical];
  return resolveVerticalReadiness(slug);
}

/** Local enum→slug table mirroring lib/auth/vertical-enum so this module
 *  can answer the enum-keyed question without importing a function that
 *  pulls the WorkspaceVerticalTier bridge. Kept in lock-step by the
 *  self-check below. */
const ENUM_TO_SLUG: Record<Vertical, string> = {
  REAL_ESTATE: 'real-estate',
  MORTGAGE: 'mortgage',
  INSURANCE: 'insurance',
  PROPERTY_MANAGEMENT: 'property-management',
  TITLE_ESCROW: 'title-escrow',
  RECRUITING: 'recruiting',
  HOME_SERVICES: 'home-services',
  CPA: 'cpa',
  LAW: 'law',
  RIA: 'ria',
};

/**
 * Invariant self-check used by the test suite (and safe to call at boot).
 * Catches the two ways the resolver could silently lie:
 *
 *   1. A slug in ENUM_TO_SLUG that the enum bridge disagrees with — the
 *      refund cron would then read the wrong readiness for a workspace.
 *   2. A skill in SKILLS_WITH_PRODUCTION_CALLER whose catalog entry is
 *      NOT `runtime: 'live'` — a caller wired to a skill the catalog
 *      claims is dark, which would make a vertical "supported" on a
 *      half-truth.
 *
 * Returns the list of problems (empty = healthy). The test asserts empty;
 * a non-empty result is a real, actionable wiring bug.
 */
export function verticalReadinessSelfCheck(): string[] {
  const problems: string[] = [];

  // (1) ENUM_TO_SLUG must agree with the canonical enum bridge.
  for (const [enumValue, slug] of Object.entries(ENUM_TO_SLUG)) {
    const roundTrip = verticalEnumFromSlug(slug);
    if (roundTrip !== enumValue) {
      problems.push(
        `ENUM_TO_SLUG[${enumValue}]=${slug} disagrees with verticalEnumFromSlug (got ${roundTrip ?? 'null'})`,
      );
    }
  }

  // (2) Every production-caller skill must be catalog-live.
  for (const skillSlug of SKILLS_WITH_PRODUCTION_CALLER) {
    const entry = lookupCatalogEntry(skillSlug);
    if (!entry) {
      problems.push(
        `SKILLS_WITH_PRODUCTION_CALLER has ${skillSlug} but it is not in SKILL_CATALOG`,
      );
    } else if (entry.runtime !== 'live') {
      problems.push(
        `SKILLS_WITH_PRODUCTION_CALLER has ${skillSlug} but its catalog runtime is ${entry.runtime ?? 'schema-only(default)'}`,
      );
    }
  }

  return problems;
}
