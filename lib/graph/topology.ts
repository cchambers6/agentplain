/**
 * lib/graph/topology.ts
 *
 * THE DECLARED DISPATCH TOPOLOGY of the skill fleet.
 *
 * The fleet is a CATALOG, not a graph. Inside `lib/skills/` there are zero
 * skill-to-skill runtime edges: no catalog skill's module invokes another
 * catalog skill's entrypoint, and `git grep 'inngest.send' -- lib/skills`
 * returns nothing. `lib/skills/runner.ts` says so in its own header --
 * "The runner is the ONLY caller that knows the conditional logic --
 * skills don't know about each other."
 *
 * What DOES exist is a hub-and-spoke: orchestrator functions (Inngest
 * functions, the chain runner, the vertical router, the instruction
 * handler) call skill entrypoints. Those calls are the only real edges.
 * Every edge below was read at origin/main and points at a verified call
 * site, not an import line.
 *
 * NOT edges, and deliberately absent here:
 *   - type-only imports across skill directories (e.g. `scheduler/*`
 *     importing `CalendarEvent` from `chief-of-staff-scheduler/types`);
 *   - constant-only imports (e.g. `finance-pulse-general` importing
 *     `INVOICE_CHASE_GENERAL_AGENT_SLUG` for an activity query);
 *   - shared-utility imports (e.g. `process-doc-drafter-general`
 *     importing `parseThreadResource`; `lib/skills/scheduler/` is shared
 *     substrate, not a catalog skill);
 *   - comment-only mentions of another skill.
 * An import is not a dispatch. Only an invoked entrypoint is.
 *
 * The standing invariant lives in `__tests__/topology-truth.test.ts`:
 * every declared edge must resolve against origin/main or the build goes
 * red. A declaration that drifts from the code is a lie with a green check
 * over it.
 */

import { SKILL_CATALOG } from '../skills/registry';
import type { CoverageReport } from '../tenancy/types';

export type { CoverageReport };

/**
 * How an orchestrator reaches a skill.
 *
 *  - `orchestrator-sequences` -- an Inngest function (or event handler)
 *    calls skill entrypoints directly from its own body. Covers both the
 *    fan-out orchestrators (onboarding-first-fire fires seven) and the
 *    one-skill cron sweeps.
 *  - `orchestrator-routes` -- the caller picks the skill from a routing
 *    table keyed on workspace vertical, then dispatches.
 *  - `runner-chains` -- `lib/skills/runner.ts` invokes the skill as one
 *    conditional step of the generic inbound-message chain.
 */
export type EdgeKind =
  | 'orchestrator-sequences'
  | 'orchestrator-routes'
  | 'runner-chains';

/** A catalog skill. `slug` matches `SKILL_CATALOG[*].slug`. */
export interface SkillNode {
  slug: string;
  /** Catalog `runtime`, defaulted the way `marketplace.ts` defaults it. */
  runtime: 'live' | 'schema-only' | 'coming-soon';
}

/** A dispatching function. Not a skill -- it is what calls skills. */
export interface OrchestratorNode {
  /** Stable id used as an edge endpoint. */
  id: string;
  /** Repo-relative path of the file that declares `symbol`. */
  file: string;
  /** The exported symbol that IS the orchestrator. */
  symbol: string;
  /** One line on what makes it tick (cron, event, call). */
  trigger: string;
}

/** One verified orchestrator -> skill dispatch. */
export interface TopologyEdge {
  /** `OrchestratorNode.id`. */
  from: string;
  /** `SkillNode.slug`. */
  to: string;
  /**
   * The dispatch site as `<repo-relative-file>:<invoked-symbol>`. The
   * symbol is the SKILL entrypoint actually called at that site -- not
   * the enclosing function -- so the invariant can grep for a real call.
   */
  dispatchSite: string;
  kind: EdgeKind;
}

/**
 * An orchestrator -> orchestrator hop. Declared separately from edges so
 * transitive reach ("process-webhook-event reaches office-admin") is
 * spelled out rather than smuggled into a skill edge.
 */
export interface Delegation {
  from: string;
  to: string;
  /** `<file>:<invoked-symbol>` of the delegating call. */
  dispatchSite: string;
}

/** A named cluster of orchestrators that fire off one trigger. */
export interface Subgraph {
  id: string;
  orchestrators: readonly string[];
  note: string;
}

// -- Nodes: the 24 catalog skills -------------------------------------------

/**
 * Skill nodes, derived from `SKILL_CATALOG` rather than hand-copied, so a
 * catalog add/remove cannot leave this file quietly stale. `runtime` is
 * defaulted to `'schema-only'` exactly the way `marketplace.ts` defaults
 * it -- an unset runtime means the skill is NOT installable, so a sweep
 * pointed at it is a silent no-op.
 */
export const SKILL_NODES: readonly SkillNode[] = SKILL_CATALOG.map((e) => ({
  slug: e.slug,
  runtime: e.runtime ?? 'schema-only',
}));

export const SKILL_SLUGS: readonly string[] = SKILL_NODES.map((n) => n.slug);

// -- Nodes: the orchestrators that dispatch them -----------------------------

export const ORCHESTRATOR_NODES: readonly OrchestratorNode[] = [
  {
    id: 'support-handler-on-create',
    file: 'lib/inngest/functions/support-handler-on-create.ts',
    symbol: 'supportHandlerOnCreateFn',
    trigger: 'event: agentplain/support-request.created',
  },
  {
    id: 'process-webhook-event',
    file: 'lib/inngest/functions/process-webhook-event.ts',
    symbol: 'processWebhookEventFn',
    trigger: 'cron */15 + agentplain/process-webhook-event.requested',
  },
  {
    id: 'skill-chain-runner',
    file: 'lib/skills/runner.ts',
    symbol: 'runSkillChain',
    trigger: 'called by process-webhook-event per inbound message',
  },
  {
    id: 'vertical-router',
    file: 'lib/skills/vertical-router.ts',
    symbol: 'runVerticalRouter',
    trigger: 'called by process-webhook-event when a vertical skill matches',
  },
  {
    id: 'onboarding-first-fire',
    file: 'lib/inngest/functions/onboarding-first-fire.ts',
    symbol: 'onboardingFirstFireFn',
    trigger: 'event: onboarding wizard first-fire request',
  },
  {
    id: 'instruction-handler-on-create',
    file: 'lib/inngest/functions/instruction-handler-on-create.ts',
    symbol: 'instructionHandlerOnCreateFn',
    trigger: 'event: agentplain/instruction.created',
  },
  {
    id: 'instruction-handler',
    file: 'lib/plaino/instruction-handler.ts',
    symbol: 'runInstructionHandler',
    trigger: 'called by instruction-handler-on-create per /talk INSTRUCT turn',
  },
  {
    id: 'analytics-weekly-pulse-sweep',
    file: 'lib/inngest/functions/analytics-weekly-pulse-sweep.ts',
    symbol: 'analyticsPulseSweepFn',
    trigger: 'cron sweep',
  },
  {
    id: 'compliance-watch-sweep',
    file: 'lib/inngest/functions/compliance-watch-sweep.ts',
    symbol: 'complianceWatchSweepFn',
    trigger: 'cron sweep',
  },
  {
    id: 'content-calendar-drafter-sweep',
    file: 'lib/inngest/functions/content-calendar-drafter-sweep.ts',
    symbol: 'contentCalendarSweepFn',
    trigger: 'cron sweep',
  },
  {
    id: 'finance-pulse-sweep',
    file: 'lib/inngest/functions/finance-pulse-sweep.ts',
    symbol: 'financePulseSweepFn',
    trigger: 'cron sweep',
  },
  {
    id: 'follow-up-chaser-sweep',
    file: 'lib/inngest/functions/follow-up-chaser-sweep.ts',
    symbol: 'followUpChaserSweepFn',
    trigger: 'cron sweep',
  },
  {
    id: 'process-doc-drafter-sweep',
    file: 'lib/inngest/functions/process-doc-drafter-sweep.ts',
    symbol: 'processDocDrafterSweepFn',
    trigger: 'cron sweep',
  },
  {
    id: 'invoice-chase-general-sweep',
    file: 'lib/inngest/functions/invoice-chase-general-sweep.ts',
    symbol: 'invoiceChaseGeneralSweepFn',
    trigger: 'cron sweep',
  },
  {
    id: 'month-end-close-cpa-sweep',
    file: 'lib/inngest/functions/month-end-close-cpa-sweep.ts',
    symbol: 'monthEndCloseCpaSweepFn',
    trigger: 'cron sweep',
  },
  {
    id: 'law-intake-conflict-screen-sweep',
    file: 'lib/inngest/functions/law-intake-conflict-screen-sweep.ts',
    symbol: 'lawConflictScreenSweepFn',
    trigger: 'cron sweep',
  },
  {
    id: 'scheduler-sweep',
    file: 'lib/inngest/functions/scheduler-sweep.ts',
    symbol: 'schedulerSweepFn',
    trigger: 'cron sweep',
  },
  {
    id: 'hubspot-sync-sweep',
    file: 'lib/inngest/functions/hubspot-sync-sweep.ts',
    symbol: 'hubspotSyncSweepFn',
    trigger: 'cron sweep over synced HubSpot leads',
  },
  {
    id: 'salesforce-sync-sweep',
    file: 'lib/inngest/functions/salesforce-sync-sweep.ts',
    symbol: 'salesforceSyncSweepFn',
    trigger: 'cron sweep over synced Salesforce leads',
  },
  {
    id: 'follow-up-boss-sync-sweep',
    file: 'lib/inngest/functions/follow-up-boss-sync-sweep.ts',
    symbol: 'followUpBossSyncSweepFn',
    trigger: 'cron sweep over synced Follow Up Boss leads',
  },
  {
    id: 'home-services-estimate-followup-sweep',
    file: 'lib/inngest/functions/home-services-estimate-followup-sweep.ts',
    symbol: 'homeServicesEstimateFollowupSweepFn',
    trigger: 'cron sweep (see DISPATCHED_BUT_NOT_INSTALLABLE below)',
  },
  {
    id: 'property-management-rent-collection-chase-sweep',
    file: 'lib/inngest/functions/property-management-rent-collection-chase-sweep.ts',
    symbol: 'propertyManagementRentCollectionChaseSweepFn',
    trigger: 'cron sweep',
  },
];

// -- Edges: verified orchestrator -> skill dispatches ------------------------

/**
 * Every row here was read at origin/main (b62b1c5) at a CALL site, not an
 * import. Line numbers are deliberately absent -- they rot; the invariant
 * greps for the invoked symbol instead.
 *
 * No row exists to fill a grid. Six catalog skills have no dispatcher at
 * all and are listed in `UNDISPATCHED_SKILLS` instead of being given a
 * fake edge.
 */
export const TOPOLOGY_EDGES: readonly TopologyEdge[] = [
  // -- SupportRequest create: triage first, handler on fallthrough --------
  {
    from: 'support-handler-on-create',
    to: 'customer-support-triage',
    dispatchSite:
      'lib/inngest/functions/support-handler-on-create.ts:runTriageForRequest',
    kind: 'orchestrator-sequences',
  },
  {
    from: 'support-handler-on-create',
    to: 'support-handler',
    dispatchSite:
      'lib/inngest/functions/support-handler-on-create.ts:runSupportHandlerForRequest',
    kind: 'orchestrator-sequences',
  },

  // -- Inbound webhook: generic chain, vertical router, inbox triage -------
  {
    from: 'process-webhook-event',
    to: 'inbox-triage-general',
    dispatchSite:
      'lib/inngest/functions/process-webhook-event.ts:runInboxTriageForEvent',
    kind: 'orchestrator-sequences',
  },
  {
    from: 'skill-chain-runner',
    to: 'office-admin',
    dispatchSite: 'lib/skills/runner.ts:classifyOfficeAdmin',
    kind: 'runner-chains',
  },
  {
    from: 'vertical-router',
    to: 'lead-triage-realestate',
    dispatchSite: 'lib/skills/vertical-router.ts:runLeadTriageForEvent',
    kind: 'orchestrator-routes',
  },

  // -- Onboarding first fire: ONE orchestrator, SEVEN catalog skills ------
  // The largest fan-out in the fleet. A `RUNNERS` table maps each pickable
  // slug to its production run-for-workspace entry.
  {
    from: 'onboarding-first-fire',
    to: 'analytics-weekly-pulse-general',
    dispatchSite:
      'lib/inngest/functions/onboarding-first-fire.ts:runAnalyticsPulseForWorkspace',
    kind: 'orchestrator-sequences',
  },
  {
    from: 'onboarding-first-fire',
    to: 'content-calendar-drafter-general',
    dispatchSite:
      'lib/inngest/functions/onboarding-first-fire.ts:runCalendarDrafterForWorkspace',
    kind: 'orchestrator-sequences',
  },
  {
    from: 'onboarding-first-fire',
    to: 'finance-pulse-general',
    dispatchSite:
      'lib/inngest/functions/onboarding-first-fire.ts:runFinancePulseForWorkspace',
    kind: 'orchestrator-sequences',
  },
  {
    from: 'onboarding-first-fire',
    to: 'compliance-watch-general',
    dispatchSite:
      'lib/inngest/functions/onboarding-first-fire.ts:runComplianceWatchForWorkspace',
    kind: 'orchestrator-sequences',
  },
  {
    from: 'onboarding-first-fire',
    to: 'chief-of-staff-scheduler',
    dispatchSite:
      'lib/inngest/functions/onboarding-first-fire.ts:runChiefOfStaffForWorkspace',
    kind: 'orchestrator-sequences',
  },
  {
    from: 'onboarding-first-fire',
    to: 'follow-up-chaser-general',
    dispatchSite:
      'lib/inngest/functions/onboarding-first-fire.ts:runFollowUpChaserForWorkspace',
    kind: 'orchestrator-sequences',
  },
  {
    from: 'onboarding-first-fire',
    to: 'process-doc-drafter-general',
    dispatchSite:
      'lib/inngest/functions/onboarding-first-fire.ts:runProcessDocDrafterForWorkspace',
    kind: 'orchestrator-sequences',
  },

  // -- /talk INSTRUCT turn -> research skill ------------------------------
  // Two hops: instructionHandlerOnCreateFn -> runInstructionHandler ->
  // research. The dispatch site is the inner file; the hop is declared in
  // ORCHESTRATOR_DELEGATIONS.
  {
    from: 'instruction-handler',
    to: 'research-on-demand-general',
    dispatchSite: 'lib/plaino/instruction-handler.ts:runResearchSkill',
    kind: 'orchestrator-sequences',
  },

  // -- One-skill cron sweeps ---------------------------------------------
  {
    from: 'analytics-weekly-pulse-sweep',
    to: 'analytics-weekly-pulse-general',
    dispatchSite:
      'lib/inngest/functions/analytics-weekly-pulse-sweep.ts:runAnalyticsPulseForWorkspace',
    kind: 'orchestrator-sequences',
  },
  {
    from: 'compliance-watch-sweep',
    to: 'compliance-watch-general',
    dispatchSite:
      'lib/inngest/functions/compliance-watch-sweep.ts:runComplianceWatchForWorkspace',
    kind: 'orchestrator-sequences',
  },
  {
    from: 'content-calendar-drafter-sweep',
    to: 'content-calendar-drafter-general',
    dispatchSite:
      'lib/inngest/functions/content-calendar-drafter-sweep.ts:runCalendarDrafterForWorkspace',
    kind: 'orchestrator-sequences',
  },
  {
    from: 'finance-pulse-sweep',
    to: 'finance-pulse-general',
    dispatchSite:
      'lib/inngest/functions/finance-pulse-sweep.ts:runFinancePulseForWorkspace',
    kind: 'orchestrator-sequences',
  },
  {
    from: 'follow-up-chaser-sweep',
    to: 'follow-up-chaser-general',
    dispatchSite:
      'lib/inngest/functions/follow-up-chaser-sweep.ts:runFollowUpChaserForWorkspace',
    kind: 'orchestrator-sequences',
  },
  {
    from: 'process-doc-drafter-sweep',
    to: 'process-doc-drafter-general',
    dispatchSite:
      'lib/inngest/functions/process-doc-drafter-sweep.ts:runProcessDocDrafterForWorkspace',
    kind: 'orchestrator-sequences',
  },
  {
    from: 'invoice-chase-general-sweep',
    to: 'invoice-chase-general',
    dispatchSite:
      'lib/inngest/functions/invoice-chase-general-sweep.ts:runInvoiceChaseForWorkspace',
    kind: 'orchestrator-sequences',
  },
  {
    from: 'month-end-close-cpa-sweep',
    to: 'month-end-close-cpa',
    dispatchSite:
      'lib/inngest/functions/month-end-close-cpa-sweep.ts:runMonthEndCloseForWorkspace',
    kind: 'orchestrator-sequences',
  },
  {
    from: 'law-intake-conflict-screen-sweep',
    to: 'law-intake-conflict-screen',
    dispatchSite:
      'lib/inngest/functions/law-intake-conflict-screen-sweep.ts:runConflictScreenForWorkspace',
    kind: 'orchestrator-sequences',
  },
  {
    from: 'scheduler-sweep',
    to: 'chief-of-staff-scheduler',
    dispatchSite:
      'lib/inngest/functions/scheduler-sweep.ts:runChiefOfStaffForWorkspace',
    kind: 'orchestrator-sequences',
  },
  {
    from: 'hubspot-sync-sweep',
    to: 'lead-triage-realestate',
    dispatchSite: 'lib/inngest/functions/hubspot-sync-sweep.ts:runLeadTriageSkill',
    kind: 'orchestrator-sequences',
  },
  {
    from: 'salesforce-sync-sweep',
    to: 'lead-triage-realestate',
    dispatchSite:
      'lib/inngest/functions/salesforce-sync-sweep.ts:runLeadTriageSkill',
    kind: 'orchestrator-sequences',
  },
  {
    from: 'follow-up-boss-sync-sweep',
    to: 'lead-triage-realestate',
    dispatchSite:
      'lib/inngest/functions/follow-up-boss-sync-sweep.ts:runLeadTriageSkill',
    kind: 'orchestrator-sequences',
  },
  {
    from: 'home-services-estimate-followup-sweep',
    to: 'home-services-estimate-followup',
    dispatchSite:
      'lib/inngest/functions/home-services-estimate-followup-sweep.ts:runEstimateFollowupForWorkspace',
    kind: 'orchestrator-sequences',
  },
  {
    from: 'property-management-rent-collection-chase-sweep',
    to: 'property-management-rent-collection-chase',
    dispatchSite:
      'lib/inngest/functions/property-management-rent-collection-chase-sweep.ts:runRentCollectionChaseForWorkspace',
    kind: 'orchestrator-sequences',
  },
];

// -- Orchestrator -> orchestrator hops --------------------------------------

export const ORCHESTRATOR_DELEGATIONS: readonly Delegation[] = [
  {
    from: 'process-webhook-event',
    to: 'skill-chain-runner',
    dispatchSite: 'lib/inngest/functions/process-webhook-event.ts:runSkillChain',
  },
  {
    from: 'process-webhook-event',
    to: 'vertical-router',
    dispatchSite:
      'lib/inngest/functions/process-webhook-event.ts:runVerticalRouter',
  },
  {
    from: 'instruction-handler-on-create',
    to: 'instruction-handler',
    dispatchSite:
      'lib/inngest/functions/instruction-handler-on-create.ts:runInstructionHandler',
  },
];

// -- Subgraphs --------------------------------------------------------------

export const SUBGRAPHS: readonly Subgraph[] = [
  {
    id: 'support-request-create',
    orchestrators: ['support-handler-on-create'],
    note:
      'L1 triage intercepts every SupportRequest create; the draft handler ' +
      'runs only on decision==="drafted" or a failed triage.',
  },
  {
    id: 'inbound-webhook',
    orchestrators: [
      'process-webhook-event',
      'skill-chain-runner',
      'vertical-router',
    ],
    note:
      'The only place the fleet looks like a graph: one Inngest function ' +
      'sequences the generic chain, the vertical router and inbox triage. ' +
      'office-admin and lead-triage are reached transitively.',
  },
  {
    id: 'onboarding-first-fire',
    orchestrators: ['onboarding-first-fire'],
    note:
      'Seven catalog skills off one wizard event -- the widest fan-out in ' +
      'the fleet, and absent from SWEEP_DISPATCH_MANIFEST because it is ' +
      'not a cron.',
  },
  {
    id: 'instruction-turn',
    orchestrators: ['instruction-handler-on-create', 'instruction-handler'],
    note: 'Plaino /talk INSTRUCT turns reach the research skill in two hops.',
  },
  {
    id: 'crm-sync-sweeps',
    orchestrators: [
      'hubspot-sync-sweep',
      'salesforce-sync-sweep',
      'follow-up-boss-sync-sweep',
    ],
    note:
      'Three CRM sweeps converge on the same skill (lead-triage-realestate), ' +
      'each via the aliased runLeadTriageSkill import.',
  },
  {
    id: 'cron-sweeps',
    orchestrators: [
      'analytics-weekly-pulse-sweep',
      'compliance-watch-sweep',
      'content-calendar-drafter-sweep',
      'finance-pulse-sweep',
      'follow-up-chaser-sweep',
      'process-doc-drafter-sweep',
      'invoice-chase-general-sweep',
      'month-end-close-cpa-sweep',
      'law-intake-conflict-screen-sweep',
      'scheduler-sweep',
      'home-services-estimate-followup-sweep',
      'property-management-rent-collection-chase-sweep',
    ],
    note:
      'One cron, one skill, no sequencing. Spokes on the hub -- they are ' +
      'why the fleet is a catalog rather than a graph.',
  },
];

// -- What the topology does NOT contain -------------------------------------

/**
 * Catalog skills with NO dispatcher anywhere. Every one is
 * `runtime: 'schema-only'`, so the catalog is not lying about them -- they
 * are shipped code with no caller, and the marketplace badges them as
 * such. Listed rather than papered over: an empty list here would be the
 * "found nothing == examined nothing" failure this module exists to
 * prevent.
 *
 * The invariant asserts the DERIVED undispatched set equals this list, so
 * a new dark skill cannot join silently, and wiring one up without
 * updating this list also goes red.
 */
export const KNOWN_UNDISPATCHED_SKILLS: readonly string[] = [
  'insurance-coi-request',
  'invoice-chasing-realestate',
  'mortgage-document-chase',
  'recruiting-candidate-status-update',
  'ria-client-update-draft',
  'title-escrow-closing-doc-chase',
];

/**
 * Skills that HAVE a verified dispatcher but whose catalog `runtime` is
 * not `'live'`. `isSkillInstalledForWorkspace` returns false for these
 * (marketplace.ts: `if (runtime !== "live") return false`), so the sweep
 * runs, finds no installed workspace, and no-ops -- silently. This is
 * exactly the class (b) bug from the 2026-06-10 signup-to-go audit.
 */
export const DISPATCHED_BUT_NOT_INSTALLABLE: readonly string[] = [
  'home-services-estimate-followup',
];

// -- Helpers ----------------------------------------------------------------

export interface DispatchSiteParts {
  file: string;
  symbol: string;
}

/**
 * Split `<file>:<symbol>`. Throws on a malformed value -- a dispatchSite
 * that cannot be parsed must not silently verify as "nothing to check".
 */
export function splitDispatchSite(site: string): DispatchSiteParts {
  const idx = site.lastIndexOf(':');
  if (idx <= 0 || idx === site.length - 1) {
    throw new Error(
      `malformed dispatchSite "${site}" -- expected "<file>:<symbol>"`,
    );
  }
  return { file: site.slice(0, idx), symbol: site.slice(idx + 1) };
}

export function orchestrator(id: string): OrchestratorNode | null {
  return ORCHESTRATOR_NODES.find((o) => o.id === id) ?? null;
}

export function skillNode(slug: string): SkillNode | null {
  return SKILL_NODES.find((s) => s.slug === slug) ?? null;
}

/** Catalog slugs reached by at least one declared edge. */
export function dispatchedSkills(): string[] {
  return [...new Set(TOPOLOGY_EDGES.map((e) => e.to))].sort();
}

/** Catalog slugs reached by no declared edge. */
export function undispatchedSkills(): string[] {
  const reached = new Set(TOPOLOGY_EDGES.map((e) => e.to));
  return SKILL_SLUGS.filter((s) => !reached.has(s)).sort();
}

// -- Coverage ---------------------------------------------------------------

/**
 * What this declaration examined, in the repo's own `CoverageReport`
 * shape (`lib/tenancy/types.ts`). The unit is the catalog skill: `total`
 * is the whole catalog, `examined` is the slugs this topology reached a
 * verdict on -- dispatched or explicitly undispatched -- which is all 24.
 * `blindTo` names the mechanisms that would defeat the invariant, in
 * specific terms rather than "may have gaps".
 */
export function topologyCoverage(): CoverageReport {
  const decided = new Set<string>([
    ...TOPOLOGY_EDGES.map((e) => e.to),
    ...KNOWN_UNDISPATCHED_SKILLS,
  ]);
  return {
    examined: SKILL_SLUGS.filter((s) => decided.has(s)).length,
    total: SKILL_SLUGS.length,
    unit: 'SKILL_CATALOG slugs',
    blindTo: [
      'dispatch through a dynamic import or a string-keyed lookup table -- ' +
        'the invariant greps for a literal symbol name in the source text',
      'an event-bus hop (inngest.send) that names a skill only in event ' +
        'data; there are zero such sends under lib/skills today, but a new ' +
        'one would not appear here',
      'a dispatch site that exists on the working tree but not on ' +
        'origin/main -- the invariant reads blobs from origin/main only',
      'runtime gating: an edge can resolve statically and still never fire ' +
        '(see DISPATCHED_BUT_NOT_INSTALLABLE)',
      'callers outside lib/ and app/ entirely (scripts/, tools/)',
    ],
  };
}
