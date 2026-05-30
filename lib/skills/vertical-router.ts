/**
 * lib/skills/vertical-router.ts
 *
 * Wave-1 vertical webhook router. Sits alongside the existing generic
 * skill chain in `lib/inngest/functions/process-webhook-event.ts` — for
 * every WebhookEvent the sweep drains, the generic chain runs
 * UNCONDITIONALLY (the 5 horizontal skills already wired), and THIS
 * router fires any additional vertical-specific skills that:
 *
 *   1. Match the workspace's vertical, AND
 *   2. Have a runtime adapter wired for the webhook event type today
 *      (an honest port from `ParsedMessage` into the vertical skill's
 *       input shape), AND
 *   3. Their discipline is not disabled on the workspace.
 *
 * Per the audit (`docs/fleet-autonomy-audit-2026-05-28.md` §8 #2): the
 * vertical-specific skills "do not fire at all" today; this router is
 * the seam that closes that gap.
 *
 * Honesty bar — the wave-1 router registers ONE vertical skill end-to-end:
 *
 *   • `lead-triage-realestate` for `real-estate` workspaces.
 *
 * That is honest because the lead-triage skill takes a LeadFetcher that
 * we can derive from a ParsedMessage (per the
 * ParsedMessageLeadFetcher) without inventing data. The other 10
 * vertical skills need CRM-shaped or LOS-shaped inputs that an inbound
 * email alone cannot produce; their email-trigger adapters land in wave
 * 2. Until then they stay STAGED (no production caller) and the
 * customer-facing copy must not claim they fire on email events.
 *
 * Per `project_no_outbound_architecture.md`: nothing in this router
 * sends. The dispatched skills produce drafts / triage decisions that
 * land in the approval queue.
 *
 * Per `feedback_cold_start_safe_agents.md`: stateless. Each dispatch
 * reads durable state per fire.
 *
 * Per `feedback_no_silent_vendor_lock.md`: no vendor SDK imports here.
 * The router calls the skill's existing run-for-event helpers, which
 * speak the provider-neutral MessageFetcher port.
 */

import type { WebhookEvent, Workspace } from '@prisma/client';
import { asDisciplineId } from '@/lib/disciplines';
import { SKILL_DISCIPLINE } from '@/lib/disciplines/skill-mapping';
import { runLeadTriageForEvent } from './lead-triage-realestate/run-for-event';
import type { MessageFetcher } from './types';

export type RouterDispatchOutcome =
  | { status: 'dispatched'; skillSlug: string; result: unknown }
  | { status: 'skipped-discipline-disabled'; skillSlug: string }
  | { status: 'skipped-no-match'; skillSlug: string }
  | { status: 'errored'; skillSlug: string; reason: string };

export interface RunVerticalRouterArgs {
  /** Workspace the event belongs to. The router branches on
   *  `workspace.vertical`. */
  workspace: Pick<Workspace, 'id' | 'slug' | 'name' | 'vertical'>;
  /** The webhook event being drained. */
  event: WebhookEvent;
  /** Message fetcher — same adapter the generic chain used. */
  fetcher: MessageFetcher;
  /** Per-workspace discipline-disable set, surfaced verbatim from the
   *  workspace preference row. The router refuses to fire a skill
   *  whose discipline is in this set. */
  disabledDisciplineIds?: ReadonlyArray<string>;
  /** Optional fixed clock for tests. */
  now?: Date;
}

export interface RunVerticalRouterResult {
  /** Outcomes in registration order. The caller logs these into the
   *  AuditLog payload so an operator can verify which vertical skills
   *  fired (or why one was skipped) for a given event. */
  outcomes: RouterDispatchOutcome[];
  /** Convenience: count of `dispatched` outcomes. */
  dispatched: number;
  /** Convenience: count of `skipped-*` outcomes. */
  skipped: number;
}

/** Internal registration shape. The router walks this list once per
 *  event; each entry decides whether to fire based on its own predicate. */
interface VerticalRouterRegistration {
  skillSlug: string;
  /** Which vertical(s) this skill claims. */
  matchVertical: (vertical: Workspace['vertical']) => boolean;
  /** Run the skill against the event. Caller has already confirmed the
   *  vertical matches AND the skill's discipline is not disabled. */
  dispatch: (
    args: RunVerticalRouterArgs,
  ) => Promise<{ result: unknown }>;
}

/** The wave-1 registry. Adding a new vertical-skill ↔ email-trigger pair
 *  in wave 2 means appending one row here AND shipping the corresponding
 *  ParsedMessage-derived fetcher (per the two-implementation rule). */
const REGISTRATIONS: VerticalRouterRegistration[] = [
  {
    skillSlug: 'lead-triage-realestate',
    matchVertical: (v) => v === 'REAL_ESTATE',
    dispatch: async (args) => {
      const result = await runLeadTriageForEvent({
        workspaceId: args.workspace.id,
        fetcher: args.fetcher,
        event: args.event,
        now: args.now,
      });
      return { result };
    },
  },
];

export async function runVerticalRouter(
  args: RunVerticalRouterArgs,
): Promise<RunVerticalRouterResult> {
  const disabled = new Set(
    (args.disabledDisciplineIds ?? [])
      .map((d) => asDisciplineId(d))
      .filter((d): d is NonNullable<ReturnType<typeof asDisciplineId>> => d !== null),
  );
  const outcomes: RouterDispatchOutcome[] = [];
  let dispatched = 0;
  let skipped = 0;
  for (const reg of REGISTRATIONS) {
    if (!reg.matchVertical(args.workspace.vertical)) {
      // Skipping a non-matching vertical is the EXPECTED case for every
      // workspace except the one match; we DO NOT emit an outcome so
      // the audit log stays compact. Only EXPLICIT skips (discipline
      // disabled, error) and dispatches land in outcomes.
      continue;
    }
    const disciplineId = SKILL_DISCIPLINE[reg.skillSlug];
    if (disciplineId && disabled.has(disciplineId)) {
      outcomes.push({
        status: 'skipped-discipline-disabled',
        skillSlug: reg.skillSlug,
      });
      skipped += 1;
      continue;
    }
    try {
      const { result } = await reg.dispatch(args);
      outcomes.push({ status: 'dispatched', skillSlug: reg.skillSlug, result });
      dispatched += 1;
    } catch (err) {
      outcomes.push({
        status: 'errored',
        skillSlug: reg.skillSlug,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return { outcomes, dispatched, skipped };
}

/**
 * Surface for tests + the audit log — what vertical skills are
 * REGISTERED for a given vertical. Returns the slugs only. An empty
 * array means: no vertical-specific skills fire on inbound email for
 * this workspace today (which is true for all verticals except
 * real-estate in wave 1).
 */
export function registeredVerticalSkillsFor(
  vertical: Workspace['vertical'],
): string[] {
  return REGISTRATIONS.filter((r) => r.matchVertical(vertical)).map(
    (r) => r.skillSlug,
  );
}
