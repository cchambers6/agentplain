/**
 * lib/skills/pre-call-brief/run-upcoming.ts
 *
 * Selects the intro calls that start ~30 min from now and builds a 5-bullet
 * pre-call brief for each (wave-5, theme #15 / ratif #10). Kept separate
 * from `skill.ts` (pure brief composition) so the calendar windowing + the
 * "is this an intro call?" classification are testable without an LLM.
 *
 * The cron passes calendar events (already fetched via the calendar MCP
 * port) + a substrate; this module owns the windowing, the intro-call
 * filter, and the per-call fan-out. Per `feedback_runner_portability.md`
 * the brief composer is injected so tests don't need the LLM.
 */

import { runSkill as runPreCallBrief } from './skill';
import type {
  PreCallBrief,
  PreCallBriefResult,
  UpcomingCall,
} from './types';
import type { IResearchSubstratePort } from '../research-on-demand-general';

/** Keywords in the event title that mark it as an intro / sales call worth
 *  briefing. Deliberately broad; the rep can tune later. */
const INTRO_CALL_HINTS = [
  'intro',
  'discovery',
  'demo',
  'sales call',
  'prospect',
  'pitch',
  'first call',
];

export interface SelectImminentCallsArgs {
  events: UpcomingCall[];
  now: Date;
  /** Brief lands this many minutes before the call. Default 30. */
  leadMinutes?: number;
  /** Width of the trigger window in minutes — a call qualifies when it
   *  starts within [lead - tolerance, lead + tolerance] from now. Default
   *  10 so a cron firing every ~10-15 min catches each call exactly once.*/
  toleranceMinutes?: number;
  /** When false, brief EVERY upcoming event (not just intro-classified).
   *  Default true — only intro/sales calls get a brief. */
  introOnly?: boolean;
}

/**
 * Pure selection: which calls start ~`leadMinutes` from `now`. The
 * tolerance window makes the cron idempotent-ish: a call is selected once
 * as it crosses into the window. (Durable de-dupe — not re-briefing the
 * same call on the next tick — is the caller's job via the approval-queue
 * idempotency key it already uses; this function just windows.)
 */
export function selectImminentCalls(args: SelectImminentCallsArgs): UpcomingCall[] {
  const lead = args.leadMinutes ?? 30;
  const tol = args.toleranceMinutes ?? 10;
  const introOnly = args.introOnly ?? true;
  const nowMs = args.now.getTime();
  const lowMs = nowMs + (lead - tol) * 60_000;
  const highMs = nowMs + (lead + tol) * 60_000;

  return args.events.filter((ev) => {
    const start = new Date(ev.startUtc).getTime();
    if (Number.isNaN(start)) return false;
    if (start < lowMs || start > highMs) return false;
    if (!introOnly) return true;
    return isIntroCall(ev.title);
  });
}

export function isIntroCall(title: string): boolean {
  const t = title.toLowerCase();
  return INTRO_CALL_HINTS.some((h) => t.includes(h));
}

export interface BuildBriefsArgs {
  events: UpcomingCall[];
  substrate: IResearchSubstratePort;
  workspaceId: string;
  now: Date;
  groundingIsLive?: boolean;
  leadMinutes?: number;
  toleranceMinutes?: number;
  introOnly?: boolean;
  /** Override the brief composer (tests inject a stub to skip the LLM). */
  compose?: (call: UpcomingCall) => Promise<PreCallBriefResult>;
}

export interface BuildBriefsResult {
  considered: number;
  selected: number;
  briefs: PreCallBrief[];
  failures: Array<{ callId: string; reason: string }>;
}

/**
 * Window the events, then build a brief per imminent intro call. Failures
 * are collected, not thrown, so one bad call never blocks the rest.
 */
export async function buildBriefsForUpcomingCalls(
  args: BuildBriefsArgs,
): Promise<BuildBriefsResult> {
  const selected = selectImminentCalls({
    events: args.events,
    now: args.now,
    leadMinutes: args.leadMinutes,
    toleranceMinutes: args.toleranceMinutes,
    introOnly: args.introOnly,
  });

  const result: BuildBriefsResult = {
    considered: args.events.length,
    selected: selected.length,
    briefs: [],
    failures: [],
  };

  const compose =
    args.compose ??
    ((call: UpcomingCall) =>
      runPreCallBrief({
        call,
        substrate: args.substrate,
        workspaceId: args.workspaceId,
        groundingIsLive: args.groundingIsLive,
      }));

  for (const call of selected) {
    try {
      const res = await compose(call);
      if (res.ok) {
        result.briefs.push(res.value);
      } else {
        result.failures.push({
          callId: call.id,
          reason: `${res.error.code}: ${res.error.message}`,
        });
      }
    } catch (err) {
      result.failures.push({
        callId: call.id,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return result;
}
