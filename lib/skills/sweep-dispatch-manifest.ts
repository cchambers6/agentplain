/**
 * lib/skills/sweep-dispatch-manifest.ts
 *
 * THE SINGLE SOURCE OF TRUTH for "which Inngest sweep dispatches which
 * skill slug." Every cron/event sweep that fires a SKILL_CATALOG skill on
 * real workspace data declares one row here. The registry-truth CI guard
 * (lib/skills/__tests__/registry-truth.test.ts) reads this manifest and
 * cross-checks it against the catalog + the Inngest route registration so
 * the silent-no-op class of bug CANNOT recur:
 *
 *   The audit (docs/audits/SIGNUP_TO_GO_AUDIT_2026_06_10.md §Engine) found
 *   that a shipped skill silently never fires when:
 *     (a) it is ABSENT from SKILL_CATALOG (isSkillInstalledForWorkspace →
 *         false), or
 *     (b) its catalog `runtime` is not `'live'` (same → false), or
 *     (c) it has a catalog entry but NO production caller wired.
 *   Each is a SILENT no-op — zero error anywhere. The guard turns all three
 *   into a failing test.
 *
 * INVARIANTS the guard enforces from this manifest (data-driven — adding a
 * new sweep without a row here, or a row whose skill isn't catalog-live,
 * fails the build):
 *
 *   1. Every manifest skill resolves to a SKILL_CATALOG entry with
 *      `runtime: 'live'`. (Catches a sweep dispatching a dark skill.)
 *   2. Every manifest Inngest function is registered in
 *      app/api/inngest/route.ts. (Catches a sweep that exists but was never
 *      wired into the serve() handler — it would never tick.)
 *   3. Every `runtime: 'live'` catalog skill that is sweep-dispatched (i.e.
 *      claims to fire via a cron, not a webhook/event chain) appears in
 *      this manifest. (Catches a `runtime: 'live'` skill with no caller —
 *      the (c) gap.)
 *
 * Skills whose production caller is NOT a cron sweep (e.g. lead-triage fires
 * from the vertical-router on inbound webhooks; support-handler fires on a
 * SupportRequest create) are listed in `NON_SWEEP_LIVE_SKILLS` so the
 * inverse check (invariant 3) knows they are caller-covered without a sweep
 * row. That list is itself part of the source of truth — a live skill that
 * is in NEITHER set fails the guard.
 */

/** One sweep → skill dispatch declaration. */
export interface SweepDispatchEntry {
  /** SKILL_CATALOG slug the sweep fires. */
  skillSlug: string;
  /** The Inngest function's id (matches `<fn>.id()` and the FUNCTION_ID
   *  constant). The guard asserts this id is referenced/registered in
   *  route.ts via the imported function object. */
  functionId: string;
  /** The exported Inngest function symbol name in route.ts — the guard
   *  greps route.ts for this to confirm registration. */
  routeSymbol: string;
}

export const SWEEP_DISPATCH_MANIFEST: ReadonlyArray<SweepDispatchEntry> = [
  {
    skillSlug: 'invoice-chase-general',
    functionId: 'agentplain-invoice-chase-general-sweep',
    routeSymbol: 'invoiceChaseGeneralSweepFn',
  },
  {
    skillSlug: 'month-end-close-cpa',
    functionId: 'agentplain-month-end-close-cpa-sweep',
    routeSymbol: 'monthEndCloseCpaSweepFn',
  },
  {
    skillSlug: 'law-intake-conflict-screen',
    functionId: 'agentplain-law-intake-conflict-screen-sweep',
    routeSymbol: 'lawConflictScreenSweepFn',
  },
  {
    skillSlug: 'compliance-watch-general',
    functionId: 'agentplain-compliance-watch-sweep',
    routeSymbol: 'complianceWatchSweepFn',
  },
  {
    skillSlug: 'analytics-weekly-pulse-general',
    functionId: 'agentplain-analytics-pulse-sweep',
    routeSymbol: 'analyticsPulseSweepFn',
  },
  {
    skillSlug: 'content-calendar-drafter-general',
    functionId: 'agentplain-content-calendar-sweep',
    routeSymbol: 'contentCalendarSweepFn',
  },
  {
    skillSlug: 'finance-pulse-general',
    functionId: 'agentplain-finance-pulse-sweep',
    routeSymbol: 'financePulseSweepFn',
  },
  {
    skillSlug: 'follow-up-chaser-general',
    functionId: 'agentplain-follow-up-chaser-sweep',
    routeSymbol: 'followUpChaserSweepFn',
  },
  {
    skillSlug: 'process-doc-drafter-general',
    functionId: 'agentplain-process-doc-drafter-sweep',
    routeSymbol: 'processDocDrafterSweepFn',
  },
];

/**
 * `runtime: 'live'` catalog skills whose production caller is NOT a cron
 * sweep (webhook chain, event-create handler, or the instruction/talk
 * dispatch). Listed so the guard's inverse check knows they are
 * caller-covered. Each entry names the caller for the next reader.
 */
export const NON_SWEEP_LIVE_SKILLS: Readonly<Record<string, string>> = {
  // Vertical-router + FUB/HubSpot/Salesforce sync sweeps (webhook-derived).
  'lead-triage-realestate':
    'lib/skills/vertical-router.ts + follow-up-boss/hubspot/salesforce-sync sweeps',
  // process-webhook-event generic chain (fires on every inbound webhook).
  'chief-of-staff-scheduler': 'lib/inngest/functions/scheduler-sweep.ts + process-webhook-event',
  'office-admin': 'lib/inngest/functions/process-webhook-event.ts (generic chain)',
  'inbox-triage-general': 'lib/inngest/functions/process-webhook-event.ts (generic chain)',
  // SupportRequest-create handler.
  'support-handler': 'lib/inngest/functions/support-handler-on-create.ts',
  // pfd-3 L1 triage — intercepts every SupportRequest create (help form +
  // in-app chat) before the draft path; same event-create caller as
  // support-handler.
  'customer-support-triage': 'lib/inngest/functions/support-handler-on-create.ts (triage interception)',
  // Plaino /talk INSTRUCT path → instruction-handler-on-create.
  'research-on-demand-general':
    'lib/inngest/functions/instruction-handler-on-create.ts (research-tagged turns)',
};
