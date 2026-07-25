/**
 * lib/integrations/outlook-calendar-mcp/actions/index.ts
 *
 * The Outlook Calendar WRITE-ACTION surface — the per-action source of truth
 * for the mutating tools. Each descriptor names the action, its approval
 * discipline, and a `summarize` that distills the input into the canonical
 * `detail` the approval gate fingerprints AND the operator sees on the
 * /approvals card.
 *
 * Mirrors `lib/integrations/google-calendar-mcp/actions/index.ts` — same
 * action names, same input shapes — so the scheduler multiplexer composes
 * either provider behind one write surface. The actual REST is implemented
 * on `ProdOutlookCalendarMcpServer` (server.ts); the gate decorator
 * (with-approval.ts) reads these descriptors so the action name + detail used
 * for the fingerprint and the audit row are defined in exactly one place.
 * Nothing here calls Microsoft Graph — it's the gate-facing metadata.
 *
 * Per `project_no_outbound_architecture.md`: `book_meeting`,
 * `reschedule_meeting`, `update_event`, and `cancel_event` mutate the
 * customer's calendar (and notify attendees), so the gate is load-bearing —
 * none fires without a recorded human approval. `find_availability` (busy
 * blocks from calendarView) and `propose_times` (slot computation over
 * free/busy) are READS — their I/O types live here for symmetry but they are
 * NOT gated (they pass through like `listEvents`).
 */

import type { GatedAction } from '@/lib/integrations/approval';

export const OUTLOOK_CALENDAR_CONNECTOR = 'outlook_calendar';

// ── Write-action I/O types (GATED) ───────────────────────────────────────────

export interface BookMeetingInput {
  /** Calendar to create the event on — defaults to the primary calendar. */
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
  /** Calendar the event lives on — defaults to the primary calendar. */
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

export interface UpdateEventInput {
  /** Calendar the event lives on — defaults to the primary calendar. */
  calendarId?: string;
  /** Id of the existing event to update. */
  eventId: string;
  /** New event title. Omitted fields are left untouched (PATCH semantics). */
  summary?: string;
  /** New free-text description. */
  description?: string;
  /** New ISO 8601 start instant. Must be paired with `end`. */
  start?: string;
  /** New ISO 8601 end instant. Must be paired with `start`. */
  end?: string;
  /** REPLACES the attendee list when present (Graph PATCH semantics). */
  attendees?: string[];
  /** New location line. */
  location?: string;
  /** Approval token once the operator has approved this exact update. */
  pendingApprovalId?: string;
}
export interface UpdateEventOutput {
  eventId: string;
  htmlLink?: string;
}

export interface CancelEventInput {
  /** Calendar the event lives on — defaults to the primary calendar. */
  calendarId?: string;
  /** Id of the event to cancel. Graph sends cancellations to attendees. */
  eventId: string;
  /** Approval token once the operator has approved this exact cancellation. */
  pendingApprovalId?: string;
}
export interface CancelEventOutput {
  eventId: string;
  cancelled: true;
}

// ── Read-action I/O types (UNGATED — free/busy query) ─────────────────────────

export interface FindAvailabilityInput {
  /** ISO 8601 lower bound of the query window. */
  timeMin: string;
  /** ISO 8601 upper bound of the query window. */
  timeMax: string;
  /** Calendar ids whose busy blocks to merge — defaults to the primary. */
  calendarIds?: string[];
}
export interface FindAvailabilityOutput {
  /** Merged busy intervals across the queried calendars, ISO 8601. */
  busy: { start: string; end: string }[];
}

export interface ProposeTimesInput {
  /** ISO 8601 lower bound of the search window. */
  timeMin: string;
  /** ISO 8601 upper bound of the search window. */
  timeMax: string;
  /** Meeting length in minutes. */
  durationMinutes: number;
  /** Calendars whose busy blocks constrain the slots — defaults primary. */
  calendarIds?: string[];
  /** Max slots to return, 1..20. Defaults to 5. */
  maxProposals?: number;
  /** Only propose slots inside these local working hours (0..23, end
   *  exclusive). Interpreted against `timezone`. Defaults to 9–17. */
  workingHours?: { startHour: number; endHour: number };
  /** IANA timezone the working-hours window is evaluated in — defaults UTC. */
  timezone?: string;
}
export interface ProposeTimesOutput {
  /** Open slots, earliest first, each exactly `durationMinutes` long. */
  proposals: { start: string; end: string }[];
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
    connector: OUTLOOK_CALENDAR_CONNECTOR,
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

export const UPDATE_EVENT: WriteActionDescriptor<UpdateEventInput> = {
  action: 'update_event',
  discipline: 'general',
  summarize: (i) => ({
    calendarId: i.calendarId ?? 'primary',
    eventId: i.eventId,
    summary: i.summary ?? null,
    description: i.description ?? null,
    start: i.start ?? null,
    end: i.end ?? null,
    attendees: i.attendees ?? null,
    location: i.location ?? null,
  }),
};

export const CANCEL_EVENT: WriteActionDescriptor<CancelEventInput> = {
  action: 'cancel_event',
  discipline: 'general',
  summarize: (i) => ({
    calendarId: i.calendarId ?? 'primary',
    eventId: i.eventId,
  }),
};
