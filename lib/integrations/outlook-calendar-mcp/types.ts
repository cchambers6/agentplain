/**
 * lib/integrations/outlook-calendar-mcp/types.ts
 *
 * Workspace-scoped Outlook (Microsoft Graph) Calendar MCP server. Mirrors
 * `lib/integrations/google-calendar-mcp/types.ts` so the scheduler skill
 * runs unchanged against either provider through a multiplexer in
 * `lib/skills/scheduler/`.
 *
 * Per `feedback_no_silent_vendor_lock.md`: skill code NEVER hits Microsoft
 * Graph directly. The single seam to `https://graph.microsoft.com/` for
 * calendar lives in `./server.ts`.
 *
 * Per `project_no_outbound_architecture.md`: the mutating tools
 * (`book_meeting`, `reschedule_meeting`, `update_event`, `cancel_event`) are
 * approval-GATED at the factory seam (`./with-approval.ts`) — none reaches
 * Graph's `POST/PATCH/DELETE /me/events` without a recorded operator
 * approval. `listCalendars`, `listEvents`, `getEvent`, `find_availability`
 * (busy blocks from calendarView `showAs`), and `propose_times` are READS
 * and pass through ungated.
 *
 * Per `feedback_runner_portability.md` + two-implementation rule:
 * `ProdOutlookCalendarMcpServer` (Graph-backed) lives in `./server.ts`;
 * `TestOutlookCalendarMcpServer` (fixture-seeded) lives in
 * `./test-server.ts`. Both honor the interface below.
 */

import type {
  BookMeetingInput,
  BookMeetingOutput,
  RescheduleMeetingInput,
  RescheduleMeetingOutput,
  UpdateEventInput,
  UpdateEventOutput,
  CancelEventInput,
  CancelEventOutput,
  FindAvailabilityInput,
  FindAvailabilityOutput,
  ProposeTimesInput,
  ProposeTimesOutput,
} from './actions';

// ── Result + error shapes (mirror gmail-mcp / outlook-mcp) ──────────────

export type OutlookCalendarMcpErrorCode =
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'RATE_LIMITED'
  | 'NETWORK'
  | 'MALFORMED_RESPONSE'
  | 'INVALID_ARGUMENT'
  | 'UPSTREAM_ERROR'
  | 'TOKEN_EXPIRED'
  | 'GRANT_REVOKED'
  | 'CREDENTIAL_NOT_FOUND'
  | 'WORKSPACE_NOT_FOUND'
  // Surfaced by the approval gate (with-approval.ts) when a mutation runs
  // without a recorded grant. In the union so callers can type-narrow on it
  // and route the action to /approvals instead of treating it as an outage.
  | 'APPROVAL_REQUIRED'
  | 'NOT_IMPLEMENTED';

export interface OutlookCalendarMcpError {
  code: OutlookCalendarMcpErrorCode;
  message: string;
  status?: number;
  reference?: string;
}

export type OutlookCalendarMcpResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: OutlookCalendarMcpError };

export function calendarOk<T>(value: T): { ok: true; value: T } {
  return { ok: true, value };
}

export function calendarError(
  code: OutlookCalendarMcpErrorCode,
  message: string,
  extra?: Omit<OutlookCalendarMcpError, 'code' | 'message'>,
): { ok: false; error: OutlookCalendarMcpError } {
  return { ok: false, error: { code, message, ...extra } };
}

// ── Tool input + output DTOs ────────────────────────────────────────────

export interface ListEventsInput {
  /** Inclusive UTC start of the window. Maps to Graph's
   *  `startDateTime` in the `/me/calendarView` query. */
  from: Date;
  /** Exclusive UTC end of the window. Maps to Graph's `endDateTime`. */
  to: Date;
  /** Calendar id to query — defaults to the primary calendar
   *  (`/me/calendarView`). When provided, queries
   *  `/me/calendars/{id}/calendarView`. */
  calendarId?: string;
  /** Cap on returned events. Defaults to 250. Graph clamps at 999 per
   *  page; for our scheduler workload 250 is plenty + cheap. */
  maxResults?: number;
}

export interface ListEventsOutput {
  events: CalendarEventDto[];
}

/**
 * Provider-neutral calendar event. Field-for-field identical to
 * `lib/integrations/google-calendar-mcp/types.ts.CalendarEventDto` so the
 * scheduler multiplexer can compose either provider behind one shape.
 */
export interface CalendarEventDto {
  id: string;
  title: string;
  /** ISO 8601 UTC start. Graph returns `start.dateTime` in the timezone
   *  declared on the resource; the server requests `outlook.timezone="UTC"`
   *  in the `Prefer` header to keep the wire shape uniform. */
  startUtc: string;
  /** ISO 8601 UTC end. */
  endUtc: string;
  /** Graph's `showAs`: free / tentative / busy / oof / workingElsewhere.
   *  We treat anything that isn't `free` as busy. */
  isBusy: boolean;
}

export interface ListCalendarsOutput {
  calendars: CalendarDescriptor[];
}

/** Provider-neutral calendar-list entry (Graph `calendar` resource).
 *  Field-for-field identical to google-calendar-mcp's `CalendarDescriptor`. */
export interface CalendarDescriptor {
  /** Stable calendar id — pass as `calendarId` on the event tools. */
  id: string;
  /** Display name. */
  title: string;
  /** True for the connected account's default calendar. */
  isPrimary: boolean;
  /** Provider access role. Graph exposes `canEdit`; mapped to
   *  `writer` / `reader` so the shape matches the Google connector. */
  accessRole: string;
  /** IANA timezone the calendar renders in. Graph does not report one on
   *  the calendar resource, so always null here. */
  timezone: string | null;
}

export interface GetEventInput {
  eventId: string;
  /** Calendar the event lives on — defaults to the primary calendar. */
  calendarId?: string;
}

export interface GetEventOutput {
  event: CalendarEventDetailDto;
}

/** Full single-event read — the detail shape `getEvent` returns. Extends the
 *  window DTO with the fields an agent needs to draft a reschedule or a
 *  cancellation note without a second lookup. */
export interface CalendarEventDetailDto extends CalendarEventDto {
  description: string | null;
  location: string | null;
  /** Attendee emails with their response status. */
  attendees: { email: string; responseStatus: string | null }[];
  /** Provider deep link for the operator's approval card. */
  htmlLink: string | null;
  /** Provider status (`confirmed` / `tentative` / `cancelled`). */
  status: string | null;
}

// ── MCP resources ──────────────────────────────────────────────────────

export interface ResourceDescriptor {
  /** `outlook-calendar://workspace/{workspaceId}/...` URIs. */
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

export interface ReadResourceInput {
  uri: string;
}

export interface ReadResourceOutput {
  uri: string;
  mimeType: string;
  text: string;
}

// ── Tool name discriminant ─────────────────────────────────────────────

/** Same dotted names as `GOOGLE_CALENDAR_TOOL_NAMES` — the scheduler skill
 *  and any external MCP client see one calendar tool surface regardless of
 *  which provider the workspace connected. */
export const OUTLOOK_CALENDAR_TOOL_NAMES = [
  'calendar.calendars.list',
  'calendar.events.list',
  'calendar.events.get',
  'calendar.events.book',
  'calendar.events.reschedule',
  'calendar.events.update',
  'calendar.events.cancel',
  'calendar.freebusy.query',
  'calendar.slots.propose',
] as const;

export type OutlookCalendarToolName =
  (typeof OUTLOOK_CALENDAR_TOOL_NAMES)[number];

// ── The interface every implementation honors ─────────────────────────

export interface OutlookCalendarMcpServer {
  /** Implementation discriminator — `outlook-calendar` / `outlook-calendar-test`. */
  readonly name: string;
  readonly workspaceId: string;

  // ── Tools ────────────────────────────────────────────────────────────

  /** Enumerate the connected account's calendars. Read-only by contract. */
  listCalendars(): Promise<OutlookCalendarMcpResult<ListCalendarsOutput>>;

  /** List events in the given time window. Read-only by contract. */
  listEvents(
    input: ListEventsInput,
  ): Promise<OutlookCalendarMcpResult<ListEventsOutput>>;

  /** Fetch one event by id, including attendees + description. Read-only. */
  getEvent(
    input: GetEventInput,
  ): Promise<OutlookCalendarMcpResult<GetEventOutput>>;

  /**
   * Free/busy query — a READ. Returns busy intervals across the queried
   * calendars, derived from calendarView `showAs`. Ungated: it reveals no
   * event detail and mutates nothing.
   */
  findAvailability(
    input: FindAvailabilityInput,
  ): Promise<OutlookCalendarMcpResult<FindAvailabilityOutput>>;

  /**
   * Propose open meeting slots — a READ. Computes candidate slots from the
   * free/busy query + working-hours constraints; touches no event.
   */
  proposeTimes(
    input: ProposeTimesInput,
  ): Promise<OutlookCalendarMcpResult<ProposeTimesOutput>>;

  /**
   * Create a calendar event (and invite attendees). MUTATION — approval-GATED
   * at the factory seam; never reaches Graph without a recorded grant.
   */
  bookMeeting(
    input: BookMeetingInput,
  ): Promise<OutlookCalendarMcpResult<BookMeetingOutput>>;

  /**
   * Move an existing event to a new start/end. MUTATION — approval-GATED at
   * the factory seam.
   */
  rescheduleMeeting(
    input: RescheduleMeetingInput,
  ): Promise<OutlookCalendarMcpResult<RescheduleMeetingOutput>>;

  /**
   * General event update (title / description / times / attendees /
   * location). MUTATION — approval-GATED at the factory seam.
   */
  updateEvent(
    input: UpdateEventInput,
  ): Promise<OutlookCalendarMcpResult<UpdateEventOutput>>;

  /**
   * Cancel an event (DELETE /me/events — Graph sends cancellations to
   * attendees for meetings the account organizes). MUTATION — approval-GATED
   * at the factory seam.
   */
  cancelEvent(
    input: CancelEventInput,
  ): Promise<OutlookCalendarMcpResult<CancelEventOutput>>;

  // ── Resources ────────────────────────────────────────────────────────

  listResources(): Promise<OutlookCalendarMcpResult<ResourceDescriptor[]>>;
  readResource(
    input: ReadResourceInput,
  ): Promise<OutlookCalendarMcpResult<ReadResourceOutput>>;
}
