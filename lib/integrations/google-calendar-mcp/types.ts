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
 * Per `project_no_outbound_architecture.md`: the tool surface is READ
 * ONLY. There is no `events.insert` / `events.update` / `events.delete`
 * tool. The scheduler proposes slots; the customer's calendar performs
 * the booking out of their own UI after operator approval.
 *
 * Per `feedback_runner_portability.md` + two-implementation rule:
 * `ProdGoogleCalendarMcpServer` (Google-backed) lands in `./server.ts`;
 * `TestGoogleCalendarMcpServer` (fixture-seeded) lands in
 * `./test-server.ts`. Both honor the interface below.
 *
 * Per `feedback_cold_start_safe_agents.md`: every method re-resolves the
 * underlying credential. No decrypted access token lives on the instance.
 */

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
  'calendar.events.list',
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

  /** List events in the given time window. Read-only by contract. */
  listEvents(
    input: ListEventsInput,
  ): Promise<GoogleCalendarMcpResult<ListEventsOutput>>;

  // ── Resources ────────────────────────────────────────────────────────

  listResources(): Promise<GoogleCalendarMcpResult<ResourceDescriptor[]>>;
  readResource(
    input: ReadResourceInput,
  ): Promise<GoogleCalendarMcpResult<ReadResourceOutput>>;
}
