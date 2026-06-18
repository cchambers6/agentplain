/**
 * lib/integrations/google-calendar-mcp/actions/index.ts
 *
 * The Google Calendar WRITE-ACTION surface — the per-action source of truth for
 * the mutating tools added in the write-action-depth wave. Each descriptor names
 * the action, its approval discipline, and a `summarize` that distills the input
 * into the canonical `detail` the approval gate fingerprints AND the operator
 * sees on the /approvals card.
 *
 * Mirrors `lib/integrations/hubspot-mcp/actions/index.ts`. The actual REST is
 * implemented on `ProdGoogleCalendarMcpServer` (server.ts); the gate decorator
 * (with-approval.ts) reads these descriptors so the action name + detail used
 * for the fingerprint and the audit row are defined in exactly one place.
 * Nothing here calls Google — it's the gate-facing metadata.
 *
 * Per `project_no_outbound_architecture.md`: `book_meeting` and
 * `reschedule_meeting` mutate the customer's calendar (and notify attendees),
 * so the gate is load-bearing — neither fires without a recorded human approval.
 * `find_availability` is a free/busy READ — its I/O types live here for symmetry
 * but it is NOT gated (it passes through like `listEvents`).
 */

import type { GatedAction } from '@/lib/integrations/approval';

export const GOOGLE_CALENDAR_CONNECTOR = 'google_calendar';

// ── New write-action I/O types (GATED) ───────────────────────────────────────

export interface BookMeetingInput {
  /** Calendar to create the event on — defaults to `primary`. */
  calendarId?: string;
  /** Event title. */
  summary: string;
  /** ISO 8601 start instant. */
  start: string;
  /** ISO 8601 end instant. */
  end: string;
  /** Optional attendee email addresses to invite. */
  attendees?: string[];
  /** Optional free-text event description. */
  description?: string;
  /** Approval token once the operator has approved this exact meeting. */
  pendingApprovalId?: string;
}
export interface BookMeetingOutput {
  eventId: string;
  htmlLink?: string;
}

export interface RescheduleMeetingInput {
  /** Calendar the event lives on — defaults to `primary`. */
  calendarId?: string;
  /** Id of the existing event to move. */
  eventId: string;
  /** New ISO 8601 start instant. */
  start: string;
  /** New ISO 8601 end instant. */
  end: string;
  /** Approval token once the operator has approved this exact reschedule. */
  pendingApprovalId?: string;
}
export interface RescheduleMeetingOutput {
  eventId: string;
}

// ── Read-action I/O types (UNGATED — free/busy query) ─────────────────────────

export interface FindAvailabilityInput {
  /** ISO 8601 lower bound of the free/busy window. */
  timeMin: string;
  /** ISO 8601 upper bound of the free/busy window. */
  timeMax: string;
  /** Calendars to query — defaults to `['primary']`. */
  calendarIds?: string[];
}
export interface FindAvailabilityOutput {
  /** Busy intervals across the queried calendars. */
  busy: { start: string; end: string }[];
}

// ── Gate-facing descriptors ───────────────────────────────────────────────────

/**
 * A write-action descriptor. `summarize` builds the canonical, secret-free
 * `detail` used for BOTH the fingerprint and the operator's approval card.
 */
export interface WriteActionDescriptor<TInput> {
  action: string;
  discipline: string;
  summarize: (input: TInput) => Record<string, unknown>;
}

/** Build the `GatedAction` a decorator method passes to the gate. */
export function calendarAction<TInput extends { pendingApprovalId?: string }>(
  descriptor: WriteActionDescriptor<TInput>,
  input: TInput,
): GatedAction {
  return {
    connector: GOOGLE_CALENDAR_CONNECTOR,
    action: descriptor.action,
    pendingApprovalId: input.pendingApprovalId,
    discipline: descriptor.discipline,
    detail: descriptor.summarize(input),
  };
}

export const BOOK_MEETING: WriteActionDescriptor<BookMeetingInput> = {
  action: 'book_meeting',
  discipline: 'general',
  summarize: (i) => ({
    calendarId: i.calendarId ?? 'primary',
    summary: i.summary,
    start: i.start,
    end: i.end,
    attendees: i.attendees ?? null,
    description: i.description ?? null,
  }),
};

export const RESCHEDULE_MEETING: WriteActionDescriptor<RescheduleMeetingInput> = {
  action: 'reschedule_meeting',
  discipline: 'general',
  summarize: (i) => ({
    calendarId: i.calendarId ?? 'primary',
    eventId: i.eventId,
    start: i.start,
    end: i.end,
  }),
};
