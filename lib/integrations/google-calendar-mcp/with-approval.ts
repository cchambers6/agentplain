/**
 * lib/integrations/google-calendar-mcp/with-approval.ts
 *
 * The Google Calendar approval gate — the connector-specific decorator that
 * forces EVERY mutating Calendar method through the shared connector approval
 * gate (`lib/integrations/approval`) before Google's REST API is touched.
 * Mirrors `hubspot-mcp/with-approval.ts`, built on the same generic gate so the
 * connectors share one fingerprint/persistence/audit core.
 *
 * Read methods pass straight through: `listEvents` and `findAvailability` (a
 * free/busy query) reveal no event detail and mutate nothing. The mutations —
 * `bookMeeting` (events.insert, invites attendees) and `rescheduleMeeting`
 * (events.patch) — are intercepted: a missing/invalid/expired grant returns
 * APPROVAL_REQUIRED and the Google call never happens; a valid grant lets the
 * call run and is audit-logged.
 *
 * Installed at the factory seam (`buildGoogleCalendarMcpServer`), so an ungated
 * Calendar server cannot be obtained.
 *
 * Result-type bridge: this connector uses its OWN `GoogleCalendarMcpResult<T>`,
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
  GoogleCalendarMcpResult,
  GoogleCalendarMcpServer,
  ListEventsInput,
  ListEventsOutput,
  ReadResourceInput,
  ReadResourceOutput,
  ResourceDescriptor,
} from './types';
import {
  BOOK_MEETING,
  RESCHEDULE_MEETING,
  calendarAction,
  type BookMeetingInput,
  type BookMeetingOutput,
  type RescheduleMeetingInput,
  type RescheduleMeetingOutput,
  type FindAvailabilityInput,
  type FindAvailabilityOutput,
  type WriteActionDescriptor,
} from './actions';

/** Wrap a Calendar server so all mutating methods require an approved grant. */
export function withGoogleCalendarApproval(
  inner: GoogleCalendarMcpServer,
  deps: ConnectorApprovalDeps,
): GoogleCalendarMcpServer {
  return new GatedGoogleCalendarMcpServer(inner, deps);
}

class GatedGoogleCalendarMcpServer implements GoogleCalendarMcpServer {
  readonly name: string;
  readonly workspaceId: string;

  constructor(
    private readonly inner: GoogleCalendarMcpServer,
    private readonly deps: ConnectorApprovalDeps,
  ) {
    this.name = inner.name;
    this.workspaceId = inner.workspaceId;
  }

  /**
   * Run a mutating method through the shared gate. The gate speaks the generic
   * `McpResult<T>`; this connector speaks `GoogleCalendarMcpResult<T>`. The two
   * are the identical discriminated-union shape, so we cast the `execute`
   * Promise into the generic type going in and cast the result back coming out.
   * Both casts are identity casts (no data is reshaped at runtime).
   */
  private async gate<T>(
    action: GatedAction,
    execute: () => Promise<GoogleCalendarMcpResult<T>>,
  ): Promise<GoogleCalendarMcpResult<T>> {
    const result = await gateAndRun({
      gate: this.deps.gate,
      audit: this.deps.audit,
      workspaceId: this.workspaceId,
      action,
      // Identical-shape cast: GoogleCalendarMcpResult<T> ≅ McpResult<T>.
      execute: execute as unknown as () => Promise<McpResult<T>>,
    });
    // Identical-shape cast back to the connector's own result type.
    return result as unknown as GoogleCalendarMcpResult<T>;
  }

  // ── Reads: straight pass-through (no mutation) ─────────────────────────

  listEvents(
    input: ListEventsInput,
  ): Promise<GoogleCalendarMcpResult<ListEventsOutput>> {
    return this.inner.listEvents(input);
  }

  findAvailability(
    input: FindAvailabilityInput,
  ): Promise<GoogleCalendarMcpResult<FindAvailabilityOutput>> {
    return this.inner.findAvailability(input);
  }

  // ── Write-action mutations (approval-gated) ────────────────────────────

  bookMeeting(
    input: BookMeetingInput,
  ): Promise<GoogleCalendarMcpResult<BookMeetingOutput>> {
    return this.gate(calendarAction(BOOK_MEETING, input), () =>
      this.inner.bookMeeting(input),
    );
  }

  rescheduleMeeting(
    input: RescheduleMeetingInput,
  ): Promise<GoogleCalendarMcpResult<RescheduleMeetingOutput>> {
    return this.gate(calendarAction(RESCHEDULE_MEETING, input), () =>
      this.inner.rescheduleMeeting(input),
    );
  }

  // ── Resources: pass-through ────────────────────────────────────────────

  listResources(): Promise<GoogleCalendarMcpResult<ResourceDescriptor[]>> {
    return this.inner.listResources();
  }

  readResource(
    input: ReadResourceInput,
  ): Promise<GoogleCalendarMcpResult<ReadResourceOutput>> {
    return this.inner.readResource(input);
  }
}

// Re-export for symmetry with other connectors' approval modules.
export type { WriteActionDescriptor };
