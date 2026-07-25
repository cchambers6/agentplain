/**
 * lib/integrations/outlook-calendar-mcp/with-approval.ts
 *
 * The Outlook Calendar approval gate — the connector-specific decorator that
 * forces EVERY mutating Calendar method through the shared connector approval
 * gate (`lib/integrations/approval`) before Microsoft Graph is touched.
 * Mirrors `google-calendar-mcp/with-approval.ts`, built on the same generic
 * gate so the connectors share one fingerprint/persistence/audit core.
 *
 * Read methods pass straight through: `listCalendars`, `listEvents`,
 * `getEvent`, `findAvailability` (busy blocks from calendarView), and
 * `proposeTimes` (slot arithmetic over free/busy) mutate nothing. The
 * mutations — `bookMeeting` (POST /me/events, invites attendees),
 * `rescheduleMeeting` (PATCH), `updateEvent` (PATCH), and `cancelEvent`
 * (DELETE, Graph sends cancellations) — are intercepted: a missing/invalid/
 * expired grant returns APPROVAL_REQUIRED and the Graph call never happens;
 * a valid grant lets the call run and is audit-logged.
 *
 * Installed at the factory seam (`buildOutlookCalendarMcpServer`), so an
 * ungated Calendar server cannot be obtained.
 *
 * Result-type bridge: this connector uses its OWN `OutlookCalendarMcpResult<T>`,
 * which is STRUCTURALLY IDENTICAL to the generic `McpResult<T>` the gate speaks
 * — same `{ ok: true; value } | { ok: false; error }` union, and the
 * `APPROVAL_REQUIRED` code exists in both error unions. We therefore bridge with
 * an `as unknown as` cast in each direction (into `execute`, out of the result).
 * It is a zero-cost identity cast, not a conversion — the runtime shapes match.
 */

import type { McpResult } from '@/lib/integrations/mcp-core';
import {
  gateAndRun,
  type ConnectorApprovalDeps,
  type GatedAction,
} from '@/lib/integrations/approval';
import type {
  GetEventInput,
  GetEventOutput,
  ListCalendarsOutput,
  ListEventsInput,
  ListEventsOutput,
  OutlookCalendarMcpResult,
  OutlookCalendarMcpServer,
  ReadResourceInput,
  ReadResourceOutput,
  ResourceDescriptor,
} from './types';
import {
  BOOK_MEETING,
  RESCHEDULE_MEETING,
  UPDATE_EVENT,
  CANCEL_EVENT,
  calendarAction,
  type BookMeetingInput,
  type BookMeetingOutput,
  type RescheduleMeetingInput,
  type RescheduleMeetingOutput,
  type UpdateEventInput,
  type UpdateEventOutput,
  type CancelEventInput,
  type CancelEventOutput,
  type FindAvailabilityInput,
  type FindAvailabilityOutput,
  type ProposeTimesInput,
  type ProposeTimesOutput,
  type WriteActionDescriptor,
} from './actions';

/** Wrap a Calendar server so all mutating methods require an approved grant. */
export function withOutlookCalendarApproval(
  inner: OutlookCalendarMcpServer,
  deps: ConnectorApprovalDeps,
): OutlookCalendarMcpServer {
  return new GatedOutlookCalendarMcpServer(inner, deps);
}

class GatedOutlookCalendarMcpServer implements OutlookCalendarMcpServer {
  readonly name: string;
  readonly workspaceId: string;

  constructor(
    private readonly inner: OutlookCalendarMcpServer,
    private readonly deps: ConnectorApprovalDeps,
  ) {
    this.name = inner.name;
    this.workspaceId = inner.workspaceId;
  }

  /**
   * Run a mutating method through the shared gate. The gate speaks the generic
   * `McpResult<T>`; this connector speaks `OutlookCalendarMcpResult<T>`. The two
   * are the identical discriminated-union shape, so we cast the `execute`
   * Promise into the generic type going in and cast the result back coming out.
   * Both casts are identity casts (no data is reshaped at runtime).
   */
  private async gate<T>(
    action: GatedAction,
    execute: () => Promise<OutlookCalendarMcpResult<T>>,
  ): Promise<OutlookCalendarMcpResult<T>> {
    const result = await gateAndRun({
      gate: this.deps.gate,
      audit: this.deps.audit,
      workspaceId: this.workspaceId,
      action,
      // Identical-shape cast: OutlookCalendarMcpResult<T> ≅ McpResult<T>.
      execute: execute as unknown as () => Promise<McpResult<T>>,
    });
    // Identical-shape cast back to the connector's own result type.
    return result as unknown as OutlookCalendarMcpResult<T>;
  }

  // ── Reads: straight pass-through (no mutation) ─────────────────────────

  listCalendars(): Promise<OutlookCalendarMcpResult<ListCalendarsOutput>> {
    return this.inner.listCalendars();
  }

  listEvents(
    input: ListEventsInput,
  ): Promise<OutlookCalendarMcpResult<ListEventsOutput>> {
    return this.inner.listEvents(input);
  }

  getEvent(input: GetEventInput): Promise<OutlookCalendarMcpResult<GetEventOutput>> {
    return this.inner.getEvent(input);
  }

  findAvailability(
    input: FindAvailabilityInput,
  ): Promise<OutlookCalendarMcpResult<FindAvailabilityOutput>> {
    return this.inner.findAvailability(input);
  }

  proposeTimes(
    input: ProposeTimesInput,
  ): Promise<OutlookCalendarMcpResult<ProposeTimesOutput>> {
    return this.inner.proposeTimes(input);
  }

  // ── Write-action mutations (approval-gated) ────────────────────────────

  bookMeeting(
    input: BookMeetingInput,
  ): Promise<OutlookCalendarMcpResult<BookMeetingOutput>> {
    return this.gate(calendarAction(BOOK_MEETING, input), () =>
      this.inner.bookMeeting(input),
    );
  }

  rescheduleMeeting(
    input: RescheduleMeetingInput,
  ): Promise<OutlookCalendarMcpResult<RescheduleMeetingOutput>> {
    return this.gate(calendarAction(RESCHEDULE_MEETING, input), () =>
      this.inner.rescheduleMeeting(input),
    );
  }

  updateEvent(
    input: UpdateEventInput,
  ): Promise<OutlookCalendarMcpResult<UpdateEventOutput>> {
    return this.gate(calendarAction(UPDATE_EVENT, input), () =>
      this.inner.updateEvent(input),
    );
  }

  cancelEvent(
    input: CancelEventInput,
  ): Promise<OutlookCalendarMcpResult<CancelEventOutput>> {
    return this.gate(calendarAction(CANCEL_EVENT, input), () =>
      this.inner.cancelEvent(input),
    );
  }

  // ── Resources: pass-through ────────────────────────────────────────────

  listResources(): Promise<OutlookCalendarMcpResult<ResourceDescriptor[]>> {
    return this.inner.listResources();
  }

  readResource(
    input: ReadResourceInput,
  ): Promise<OutlookCalendarMcpResult<ReadResourceOutput>> {
    return this.inner.readResource(input);
  }
}

// Re-export for symmetry with other connectors' approval modules.
export type { WriteActionDescriptor };
