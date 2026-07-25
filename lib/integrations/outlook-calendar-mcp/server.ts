/**
 * lib/integrations/outlook-calendar-mcp/server.ts
 *
 * Production Outlook Calendar MCP server. Wraps Microsoft Graph's
 * `/me/calendarView`, `/me/calendars`, and `/me/events` behind the
 * `OutlookCalendarMcpServer` interface. Mirrors the structure of
 * `lib/integrations/outlook-mcp/server.ts` so the seam to Graph is
 * narrow and consistent.
 *
 * Per `feedback_no_silent_vendor_lock.md`: this file is the SOLE seam in
 * the outlook-calendar-mcp folder that hits `https://graph.microsoft.com/`.
 * Skill code, route handlers, and cron functions speak the MCP interface
 * only. We use raw `fetch` to avoid pulling
 * `@microsoft/microsoft-graph-client` into the dependency surface — the
 * same posture outlook-mcp/server.ts takes.
 *
 * Per `project_no_outbound_architecture.md`: every mutation on this surface
 * (`bookMeeting`, `rescheduleMeeting`, `updateEvent`, `cancelEvent`) is
 * approval-gated at the factory seam — the Graph calls below never run
 * without a recorded operator approval. The reads (`listCalendars`,
 * `listEvents`, `getEvent`, `findAvailability`, `proposeTimes`) pass
 * through ungated.
 *
 * Free/busy note: Graph's `getSchedule` endpoint keys on SMTP addresses,
 * not calendar ids — the wrong shape for our provider-neutral
 * `findAvailability(calendarIds)` contract. Busy intervals here derive from
 * `calendarView` events with a non-`free` `showAs`, which `Calendars.Read`
 * already covers and which matches what the Google connector's freebusy
 * query returns.
 *
 * Per `feedback_cold_start_safe_agents.md`: every method re-resolves the
 * credential through the outlook-mcp auth resolver.
 */

import { resolveCredential } from './auth';
import type { DecryptedCredential } from '@/lib/integrations/types';
import {
  type CalendarDescriptor,
  type CalendarEventDetailDto,
  type CalendarEventDto,
  type GetEventInput,
  type GetEventOutput,
  type ListCalendarsOutput,
  type OutlookCalendarMcpError,
  type OutlookCalendarMcpResult,
  type OutlookCalendarMcpServer,
  type ListEventsInput,
  type ListEventsOutput,
  type ReadResourceInput,
  type ReadResourceOutput,
  type ResourceDescriptor,
  calendarError,
  calendarOk,
} from './types';
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
import { computeProposals, validateProposeTimesInput } from './propose-times';

const DEFAULT_MAX_RESULTS = 250;
const MAX_PAGE_SIZE = 999;
const GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0';
const RESOURCE_URI_WINDOW_RE =
  /^outlook-calendar:\/\/workspace\/([0-9a-f-]+)\/events\?from=([^&]+)&to=([^&]+)$/i;

interface GraphEventDateTime {
  dateTime?: string;
  timeZone?: string;
}

interface GraphEvent {
  id?: string;
  subject?: string;
  start?: GraphEventDateTime;
  end?: GraphEventDateTime;
  showAs?: 'free' | 'tentative' | 'busy' | 'oof' | 'workingElsewhere' | 'unknown';
  isCancelled?: boolean;
}

interface GraphEventDetail extends GraphEvent {
  bodyPreview?: string;
  location?: { displayName?: string };
  attendees?: {
    emailAddress?: { address?: string };
    status?: { response?: string };
  }[];
  webLink?: string;
}

interface GraphCalendar {
  id?: string;
  name?: string;
  isDefaultCalendar?: boolean;
  canEdit?: boolean;
}

interface GraphListResponse<T> {
  value?: T[];
  '@odata.nextLink'?: string;
}

interface GraphErrorBody {
  error?: {
    code?: string;
    message?: string;
  };
}

export class ProdOutlookCalendarMcpServer implements OutlookCalendarMcpServer {
  readonly name = 'outlook-calendar' as const;
  readonly workspaceId: string;
  private readonly fetchImpl: typeof fetch;

  constructor(args: { workspaceId: string; fetchImpl?: typeof fetch }) {
    if (!args.workspaceId) {
      throw new Error('ProdOutlookCalendarMcpServer: workspaceId is required');
    }
    this.workspaceId = args.workspaceId;
    this.fetchImpl = args.fetchImpl ?? fetch;
  }

  // ── Read tools ───────────────────────────────────────────────────────

  async listCalendars(): Promise<OutlookCalendarMcpResult<ListCalendarsOutput>> {
    return this.withCredential(async (cred) => {
      const params = new URLSearchParams({
        $top: '250',
        $select: 'id,name,isDefaultCalendar,canEdit',
      });
      const url = `${GRAPH_BASE_URL}/me/calendars?${params.toString()}`;
      const res = await this.graphRequest<GraphListResponse<GraphCalendar>>(cred, 'GET', url);
      if (!res.ok) return res;
      const calendars: CalendarDescriptor[] = (res.value?.value ?? [])
        .filter((c) => Boolean(c.id))
        .map((c) => ({
          id: c.id ?? '',
          title: c.name ?? '(untitled calendar)',
          isPrimary: c.isDefaultCalendar === true,
          // Graph exposes edit rights as a boolean; map onto the same
          // role vocabulary the Google connector reports.
          accessRole: c.canEdit === true ? 'writer' : 'reader',
          timezone: null,
        }));
      return calendarOk({ calendars });
    });
  }

  async listEvents(
    input: ListEventsInput,
  ): Promise<OutlookCalendarMcpResult<ListEventsOutput>> {
    const validation = validateListInput(input);
    if (!validation.ok) return validation;
    const { from, to, calendarId, maxResults } = validation.value;

    return this.withCredential(async (cred) => {
      // Graph's `calendarView` endpoint expands recurring events for the
      // given window — exactly what the scheduler needs. We deliberately
      // pin the wire timezone to UTC so the parser doesn't need to do tz
      // math; the `Prefer: outlook.timezone="UTC"` header does this.
      const params = new URLSearchParams({
        startDateTime: from.toISOString(),
        endDateTime: to.toISOString(),
        $top: String(maxResults),
        $select: 'id,subject,start,end,showAs,isCancelled',
        $orderby: 'start/dateTime',
      });
      const path = calendarId
        ? `/me/calendars/${encodeURIComponent(calendarId)}/calendarView`
        : '/me/calendarView';
      const url = `${GRAPH_BASE_URL}${path}?${params.toString()}`;
      const res = await this.graphRequest<GraphListResponse<GraphEvent>>(cred, 'GET', url);
      if (!res.ok) return res;
      const events: CalendarEventDto[] = (res.value?.value ?? [])
        .map(parseGraphEvent)
        .filter((e): e is CalendarEventDto => e !== null);
      return calendarOk({ events });
    });
  }

  async getEvent(
    input: GetEventInput,
  ): Promise<OutlookCalendarMcpResult<GetEventOutput>> {
    if (!input.eventId?.trim()) {
      return calendarError('INVALID_ARGUMENT', 'getEvent requires an eventId');
    }
    return this.withCredential(async (cred) => {
      const params = new URLSearchParams({
        $select:
          'id,subject,start,end,showAs,isCancelled,bodyPreview,location,attendees,webLink',
      });
      const url = `${GRAPH_BASE_URL}${eventPath(input.calendarId, input.eventId)}?${params.toString()}`;
      const res = await this.graphRequest<GraphEventDetail>(cred, 'GET', url);
      if (!res.ok) return res;
      const detail = parseGraphEventDetail(res.value ?? {});
      if (!detail) {
        return calendarError(
          'MALFORMED_RESPONSE',
          'Graph /me/events returned an event without id or a discrete time window',
        );
      }
      return calendarOk({ event: detail });
    });
  }

  async findAvailability(
    input: FindAvailabilityInput,
  ): Promise<OutlookCalendarMcpResult<FindAvailabilityOutput>> {
    const timeMin = new Date(input.timeMin);
    const timeMax = new Date(input.timeMax);
    if (Number.isNaN(timeMin.getTime()) || Number.isNaN(timeMax.getTime())) {
      return calendarError(
        'INVALID_ARGUMENT',
        'findAvailability requires ISO 8601 timeMin + timeMax',
      );
    }
    if (timeMax.getTime() <= timeMin.getTime()) {
      return calendarError(
        'INVALID_ARGUMENT',
        'findAvailability requires timeMax strictly after timeMin',
      );
    }
    // `undefined` = the primary calendar (`/me/calendarView`).
    const calendarIds: (string | undefined)[] =
      input.calendarIds && input.calendarIds.length > 0
        ? input.calendarIds
        : [undefined];
    const busy: { start: string; end: string }[] = [];
    for (const calendarId of calendarIds) {
      const events = await this.listEvents({
        from: timeMin,
        to: timeMax,
        calendarId,
        maxResults: MAX_PAGE_SIZE,
      });
      if (!events.ok) return events;
      for (const e of events.value.events) {
        if (e.isBusy) busy.push({ start: e.startUtc, end: e.endUtc });
      }
    }
    busy.sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
    return calendarOk({ busy });
  }

  async proposeTimes(
    input: ProposeTimesInput,
  ): Promise<OutlookCalendarMcpResult<ProposeTimesOutput>> {
    const validated = validateProposeTimesInput(input);
    if (!validated.ok) return validated;
    // One free/busy READ; the slot arithmetic is the shared vendor-neutral
    // computation (lib/integrations/scheduling/propose-times.ts) so Outlook
    // proposes exactly like Google — and like both fixture servers.
    const availability = await this.findAvailability({
      timeMin: input.timeMin,
      timeMax: input.timeMax,
      calendarIds: input.calendarIds,
    });
    if (!availability.ok) return availability;
    return calendarOk({
      proposals: computeProposals(validated.value, availability.value.busy),
    });
  }

  // ── Write tools (approval-gated at the factory seam) ─────────────────

  async bookMeeting(
    input: BookMeetingInput,
  ): Promise<OutlookCalendarMcpResult<BookMeetingOutput>> {
    if (!input.summary?.trim()) {
      return calendarError('INVALID_ARGUMENT', 'bookMeeting requires a summary');
    }
    const start = new Date(input.start);
    const end = new Date(input.end);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return calendarError('INVALID_ARGUMENT', 'bookMeeting requires ISO 8601 start + end');
    }
    if (end.getTime() <= start.getTime()) {
      return calendarError('INVALID_ARGUMENT', 'bookMeeting requires end strictly after start');
    }
    return this.withCredential(async (cred) => {
      const path = input.calendarId?.trim()
        ? `/me/calendars/${encodeURIComponent(input.calendarId.trim())}/events`
        : '/me/events';
      const res = await this.graphRequest<GraphEventDetail>(
        cred,
        'POST',
        `${GRAPH_BASE_URL}${path}`,
        {
          subject: input.summary,
          start: { dateTime: start.toISOString(), timeZone: 'UTC' },
          end: { dateTime: end.toISOString(), timeZone: 'UTC' },
          ...(input.description !== undefined
            ? { body: { contentType: 'text', content: input.description } }
            : {}),
          ...(input.attendees && input.attendees.length > 0
            ? {
                attendees: input.attendees.map((email) => ({
                  emailAddress: { address: email },
                  type: 'required',
                })),
              }
            : {}),
        },
      );
      if (!res.ok) return res;
      if (!res.value?.id) {
        return calendarError('MALFORMED_RESPONSE', 'Graph POST /me/events returned no event id');
      }
      return calendarOk({
        eventId: res.value.id,
        htmlLink: res.value.webLink ?? undefined,
      });
    });
  }

  async rescheduleMeeting(
    input: RescheduleMeetingInput,
  ): Promise<OutlookCalendarMcpResult<RescheduleMeetingOutput>> {
    if (!input.eventId?.trim()) {
      return calendarError('INVALID_ARGUMENT', 'rescheduleMeeting requires an eventId');
    }
    const start = new Date(input.start);
    const end = new Date(input.end);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return calendarError(
        'INVALID_ARGUMENT',
        'rescheduleMeeting requires ISO 8601 start + end',
      );
    }
    if (end.getTime() <= start.getTime()) {
      return calendarError(
        'INVALID_ARGUMENT',
        'rescheduleMeeting requires end strictly after start',
      );
    }
    return this.withCredential(async (cred) => {
      const res = await this.graphRequest<GraphEventDetail>(
        cred,
        'PATCH',
        `${GRAPH_BASE_URL}${eventPath(input.calendarId, input.eventId)}`,
        {
          start: { dateTime: start.toISOString(), timeZone: 'UTC' },
          end: { dateTime: end.toISOString(), timeZone: 'UTC' },
        },
      );
      if (!res.ok) return res;
      if (!res.value?.id) {
        return calendarError('MALFORMED_RESPONSE', 'Graph PATCH /me/events returned no event id');
      }
      return calendarOk({ eventId: res.value.id });
    });
  }

  async updateEvent(
    input: UpdateEventInput,
  ): Promise<OutlookCalendarMcpResult<UpdateEventOutput>> {
    if (!input.eventId?.trim()) {
      return calendarError('INVALID_ARGUMENT', 'updateEvent requires an eventId');
    }
    const hasStart = input.start !== undefined;
    const hasEnd = input.end !== undefined;
    if (hasStart !== hasEnd) {
      return calendarError(
        'INVALID_ARGUMENT',
        'updateEvent requires start and end together (or neither)',
      );
    }
    let start: Date | undefined;
    let end: Date | undefined;
    if (hasStart && hasEnd) {
      start = new Date(input.start as string);
      end = new Date(input.end as string);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return calendarError('INVALID_ARGUMENT', 'updateEvent requires ISO 8601 start + end');
      }
      if (end.getTime() <= start.getTime()) {
        return calendarError('INVALID_ARGUMENT', 'updateEvent requires end strictly after start');
      }
    }
    if (
      input.summary === undefined &&
      input.description === undefined &&
      input.attendees === undefined &&
      input.location === undefined &&
      !hasStart
    ) {
      return calendarError('INVALID_ARGUMENT', 'updateEvent requires at least one field to change');
    }
    return this.withCredential(async (cred) => {
      const res = await this.graphRequest<GraphEventDetail>(
        cred,
        'PATCH',
        `${GRAPH_BASE_URL}${eventPath(input.calendarId, input.eventId)}`,
        {
          ...(input.summary !== undefined ? { subject: input.summary } : {}),
          ...(input.description !== undefined
            ? { body: { contentType: 'text', content: input.description } }
            : {}),
          ...(input.location !== undefined
            ? { location: { displayName: input.location } }
            : {}),
          ...(start && end
            ? {
                start: { dateTime: start.toISOString(), timeZone: 'UTC' },
                end: { dateTime: end.toISOString(), timeZone: 'UTC' },
              }
            : {}),
          ...(input.attendees !== undefined
            ? {
                attendees: input.attendees.map((email) => ({
                  emailAddress: { address: email },
                  type: 'required',
                })),
              }
            : {}),
        },
      );
      if (!res.ok) return res;
      if (!res.value?.id) {
        return calendarError('MALFORMED_RESPONSE', 'Graph PATCH /me/events returned no event id');
      }
      return calendarOk({
        eventId: res.value.id,
        htmlLink: res.value.webLink ?? undefined,
      });
    });
  }

  async cancelEvent(
    input: CancelEventInput,
  ): Promise<OutlookCalendarMcpResult<CancelEventOutput>> {
    if (!input.eventId?.trim()) {
      return calendarError('INVALID_ARGUMENT', 'cancelEvent requires an eventId');
    }
    return this.withCredential(async (cred) => {
      // Graph answers 204 No Content on success and sends cancellations to
      // attendees for meetings the connected account organizes.
      const res = await this.graphRequest<null>(
        cred,
        'DELETE',
        `${GRAPH_BASE_URL}${eventPath(input.calendarId, input.eventId)}`,
      );
      if (!res.ok) return res;
      return calendarOk({ eventId: input.eventId, cancelled: true as const });
    });
  }

  // ── Resources ────────────────────────────────────────────────────────

  async listResources(): Promise<
    OutlookCalendarMcpResult<ResourceDescriptor[]>
  > {
    return calendarOk([
      {
        uri: `outlook-calendar://workspace/${this.workspaceId}/events`,
        name: 'Calendar events',
        description:
          "Read-only view of the workspace's connected Outlook calendar. Pass `?from=…&to=…` (ISO 8601) to scope the window.",
        mimeType: 'application/json',
      },
    ]);
  }

  async readResource(
    input: ReadResourceInput,
  ): Promise<OutlookCalendarMcpResult<ReadResourceOutput>> {
    const match = input.uri.match(RESOURCE_URI_WINDOW_RE);
    if (!match) {
      return calendarError(
        'INVALID_ARGUMENT',
        `Unknown resource URI: ${input.uri}. Expected outlook-calendar://workspace/{workspaceId}/events?from={iso}&to={iso}.`,
      );
    }
    const workspaceId = match[1];
    if (workspaceId !== this.workspaceId) {
      return calendarError(
        'FORBIDDEN',
        `Resource workspace ${workspaceId} does not match server workspace ${this.workspaceId}`,
      );
    }
    const from = new Date(decodeURIComponent(match[2]));
    const to = new Date(decodeURIComponent(match[3]));
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return calendarError(
        'INVALID_ARGUMENT',
        'from / to must be ISO 8601 timestamps',
      );
    }
    const list = await this.listEvents({ from, to });
    if (!list.ok) return list;
    return calendarOk({
      uri: input.uri,
      mimeType: 'application/json',
      text: JSON.stringify(list.value),
    });
  }

  // ── internals ────────────────────────────────────────────────────────

  private async withCredential<T>(
    fn: (credential: DecryptedCredential) => Promise<OutlookCalendarMcpResult<T>>,
  ): Promise<OutlookCalendarMcpResult<T>> {
    const resolved = await resolveCredential({ workspaceId: this.workspaceId });
    if (!resolved.ok) return resolved;
    return fn(resolved.value);
  }

  private async graphRequest<T>(
    cred: DecryptedCredential,
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    url: string,
    body?: unknown,
  ): Promise<OutlookCalendarMcpResult<T | null>> {
    const headers = new Headers();
    headers.set('Authorization', `Bearer ${cred.accessToken}`);
    headers.set('Accept', 'application/json');
    headers.set('Prefer', 'outlook.timezone="UTC"');
    if (body !== undefined) {
      headers.set('Content-Type', 'application/json');
    }
    let res: Response;
    try {
      res = await this.fetchImpl(url, {
        method,
        headers,
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return calendarError(
        'NETWORK',
        `Microsoft Graph network error: ${message}`,
      );
    }
    let parsed: unknown = null;
    const text = await res.text();
    if (text.length > 0) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = null;
      }
    }
    if (!res.ok) {
      return mapGraphError(res.status, parsed);
    }
    return calendarOk(parsed as T | null);
  }
}

// ── helpers ─────────────────────────────────────────────────────────────

/** Graph path for one event — primary (`/me/events/{id}`) or a named
 *  calendar (`/me/calendars/{cid}/events/{id}`). */
function eventPath(calendarId: string | undefined, eventId: string): string {
  const eid = encodeURIComponent(eventId);
  const cid = calendarId?.trim();
  return cid
    ? `/me/calendars/${encodeURIComponent(cid)}/events/${eid}`
    : `/me/events/${eid}`;
}

interface ValidatedInput {
  from: Date;
  to: Date;
  calendarId: string | null;
  maxResults: number;
}

function validateListInput(
  input: ListEventsInput,
): OutlookCalendarMcpResult<ValidatedInput> {
  if (!(input.from instanceof Date) || Number.isNaN(input.from.getTime())) {
    return calendarError('INVALID_ARGUMENT', 'listEvents requires `from` Date');
  }
  if (!(input.to instanceof Date) || Number.isNaN(input.to.getTime())) {
    return calendarError('INVALID_ARGUMENT', 'listEvents requires `to` Date');
  }
  if (input.to.getTime() <= input.from.getTime()) {
    return calendarError(
      'INVALID_ARGUMENT',
      'listEvents requires `to` strictly after `from`',
    );
  }
  const calendarId = input.calendarId?.trim() || null;
  let maxResults = input.maxResults ?? DEFAULT_MAX_RESULTS;
  if (!Number.isInteger(maxResults) || maxResults <= 0) {
    return calendarError(
      'INVALID_ARGUMENT',
      `maxResults must be a positive integer, got ${maxResults}`,
    );
  }
  if (maxResults > MAX_PAGE_SIZE) {
    return calendarError(
      'INVALID_ARGUMENT',
      `maxResults must be <= ${MAX_PAGE_SIZE}, got ${maxResults}`,
    );
  }
  return calendarOk({
    from: input.from,
    to: input.to,
    calendarId,
    maxResults,
  });
}

function mapGraphError(
  status: number,
  body: unknown,
): { ok: false; error: OutlookCalendarMcpError } {
  const errBody = (body as GraphErrorBody | null)?.error;
  const reference = errBody?.code ?? `http_${status}`;
  const message = errBody?.message ?? `Microsoft Graph returned HTTP ${status}`;
  if (status === 401) return calendarError('TOKEN_EXPIRED', message, { status, reference });
  if (status === 403) return calendarError('FORBIDDEN', message, { status, reference });
  if (status === 404) return calendarError('NOT_FOUND', message, { status, reference });
  if (status === 429) return calendarError('RATE_LIMITED', message, { status, reference });
  if (status >= 500) return calendarError('UPSTREAM_ERROR', message, { status, reference });
  if (status === 400) return calendarError('INVALID_ARGUMENT', message, { status, reference });
  return calendarError('UPSTREAM_ERROR', message, { status, reference });
}

export function parseGraphEvent(evt: GraphEvent): CalendarEventDto | null {
  if (!evt.id) return null;
  if (evt.isCancelled === true) return null;
  const startIso = readIsoInstant(evt.start);
  const endIso = readIsoInstant(evt.end);
  if (!startIso || !endIso) return null;
  const showAs = evt.showAs ?? 'busy';
  return {
    id: evt.id,
    title: evt.subject ?? '(untitled event)',
    startUtc: startIso,
    endUtc: endIso,
    isBusy: showAs !== 'free',
  };
}

export function parseGraphEventDetail(
  evt: GraphEventDetail,
): CalendarEventDetailDto | null {
  // A cancelled event still parses here — `getEvent` reports it with
  // `status: 'cancelled'` so an agent can explain WHY a slot opened up,
  // whereas the window list (`parseGraphEvent`) drops cancelled rows.
  if (!evt.id) return null;
  const startIso = readIsoInstant(evt.start);
  const endIso = readIsoInstant(evt.end);
  if (!startIso || !endIso) return null;
  const showAs = evt.showAs ?? 'busy';
  return {
    id: evt.id,
    title: evt.subject ?? '(untitled event)',
    startUtc: startIso,
    endUtc: endIso,
    isBusy: showAs !== 'free',
    description: evt.bodyPreview?.trim() ? evt.bodyPreview : null,
    location: evt.location?.displayName?.trim() ? evt.location.displayName : null,
    attendees: (evt.attendees ?? [])
      .map((a) => ({
        email: a.emailAddress?.address ?? '',
        responseStatus: a.status?.response ?? null,
      }))
      .filter((a) => a.email.length > 0),
    htmlLink: evt.webLink ?? null,
    status: evt.isCancelled === true ? 'cancelled' : 'confirmed',
  };
}

function readIsoInstant(
  endpoint: GraphEventDateTime | undefined,
): string | null {
  if (!endpoint || typeof endpoint.dateTime !== 'string') return null;
  // Graph returns `2026-05-28T15:00:00.0000000` (no trailing Z) but the
  // `outlook.timezone="UTC"` Prefer header pins the value to UTC. Append
  // `Z` if no offset is present so `new Date(...)` parses as UTC.
  const raw = endpoint.dateTime;
  const isoish = /[zZ]|[+-]\d{2}:?\d{2}$/.test(raw) ? raw : `${raw}Z`;
  const d = new Date(isoish);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}
