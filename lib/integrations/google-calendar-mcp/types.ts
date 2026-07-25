/**
 * lib/integrations/google-calendar-mcp/types.ts
 *
 * Workspace-scoped Google Calendar MCP server. Mirrors the shape of
 * `lib/integrations/gmail-mcp/types.ts` so the scheduler skill speaks
 * one interface family across providers (Gmail-MCP for inbox, Google-
 * Calendar-MCP for the calendar source). The pair sits behind the
 * `ChiefOfStaffFetcher` port in `lib/skills/chief-of-staff-scheduler`.
 *
 * Per `feedback_no_silent_vendor_lock.md`: skills NEVER import
 * `googleapis` directly. The single seam to Google's Calendar API lives
 * in `./server.ts`. Skill code, route handlers, and cron functions speak
 * the `GoogleCalendarMcpServer` interface only.
 *
 * Per `project_no_outbound_architecture.md`: the mutating tools
 * (`book_meeting`, `reschedule_meeting`, `update_event`, `cancel_event`) are
 * approval-GATED at the factory seam (`./with-approval.ts`) — none reaches
 * Google's `events.insert` / `events.patch` / `events.delete` without a
 * recorded operator approval. `listCalendars`, `listEvents`, `getEvent`,
 * `find_availability` (free/busy), and `propose_times` are READS and pass
 * through ungated.
 *
 * Per `feedback_runner_portability.md` + two-implementation rule:
 * `ProdGoogleCalendarMcpServer` (Google-backed) lands in `./server.ts`;
 * `TestGoogleCalendarMcpServer` (fixture-seeded) lands in
 * `./test-server.ts`. Both honor the interface below.
 *
 * Per `feedback_cold_start_safe_agents.md`: every method re-resolves the
 * underlying credential. No decrypted access token lives on the instance.
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

// ── Result + error shapes (mirror gmail-mcp) ────────────────────────────

export type GoogleCalendarMcpErrorCode =
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

export interface GoogleCalendarMcpError {
  code: GoogleCalendarMcpErrorCode;
  message: string;
  status?: number;
  reference?: string;
}

export type GoogleCalendarMcpResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: GoogleCalendarMcpError };

export function calendarOk<T>(value: T): { ok: true; value: T } {
  return { ok: true, value };
}

export function calendarError(
  code: GoogleCalendarMcpErrorCode,
  message: string,
  extra?: Omit<GoogleCalendarMcpError, 'code' | 'message'>,
): { ok: false; error: GoogleCalendarMcpError } {
  return { ok: false, error: { code, message, ...extra } };
}

// ── Tool input + output DTOs ────────────────────────────────────────────

export interface ListEventsInput {
  /** Inclusive UTC start of the lookahead window. Maps to Google's
   *  `timeMin`. */
  from: Date;
  /** Exclusive UTC end of the lookahead window. Maps to Google's
   *  `timeMax`. */
  to: Date;
  /** Calendar id to query — defaults to `primary` (the connected
   *  account's primary calendar). */
  calendarId?: string;
  /** Cap on returned events. Defaults to 250. Google's max page size is
   *  2500 but for our scheduler workload 250 is plenty + cheap. */
  maxResults?: number;
}

export interface ListEventsOutput {
  events: CalendarEventDto[];
}

/**
 * Provider-neutral calendar event. Mirrors
 * `lib/skills/chief-of-staff-scheduler/types.ts.CalendarEvent` one-for-one
 * but with `startUtc`/`endUtc` as ISO strings (JSON-friendly across the
 * MCP boundary). The fetcher in `lib/skills/scheduler/` hydrates the
 * strings to `Date` before handing the snapshot to the skill.
 */
export interface CalendarEventDto {
  /** Stable provider event id (Google `Event.id`). */
  id: string;
  /** Event title — used to label the slot in the proposal context. */
  title: string;
  /** ISO 8601 UTC start instant. */
  startUtc: string;
  /** ISO 8601 UTC end instant. */
  endUtc: string;
  /** True when the calendar owner has marked this event as busy /
   *  opaque. Google's `transparency` field maps as `transparent` →
   *  free, anything else → busy. */
  isBusy: boolean;
}

export interface ListCalendarsOutput {
  calendars: CalendarDescriptor[];
}

/** Provider-neutral calendar-list entry (Google `CalendarListEntry`). */
export interface CalendarDescriptor {
  /** Stable calendar id — pass as `calendarId` on the event tools. */
  id: string;
  /** Display name. */
  title: string;
  /** True for the connected account's primary calendar. */
  isPrimary: boolean;
  /** Provider access role (`owner` / `writer` / `reader` / `freeBusyReader`). */
  accessRole: string;
  /** IANA timezone the calendar renders in, when the provider reports one. */
  timezone: string | null;
}

export interface GetEventInput {
  eventId: string;
  /** Calendar the event lives on — defaults to `primary`. */
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
  /** `google-calendar://workspace/{workspaceId}/...` URIs. */
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

export const GOOGLE_CALENDAR_TOOL_NAMES = [
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

export type GoogleCalendarToolName =
  (typeof GOOGLE_CALENDAR_TOOL_NAMES)[number];

// ── The interface every implementation honors ─────────────────────────

export interface GoogleCalendarMcpServer {
  /** Implementation discriminator — `google-calendar` / `google-calendar-test`. */
  readonly name: string;
  /** Workspace this server instance is scoped to. */
  readonly workspaceId: string;

  // ── Tools ────────────────────────────────────────────────────────────

  /** Enumerate the connected account's calendars. Read-only by contract. */
  listCalendars(): Promise<GoogleCalendarMcpResult<ListCalendarsOutput>>;

  /** List events in the given time window. Read-only by contract. */
  listEvents(
    input: ListEventsInput,
  ): Promise<GoogleCalendarMcpResult<ListEventsOutput>>;

  /** Fetch one event by id, including attendees + description. Read-only. */
  getEvent(
    input: GetEventInput,
  ): Promise<GoogleCalendarMcpResult<GetEventOutput>>;

  /**
   * Free/busy query — a READ. Returns busy intervals across the queried
   * calendars. Ungated: it reveals no event detail and mutates nothing.
   */
  findAvailability(
    input: FindAvailabilityInput,
  ): Promise<GoogleCalendarMcpResult<FindAvailabilityOutput>>;

  /**
   * Propose open meeting slots — a READ. Computes candidate slots from the
   * free/busy query + working-hours constraints; touches no event.
   */
  proposeTimes(
    input: ProposeTimesInput,
  ): Promise<GoogleCalendarMcpResult<ProposeTimesOutput>>;

  /**
   * Create a calendar event (and invite attendees). MUTATION — approval-GATED
   * at the factory seam; never reaches Google without a recorded grant.
   */
  bookMeeting(
    input: BookMeetingInput,
  ): Promise<GoogleCalendarMcpResult<BookMeetingOutput>>;

  /**
   * Move an existing event's start/end. MUTATION — approval-GATED at the
   * factory seam; never reaches Google without a recorded grant.
   */
  rescheduleMeeting(
    input: RescheduleMeetingInput,
  ): Promise<GoogleCalendarMcpResult<RescheduleMeetingOutput>>;

  /**
   * General event update (title / description / times / attendees /
   * location). MUTATION — approval-GATED at the factory seam.
   */
  updateEvent(
    input: UpdateEventInput,
  ): Promise<GoogleCalendarMcpResult<UpdateEventOutput>>;

  /**
   * Cancel an event (events.delete — Google notifies attendees). MUTATION —
   * approval-GATED at the factory seam.
   */
  cancelEvent(
    input: CancelEventInput,
  ): Promise<GoogleCalendarMcpResult<CancelEventOutput>>;

  // ── Resources ────────────────────────────────────────────────────────

  listResources(): Promise<GoogleCalendarMcpResult<ResourceDescriptor[]>>;
  readResource(
    input: ReadResourceInput,
  ): Promise<GoogleCalendarMcpResult<ReadResourceOutput>>;
}
