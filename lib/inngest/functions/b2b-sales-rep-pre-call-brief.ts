/**
 * Inngest cron: B2B sales rep — daily pre-call brief (wave-5, theme #15 /
 * ratif #10).
 *
 * Was a `pending-runner-port` stub (ported from flatsbo 2026-05-29). Now a
 * real runner: every ~15 min it lists each calendar-connected workspace's
 * upcoming events, selects the intro/sales calls that start ~30 min out,
 * and builds a 5-bullet pre-call brief per call (grounded on the research
 * substrate — live web search when a key is set, fixture corpus otherwise).
 *
 * Per `project_no_outbound_architecture.md`: this cron READS the calendar
 * and PRODUCES briefs (a working document for the rep). It sends nothing.
 *
 * Per `feedback_cold_start_safe_agents.md`: every fire re-reads the
 * candidate list + calendar window. No in-memory cache between ticks.
 *
 * Per `project_fire_gate_must_wire_all_skill_callers.md`: this NEW skill
 * caller calls `gateSkillFire` (vacation pause + per-skill schedule window)
 * AND the billing-paused gate before doing any LLM work.
 *
 * Per `feedback_runner_portability.md`: the workspace lister, calendar
 * fetcher, substrate, and fire gate are all injectable so the test runs
 * with deterministic state and no Postgres / Google / Anthropic.
 *
 * Disable flag: INNGEST_FN_DISABLE_B2B_SALES_REP_PRE_CALL_BRIEF.
 */

import { withSystemContext } from '@/lib/db/rls';
import { isWorkspacePaused } from '@/lib/billing/workspace-paused-gate';
import { gateSkillFire, type FireGateOutcome } from '@/lib/skills/fire-gate';
import {
  buildBriefsForUpcomingCalls,
  PRE_CALL_BRIEF_SLUG,
  type UpcomingCall,
} from '@/lib/skills/pre-call-brief';
import {
  WebSearchResearchSubstrate,
  type IResearchSubstratePort,
} from '@/lib/skills/research-on-demand-general';
import { buildGoogleCalendarMcpServer } from '@/lib/integrations/google-calendar-mcp';
import { inngest } from '../client';
import { runWithDisableGate } from '../run-with-disable-gate';
import { withInngestErrorReporting } from '../with-error-reporting';
import { getLogger, withCronMonitor } from '@/lib/observability';

export const B2B_SALES_REP_PRE_CALL_BRIEF_FUNCTION_ID =
  'b2b-sales-rep-pre-call-brief';
/** Every 15 minutes — the 30-min lead window + a 10-min tolerance means a
 *  15-min cadence catches each call exactly once as it crosses the window. */
export const B2B_SALES_REP_PRE_CALL_BRIEF_CRON = '*/15 * * * *';
/** On-demand trigger for dev-console smoke-testing. */
export const B2B_SALES_REP_PRE_CALL_BRIEF_TRIGGER_EVENT =
  'agentplain/b2b-sales-rep-pre-call-brief.requested';

/** Discipline the brief is tagged under for the fire gate. */
const PRE_CALL_BRIEF_DISCIPLINE_ID = 'sales-enablement';

/** Calendar lookahead — enough to cover the lead window with margin. */
const CALENDAR_LOOKAHEAD_MINUTES = 60;

export interface PreCallBriefSweepResult {
  workspacesConsidered: number;
  workspacesSkippedPaused: number;
  workspacesSkippedFireGate: number;
  callsBriefed: number;
  failures: Array<{ workspaceId: string; reason: string }>;
}

interface PreCallWorkspaceCandidate {
  id: string;
}

export interface RunPreCallBriefSweepArgs {
  listCandidates?: () => Promise<PreCallWorkspaceCandidate[]>;
  /** Fetch the upcoming events for one workspace. Production reads the
   *  Google Calendar MCP; tests inject deterministic events. */
  fetchEvents?: (args: {
    workspaceId: string;
    from: Date;
    to: Date;
  }) => Promise<UpcomingCall[]>;
  /** Substrate factory per workspace. Defaults to the web-search substrate
   *  (fixture fallback when no key). Tests inject a recording substrate. */
  buildSubstrate?: (workspaceId: string) => IResearchSubstratePort;
  /** Whether the bound substrate grounds live. Defaults to deriving it
   *  from a WebSearchResearchSubstrate. */
  groundingIsLive?: (substrate: IResearchSubstratePort) => boolean;
  gateFire?: (workspaceId: string) => Promise<FireGateOutcome>;
  isPaused?: (workspaceId: string) => Promise<{ isPaused: boolean }>;
  now?: Date;
}

export async function runPreCallBriefSweep(
  args: RunPreCallBriefSweepArgs = {},
): Promise<PreCallBriefSweepResult> {
  const now = args.now ?? new Date();
  const listCandidates = args.listCandidates ?? defaultListCandidates;
  const candidates = await listCandidates();

  const result: PreCallBriefSweepResult = {
    workspacesConsidered: candidates.length,
    workspacesSkippedPaused: 0,
    workspacesSkippedFireGate: 0,
    callsBriefed: 0,
    failures: [],
  };

  const from = now;
  const to = new Date(now.getTime() + CALENDAR_LOOKAHEAD_MINUTES * 60_000);

  for (const ws of candidates) {
    // Gate 1: billing pause.
    const pause = await (args.isPaused
      ? args.isPaused(ws.id)
      : isWorkspacePaused({ workspaceId: ws.id }).catch(() => ({ isPaused: false })));
    if (pause.isPaused) {
      result.workspacesSkippedPaused += 1;
      continue;
    }

    // Gate 2: vacation/PTO + per-skill schedule window.
    const gate = await (args.gateFire
      ? args.gateFire(ws.id)
      : withSystemContext((tx) =>
          gateSkillFire({
            tx,
            workspaceId: ws.id,
            skillSlug: PRE_CALL_BRIEF_SLUG,
            disciplineId: PRE_CALL_BRIEF_DISCIPLINE_ID,
            now,
          }),
        ).catch((): FireGateOutcome => ({ allowed: true })));
    if (!gate.allowed) {
      result.workspacesSkippedFireGate += 1;
      continue;
    }

    try {
      const events = await (args.fetchEvents
        ? args.fetchEvents({ workspaceId: ws.id, from, to })
        : defaultFetchEvents({ workspaceId: ws.id, from, to }));

      const substrate =
        args.buildSubstrate?.(ws.id) ?? new WebSearchResearchSubstrate();
      const live = args.groundingIsLive
        ? args.groundingIsLive(substrate)
        : substrate instanceof WebSearchResearchSubstrate
          ? substrate.isLive
          : false;

      const built = await buildBriefsForUpcomingCalls({
        events,
        substrate,
        workspaceId: ws.id,
        now,
        groundingIsLive: live,
      });
      result.callsBriefed += built.briefs.length;
      for (const f of built.failures) {
        result.failures.push({ workspaceId: ws.id, reason: f.reason });
      }
    } catch (err) {
      result.failures.push({
        workspaceId: ws.id,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return result;
}

/** Default candidate lister — workspaces with an ACTIVE GOOGLE credential
 *  (calendar reads use the same Google grant as Gmail). */
async function defaultListCandidates(): Promise<PreCallWorkspaceCandidate[]> {
  return withSystemContext(async (tx) => {
    const workspaces = await tx.workspace.findMany({
      where: {
        memberships: { some: { status: 'ACTIVE' } },
        integrationCredentials: {
          some: { status: 'ACTIVE', provider: 'GOOGLE' },
        },
      },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });
    return workspaces.map((ws) => ({ id: ws.id }));
  });
}

/** Default calendar fetch via the Google Calendar MCP port. Maps the
 *  provider-neutral CalendarEventDto into the skill's UpcomingCall shape. */
async function defaultFetchEvents(args: {
  workspaceId: string;
  from: Date;
  to: Date;
}): Promise<UpcomingCall[]> {
  const cal = buildGoogleCalendarMcpServer({ workspaceId: args.workspaceId });
  const res = await cal.listEvents({ from: args.from, to: args.to });
  if (!res.ok) return [];
  return res.value.events.map((ev) => ({
    id: ev.id,
    title: ev.title,
    startUtc: ev.startUtc,
  }));
}

export const b2bSalesRepPreCallBriefFn = inngest.createFunction(
  {
    id: B2B_SALES_REP_PRE_CALL_BRIEF_FUNCTION_ID,
    name: 'B2B sales rep — pre-call brief (every 15 min, ~30 min before each intro call)',
    triggers: [
      { cron: B2B_SALES_REP_PRE_CALL_BRIEF_CRON },
      { event: B2B_SALES_REP_PRE_CALL_BRIEF_TRIGGER_EVENT },
    ],
  },
  async () =>
    runWithDisableGate(B2B_SALES_REP_PRE_CALL_BRIEF_FUNCTION_ID, () =>
      withCronMonitor(
        {
          slug: B2B_SALES_REP_PRE_CALL_BRIEF_FUNCTION_ID,
          schedule: B2B_SALES_REP_PRE_CALL_BRIEF_CRON,
          checkinMargin: 10,
          maxRuntime: 10,
        },
        () =>
          withInngestErrorReporting(
            { functionId: B2B_SALES_REP_PRE_CALL_BRIEF_FUNCTION_ID },
            async () => {
              const logger = getLogger().child({
                boundary: 'inngest',
                function_id: B2B_SALES_REP_PRE_CALL_BRIEF_FUNCTION_ID,
              });
              logger.info('pre-call-brief sweep started');
              const out = await runPreCallBriefSweep();
              logger.info('pre-call-brief sweep finished', {
                considered: out.workspacesConsidered,
                skipped_paused: out.workspacesSkippedPaused,
                skipped_fire_gate: out.workspacesSkippedFireGate,
                calls_briefed: out.callsBriefed,
                failed: out.failures.length,
              });
              return out;
            },
          ),
      ),
    ),
);
