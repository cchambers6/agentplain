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
 * Per `project_no_outbound_architecture.md`: the tool surface is READ
 * ONLY. No event create / update / delete. The scheduler proposes; the
 * customer's calendar performs the booking.
 *
 * Per `feedback_runner_portability.md` + two-implementation rule:
 * `ProdOutlookCalendarMcpServer` (Graph-backed) lives in `./server.ts`;
 * `TestOutlookCalendarMcpServer` (fixture-seeded) lives in
 * `./test-server.ts`. Both honor the interface below.
 */

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

export const OUTLOOK_CALENDAR_TOOL_NAMES = [
  'calendar.events.list',
] as const;

export type OutlookCalendarToolName =
  (typeof OUTLOOK_CALENDAR_TOOL_NAMES)[number];

// ── The interface every implementation honors ─────────────────────────

export interface OutlookCalendarMcpServer {
  /** Implementation discriminator — `outlook-calendar` / `outlook-calendar-test`. */
  readonly name: string;
  readonly workspaceId: string;

  listEvents(
    input: ListEventsInput,
  ): Promise<OutlookCalendarMcpResult<ListEventsOutput>>;

  listResources(): Promise<OutlookCalendarMcpResult<ResourceDescriptor[]>>;
  readResource(
    input: ReadResourceInput,
  ): Promise<OutlookCalendarMcpResult<ReadResourceOutput>>;
}
