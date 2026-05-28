/**
 * lib/skills/scheduler/chief-of-staff-fetcher.ts
 *
 * Production implementation of `ChiefOfStaffFetcher`. Composes:
 *   - the calendar multiplexer (Google vs M365), and
 *   - a (future) inbox snapshot adapter + to-do snapshot adapter.
 *
 * For Wave 1 only the CALENDAR arm is wired to real data. Inbox + to-do
 * arms default to empty arrays. Per the audit
 * (`docs/agent-interviews/01-runtime-skills.md`) the calendar source was
 * `stubbed-json` and the in-product roster lied about the agent being
 * "live" across 11 verticals. This file flips the calendar from stubbed
 * to real on every workspace with a Google or M365 credential. Inbox +
 * to-do arms are explicit empty arrays — NOT fake data — so the skill's
 * meeting proposals are grounded in real availability and reply-draft /
 * to-do generation cleanly degrade to zero until those arms ship too.
 *
 * Per `project_no_outbound_architecture.md`: read-only. The fetcher
 * never books, modifies, or invites.
 *
 * Per `feedback_cold_start_safe_agents.md`: no in-memory state across
 * calls. Each `fetchSnapshot` re-resolves the credential + the calendar
 * window.
 *
 * Per `feedback_runner_portability.md`: the skill remains provider-
 * neutral. This adapter is one of (at least) two implementations of
 * `ChiefOfStaffFetcher` — the test impl in `../chief-of-staff-scheduler/
 * json-fetcher.ts` is the other.
 */

import { skillError, skillOk, type SkillResult } from '../types';
import type {
  ChiefOfStaffFetcher,
  ChiefOfStaffSnapshot,
  InboxMessage,
  TodoItem,
} from '../chief-of-staff-scheduler/types';
import {
  CalendarMultiplexFetcher,
} from './calendar-multiplex-fetcher';
import type { CalendarFetcher } from './types';

/**
 * The local timezone surfaced on the snapshot. The skill itself doesn't
 * do tz math today (per the type comment in
 * `chief-of-staff-scheduler/types.ts.ChiefOfStaffSnapshot.localTimezone`
 * — "documentation for now"), so any string value is honest. Pick UTC
 * here so the wire shape matches the MCP server's UTC-pinned event
 * timestamps; the operator-facing tz layer lands in a later wave.
 */
const DEFAULT_LOCAL_TIMEZONE = 'UTC';

export interface ChiefOfStaffMcpFetcherConfig {
  workspaceId: string;
  /** Override the calendar fetcher. Tests pass a deterministic stub
   *  here. Production constructs the multiplexer lazily. */
  calendarFetcher?: CalendarFetcher;
  /** Inbox + to-do arms are not yet wired in Wave 1. Tests can seed
   *  them via these overrides. Production passes nothing → empty arrays. */
  inbox?: InboxMessage[];
  todos?: TodoItem[];
  localTimezone?: string;
}

export class ChiefOfStaffMcpFetcher implements ChiefOfStaffFetcher {
  readonly name = 'mcp-multiplex' as const;
  private readonly workspaceId: string;
  private readonly calendarFetcher: CalendarFetcher;
  private readonly inbox: InboxMessage[];
  private readonly todos: TodoItem[];
  private readonly localTimezone: string;

  constructor(config: ChiefOfStaffMcpFetcherConfig) {
    if (!config.workspaceId) {
      throw new Error('ChiefOfStaffMcpFetcher: workspaceId is required');
    }
    this.workspaceId = config.workspaceId;
    this.calendarFetcher =
      config.calendarFetcher ??
      new CalendarMultiplexFetcher({ workspaceId: config.workspaceId });
    this.inbox = config.inbox ?? [];
    this.todos = config.todos ?? [];
    this.localTimezone = config.localTimezone ?? DEFAULT_LOCAL_TIMEZONE;
  }

  async fetchSnapshot(args: {
    workspaceId: string;
    asOf: Date;
    lookaheadDays: number;
  }): Promise<SkillResult<ChiefOfStaffSnapshot>> {
    if (args.workspaceId !== this.workspaceId) {
      return skillError(
        'INVALID_INPUT',
        `ChiefOfStaffMcpFetcher workspaceId mismatch: bound=${this.workspaceId}, asked=${args.workspaceId}`,
      );
    }
    if (args.lookaheadDays <= 0) {
      return skillError(
        'INVALID_INPUT',
        `lookaheadDays must be > 0; got ${args.lookaheadDays}`,
      );
    }
    const windowEnd = new Date(
      args.asOf.getTime() + args.lookaheadDays * 24 * 60 * 60 * 1000,
    );
    const events = await this.calendarFetcher.fetchEvents({
      workspaceId: this.workspaceId,
      from: args.asOf,
      to: windowEnd,
    });
    if (!events.ok) return events;
    return skillOk({
      localTimezone: this.localTimezone,
      events: events.value,
      inbox: this.inbox,
      todos: this.todos,
    });
  }
}

/**
 * Result shape returned by `runSchedulerForWorkspaceIfConnected`. Callers
 * (the cron sweep) use this to distinguish "skipped because no
 * connector" (clean) from "ran and emitted N proposals" (success) and
 * "ran and the upstream errored" (failure). Mirrors the
 * `customer-files-ingestion-sweep` result shape.
 */
export interface SchedulerConnectorAwareResult {
  /** True when the multiplexer found no active calendar credential. The
   *  cron treats this as a clean skip — no failure, no proposals. */
  needsConnector: boolean;
  /** Provider that fired, when one fired. NULL when needsConnector. */
  provider: 'google' | 'm365' | null;
}
