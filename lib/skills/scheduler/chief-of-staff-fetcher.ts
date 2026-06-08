/**
 * lib/skills/scheduler/chief-of-staff-fetcher.ts
 *
 * Production implementation of `ChiefOfStaffFetcher`. Composes:
 *   - the calendar multiplexer (Google vs M365), and
 *   - a (future) inbox snapshot adapter + to-do snapshot adapter.
 *
 * Wave 1 wired only the CALENDAR arm to real data; inbox + to-do arms
 * defaulted to empty arrays, so reply-draft / meeting-from-inbox
 * generation never fired. Wave 2 wires the INBOX arm to the real mailbox
 * through the `InboxSnapshotFetcher` seam (`lib/integrations/inbox/`):
 * on a workspace with a Google / M365 credential the scheduler reads the
 * current inbox tip (live behind `LIVE_INBOX_FETCH`, fixtures in dev) and
 * the skill proposes reply drafts + meetings off real mail. The to-do
 * arm stays an explicit empty array — NOT fake data — until a task-system
 * adapter ships. Per the audit
 * (`docs/agent-interviews/01-runtime-skills.md`) the calendar source was
 * `stubbed-json`; this file keeps that real and adds the inbox arm.
 *
 * Per `feedback_no_silent_vendor_lock.md`: the inbox arm speaks the
 * `InboxSnapshotFetcher` port; googleapis / Graph stay confined to their
 * integration packages.
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
import type { ParsedMessage } from '../types';
import type {
  ChiefOfStaffFetcher,
  ChiefOfStaffSnapshot,
  InboxMessage,
  TodoItem,
} from '../chief-of-staff-scheduler/types';
import {
  CalendarMultiplexFetcher,
} from './calendar-multiplex-fetcher';
import {
  buildInboxFetcher,
  type InboxProvider,
  type InboxSnapshotFetcher,
} from '@/lib/integrations/inbox';
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

/** Inbox read cap on a scheduler fire. The skill only needs the most
 *  recent unanswered mail to propose reply drafts / meetings; 15 keeps the
 *  per-fire Gmail/Graph read budget small. */
const DEFAULT_INBOX_MAX = 15;

export interface ChiefOfStaffMcpFetcherConfig {
  workspaceId: string;
  /** Override the calendar fetcher. Tests pass a deterministic stub
   *  here. Production constructs the multiplexer lazily. */
  calendarFetcher?: CalendarFetcher;
  /** Wave-2: override the inbox-snapshot fetcher. Production builds one via
   *  the `lib/integrations/inbox` factory (live behind `LIVE_INBOX_FETCH`,
   *  fixtures otherwise). Tests inject a deterministic impl. */
  inboxFetcher?: InboxSnapshotFetcher;
  /** Which provider the workspace's email credential is for — drives the
   *  live inbox fetcher. Defaults to GOOGLE; ignored on the fixture path
   *  and when `inboxFetcher` / `inbox` is supplied. */
  inboxProvider?: InboxProvider;
  /** Static inbox override. When supplied, the fetcher is NOT consulted —
   *  the test pattern for asserting the snapshot shape without a fetcher. */
  inbox?: InboxMessage[];
  /** To-do arm is not yet wired to a task-system adapter. Tests can seed
   *  it; production passes nothing → empty array. */
  todos?: TodoItem[];
  localTimezone?: string;
}

export class ChiefOfStaffMcpFetcher implements ChiefOfStaffFetcher {
  readonly name = 'mcp-multiplex' as const;
  private readonly workspaceId: string;
  private readonly calendarFetcher: CalendarFetcher;
  private readonly inboxFetcher: InboxSnapshotFetcher | null;
  private readonly inboxOverride: InboxMessage[] | null;
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
    // A static `inbox` override wins (test pattern). Otherwise resolve the
    // inbox-snapshot fetcher — injected impl, or the factory-built one
    // (fixtures unless LIVE_INBOX_FETCH is on).
    this.inboxOverride = config.inbox ?? null;
    this.inboxFetcher =
      config.inbox !== undefined
        ? null
        : config.inboxFetcher ??
          buildInboxFetcher({
            workspaceId: config.workspaceId,
            provider: config.inboxProvider ?? 'GOOGLE',
          });
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

    const inbox = await this.resolveInbox();
    return skillOk({
      localTimezone: this.localTimezone,
      events: events.value,
      inbox,
      todos: this.todos,
    });
  }

  /**
   * Resolve the inbox arm. A static override returns verbatim. Otherwise
   * read the inbox tip via the snapshot fetcher and map to `InboxMessage`.
   * A fetch error degrades to an empty inbox (calendar proposals still
   * ship) rather than failing the whole sweep — the cron stays loud via
   * the warn but never starves on a transient mailbox blip.
   */
  private async resolveInbox(): Promise<InboxMessage[]> {
    if (this.inboxOverride) return this.inboxOverride;
    if (!this.inboxFetcher) return [];
    const res = await this.inboxFetcher.fetchInbox({
      workspaceId: this.workspaceId,
      maxResults: DEFAULT_INBOX_MAX,
    });
    if (!res.ok) {
      console.warn(
        `ChiefOfStaffMcpFetcher: inbox arm (${this.inboxFetcher.name}) failed — ` +
          `proceeding with empty inbox. ${res.error.message}`,
      );
      return [];
    }
    return res.value.map(toInboxMessage);
  }
}

/** Map the provider-neutral `ParsedMessage` to the scheduler's narrower
 *  `InboxMessage`. The skill reads subject + body + sender to decide which
 *  mail earns a reply draft / meeting proposal. */
function toInboxMessage(m: ParsedMessage): InboxMessage {
  return {
    id: m.id,
    threadId: m.threadId,
    fromEmail: m.fromEmail,
    fromName: m.fromName,
    subject: m.subject,
    bodyText: m.bodyText,
    receivedAt: m.receivedAt,
  };
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
