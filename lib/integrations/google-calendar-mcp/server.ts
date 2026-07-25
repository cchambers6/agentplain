/**
 * lib/integrations/google-calendar-mcp/server.ts
 *
 * Production Google Calendar MCP server. Wraps the Google Calendar REST
 * API behind `GoogleCalendarMcpServer`. One instance is constructed per
 * `{workspaceId}` per request; never reused across workspaces.
 *
 * Per `feedback_no_silent_vendor_lock.md`: this file is one of the
 * allowed seams that import `googleapis` (alongside the existing
 * `lib/integrations/google/`, `lib/integrations/gmail-mcp/server.ts`,
 * and `lib/skills/gmail-fetcher.ts`). Skill code, route handlers, and
 * cron functions speak the MCP interface only.
 *
 * Per `project_no_outbound_architecture.md`: every mutation on this surface
 * (`bookMeeting`, `rescheduleMeeting`, `updateEvent`, `cancelEvent`) is
 * approval-gated at the factory seam — the SDK calls below never run without
 * a recorded operator approval. The reads (`listCalendars`, `listEvents`,
 * `getEvent`, `findAvailability`, `proposeTimes`) pass through ungated.
 *
 * Per `feedback_cold_start_safe_agents.md`: `withClient` re-resolves the
 * credential on every call. No decrypted token lives on the instance.
 */

import { google, type calendar_v3 } from 'googleapis';
import { resolveCredential } from './auth';
import type { DecryptedCredential } from '@/lib/integrations/types';
import {
  type CalendarDescriptor,
  type CalendarEventDetailDto,
  type CalendarEventDto,
  type GetEventInput,
  type GetEventOutput,
  type GoogleCalendarMcpResult,
  type GoogleCalendarMcpServer,
  type ListCalendarsOutput,
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
const MAX_PAGE_SIZE = 2500;
const RESOURCE_URI_WINDOW_RE =
  /^google-calendar:\/\/workspace\/([0-9a-f-]+)\/events\?from=([^&]+)&to=([^&]+)$/i;

export class ProdGoogleCalendarMcpServer implements GoogleCalendarMcpServer {
  readonly name = 'google-calendar' as const;
  readonly workspaceId: string;

  constructor(args: { workspaceId: string }) {
    if (!args.workspaceId) {
      throw new Error('ProdGoogleCalendarMcpServer: workspaceId is required');
    }
    this.workspaceId = args.workspaceId;
  }

  // ── Tools ────────────────────────────────────────────────────────────

  async listCalendars(): Promise<GoogleCalendarMcpResult<ListCalendarsOutput>> {
    return this.withClient(async (client) => {
      try {
        const res = await client.calendarList.list({ maxResults: 250 });
        const calendars: CalendarDescriptor[] = (res.data.items ?? [])
          .filter((c) => Boolean(c.id))
          .map((c) => ({
            id: c.id ?? '',
            title: c.summaryOverride ?? c.summary ?? '(untitled calendar)',
            isPrimary: c.primary === true,
            accessRole: c.accessRole ?? 'reader',
            timezone: c.timeZone ?? null,
          }));
        return calendarOk({ calendars });
      } catch (err) {
        return mapGoogleApiError(err);
      }
    });
  }

  async listEvents(
    input: ListEventsInput,
  ): Promise<GoogleCalendarMcpResult<ListEventsOutput>> {
    const validation = validateListInput(input);
    if (!validation.ok) return validation;
    const { from, to, calendarId, maxResults } = validation.value;

    return this.withClient(async (client) => {
      try {
        const res = await client.events.list({
          calendarId,
          timeMin: from.toISOString(),
          timeMax: to.toISOString(),
          singleEvents: true,
          orderBy: 'startTime',
          maxResults,
        });
        const events: CalendarEventDto[] = (res.data.items ?? [])
          .map(parseGoogleEvent)
          .filter((e): e is CalendarEventDto => e !== null);
        return calendarOk({ events });
      } catch (err) {
        return mapGoogleApiError(err);
      }
    });
  }

  async getEvent(
    input: GetEventInput,
  ): Promise<GoogleCalendarMcpResult<GetEventOutput>> {
    if (!input.eventId?.trim()) {
      return calendarError('INVALID_ARGUMENT', 'getEvent requires an eventId');
    }
    const calendarId = input.calendarId?.trim() || 'primary';
    return this.withClient(async (client) => {
      try {
        const res = await client.events.get({ calendarId, eventId: input.eventId });
        const detail = parseGoogleEventDetail(res.data);
        if (!detail) {
          return calendarError(
            'MALFORMED_RESPONSE',
            'Google events.get returned an event without id or a discrete time window',
          );
        }
        return calendarOk({ event: detail });
      } catch (err) {
        return mapGoogleApiError(err);
      }
    });
  }

  async proposeTimes(
    input: ProposeTimesInput,
  ): Promise<GoogleCalendarMcpResult<ProposeTimesOutput>> {
    const validated = validateProposeTimesInput(input);
    if (!validated.ok) return validated;
    // One free/busy READ; the slot arithmetic is pure local computation
    // (./propose-times.ts) so the test server + unit tests exercise the
    // exact same proposal logic without a Google round-trip.
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

  async findAvailability(
    input: FindAvailabilityInput,
  ): Promise<GoogleCalendarMcpResult<FindAvailabilityOutput>> {
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
    const calendarIds =
      input.calendarIds && input.calendarIds.length > 0
        ? input.calendarIds
        : ['primary'];

    return this.withClient(async (client) => {
      try {
        const res = await client.freebusy.query({
          requestBody: {
            timeMin: timeMin.toISOString(),
            timeMax: timeMax.toISOString(),
            items: calendarIds.map((id) => ({ id })),
          },
        });
        const calendars = res.data.calendars ?? {};
        const busy: { start: string; end: string }[] = [];
        for (const cal of Object.values(calendars)) {
          for (const slot of cal.busy ?? []) {
            if (slot.start && slot.end) {
              busy.push({ start: slot.start, end: slot.end });
            }
          }
        }
        return calendarOk({ busy });
      } catch (err) {
        return mapGoogleApiError(err);
      }
    });
  }

  async bookMeeting(
    input: BookMeetingInput,
  ): Promise<GoogleCalendarMcpResult<BookMeetingOutput>> {
    if (!input.summary?.trim()) {
      return calendarError('INVALID_ARGUMENT', 'bookMeeting requires a summary');
    }
    const start = new Date(input.start);
    const end = new Date(input.end);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return calendarError(
        'INVALID_ARGUMENT',
        'bookMeeting requires ISO 8601 start + end',
      );
    }
    if (end.getTime() <= start.getTime()) {
      return calendarError(
        'INVALID_ARGUMENT',
        'bookMeeting requires end strictly after start',
      );
    }
    const calendarId = input.calendarId?.trim() || 'primary';

    return this.withClient(async (client) => {
      try {
        const res = await client.events.insert({
          calendarId,
          requestBody: {
            summary: input.summary,
            description: input.description,
            start: { dateTime: start.toISOString() },
            end: { dateTime: end.toISOString() },
            attendees: input.attendees?.map((email) => ({ email })),
          },
        });
        if (!res.data.id) {
          return calendarError(
            'MALFORMED_RESPONSE',
            'Google events.insert returned no event id',
          );
        }
        return calendarOk({
          eventId: res.data.id,
          htmlLink: res.data.htmlLink ?? undefined,
        });
      } catch (err) {
        return mapGoogleApiError(err);
      }
    });
  }

  async rescheduleMeeting(
    input: RescheduleMeetingInput,
  ): Promise<GoogleCalendarMcpResult<RescheduleMeetingOutput>> {
    if (!input.eventId?.trim()) {
      return calendarError(
        'INVALID_ARGUMENT',
        'rescheduleMeeting requires an eventId',
      );
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
    const calendarId = input.calendarId?.trim() || 'primary';

    return this.withClient(async (client) => {
      try {
        const res = await client.events.patch({
          calendarId,
          eventId: input.eventId,
          requestBody: {
            start: { dateTime: start.toISOString() },
            end: { dateTime: end.toISOString() },
          },
        });
        if (!res.data.id) {
          return calendarError(
            'MALFORMED_RESPONSE',
            'Google events.patch returned no event id',
          );
        }
        return calendarOk({ eventId: res.data.id });
      } catch (err) {
        return mapGoogleApiError(err);
      }
    });
  }

  async updateEvent(
    input: UpdateEventInput,
  ): Promise<GoogleCalendarMcpResult<UpdateEventOutput>> {
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
    const calendarId = input.calendarId?.trim() || 'primary';

    return this.withClient(async (client) => {
      try {
        const res = await client.events.patch({
          calendarId,
          eventId: input.eventId,
          requestBody: {
            ...(input.summary !== undefined ? { summary: input.summary } : {}),
            ...(input.description !== undefined ? { description: input.description } : {}),
            ...(input.location !== undefined ? { location: input.location } : {}),
            ...(start && end
              ? {
                  start: { dateTime: start.toISOString() },
                  end: { dateTime: end.toISOString() },
                }
              : {}),
            ...(input.attendees !== undefined
              ? { attendees: input.attendees.map((email) => ({ email })) }
              : {}),
          },
        });
        if (!res.data.id) {
          return calendarError('MALFORMED_RESPONSE', 'Google events.patch returned no event id');
        }
        return calendarOk({
          eventId: res.data.id,
          htmlLink: res.data.htmlLink ?? undefined,
        });
      } catch (err) {
        return mapGoogleApiError(err);
      }
    });
  }

  async cancelEvent(
    input: CancelEventInput,
  ): Promise<GoogleCalendarMcpResult<CancelEventOutput>> {
    if (!input.eventId?.trim()) {
      return calendarError('INVALID_ARGUMENT', 'cancelEvent requires an eventId');
    }
    const calendarId = input.calendarId?.trim() || 'primary';
    return this.withClient(async (client) => {
      try {
        await client.events.delete({ calendarId, eventId: input.eventId });
        return calendarOk({ eventId: input.eventId, cancelled: true as const });
      } catch (err) {
        return mapGoogleApiError(err);
      }
    });
  }

  // ── Resources ────────────────────────────────────────────────────────

  async listResources(): Promise<
    GoogleCalendarMcpResult<ResourceDescriptor[]>
  > {
    return calendarOk([
      {
        uri: `google-calendar://workspace/${this.workspaceId}/events`,
        name: 'Calendar events',
        description:
          "Read-only view of the workspace's connected Google Calendar. Pass `?from=…&to=…` (ISO 8601) to scope the window.",
        mimeType: 'application/json',
      },
    ]);
  }

  async readResource(
    input: ReadResourceInput,
  ): Promise<GoogleCalendarMcpResult<ReadResourceOutput>> {
    const match = RESOURCE_URI_WINDOW_RE.exec(input.uri);
    if (!match) {
      return calendarError(
        'INVALID_ARGUMENT',
        `Unknown resource URI: ${input.uri}. Expected google-calendar://workspace/{workspaceId}/events?from={iso}&to={iso}.`,
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

  private async withClient<T>(
    fn: (client: calendar_v3.Calendar) => Promise<GoogleCalendarMcpResult<T>>,
  ): Promise<GoogleCalendarMcpResult<T>> {
    const resolved = await resolveCredential({ workspaceId: this.workspaceId });
    if (!resolved.ok) return resolved;
    const client = makeCalendarClient(resolved.value);
    return fn(client);
  }
}

// ── helpers ─────────────────────────────────────────────────────────────

function makeCalendarClient(credential: DecryptedCredential): calendar_v3.Calendar {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({
    access_token: credential.accessToken,
    refresh_token: credential.refreshToken ?? undefined,
  });
  return google.calendar({ version: 'v3', auth });
}

interface ValidatedInput {
  from: Date;
  to: Date;
  calendarId: string;
  maxResults: number;
}

function validateListInput(
  input: ListEventsInput,
): GoogleCalendarMcpResult<ValidatedInput> {
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
  const calendarId = input.calendarId?.trim() || 'primary';
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
  return calendarOk({ from: input.from, to: input.to, calendarId, maxResults });
}

/**
 * Map a Google Calendar `Event` resource to the provider-neutral DTO.
 * Returns null for events that lack a discrete time window (all-day-only,
 * no start) so the scheduler doesn't try to compute slot overlap against
 * date-only entries.
 */
export function parseGoogleEvent(
  evt: calendar_v3.Schema$Event,
): CalendarEventDto | null {
  if (!evt.id) return null;
  // Google returns either `dateTime` (timed) or `date` (all-day). We only
  // model timed events as busy windows; all-day events are surfaced as a
  // full-day busy span when both endpoints are present.
  const startIso = readIsoInstant(evt.start);
  const endIso = readIsoInstant(evt.end);
  if (!startIso || !endIso) return null;
  // Google `transparency` is `transparent` (free) or omitted/`opaque` (busy).
  // Cancelled events are excluded by Calendar API's `singleEvents` flag, but
  // we belt-and-suspender here.
  const isBusy = (evt.transparency ?? 'opaque') !== 'transparent';
  if (evt.status === 'cancelled') return null;
  return {
    id: evt.id,
    title: evt.summary ?? '(untitled event)',
    startUtc: startIso,
    endUtc: endIso,
    isBusy,
  };
}

/**
 * Map a Google `Event` to the full detail DTO `getEvent` returns. Same
 * window rules as `parseGoogleEvent` (null when no id or no discrete time
 * window), plus attendees/description/location for the approval-card +
 * drafting path. Unlike the list parser, a CANCELLED event is returned (with
 * `status: 'cancelled'`) — an explicit get-by-id should say what happened to
 * the event, not pretend it never existed.
 */
export function parseGoogleEventDetail(
  evt: calendar_v3.Schema$Event,
): CalendarEventDetailDto | null {
  if (!evt.id) return null;
  const startIso = readIsoInstant(evt.start);
  const endIso = readIsoInstant(evt.end);
  if (!startIso || !endIso) return null;
  const base: CalendarEventDto = {
    id: evt.id,
    title: evt.summary ?? '(untitled event)',
    startUtc: startIso,
    endUtc: endIso,
    isBusy: (evt.transparency ?? 'opaque') !== 'transparent',
  };
  return {
    ...base,
    description: evt.description ?? null,
    location: evt.location ?? null,
    attendees: (evt.attendees ?? [])
      .filter((a): a is calendar_v3.Schema$EventAttendee & { email: string } =>
        Boolean(a.email),
      )
      .map((a) => ({ email: a.email, responseStatus: a.responseStatus ?? null })),
    htmlLink: evt.htmlLink ?? null,
    status: evt.status ?? null,
  };
}

function readIsoInstant(
  endpoint: calendar_v3.Schema$EventDateTime | undefined,
): string | null {
  if (!endpoint) return null;
  if (typeof endpoint.dateTime === 'string' && endpoint.dateTime.length > 0) {
    return new Date(endpoint.dateTime).toISOString();
  }
  if (typeof endpoint.date === 'string' && endpoint.date.length > 0) {
    // Date-only — treat as midnight UTC. Caller can pair with `end.date` to
    // get a full-day busy span.
    return new Date(`${endpoint.date}T00:00:00.000Z`).toISOString();
  }
  return null;
}

function mapGoogleApiError(
  err: unknown,
): { ok: false; error: import('./types').GoogleCalendarMcpError } {
  if (!err || typeof err !== 'object') {
    return calendarError('UPSTREAM_ERROR', String(err));
  }
  const rec = err as {
    code?: number | string;
    message?: string;
    response?: { status?: number; data?: unknown };
  };
  const message =
    typeof rec.message === 'string' ? rec.message : 'unknown Google API error';
  const status =
    typeof rec.response?.status === 'number'
      ? rec.response.status
      : typeof rec.code === 'number'
      ? rec.code
      : undefined;
  if (status === 401) return calendarError('TOKEN_EXPIRED', message, { status });
  if (status === 403) return calendarError('FORBIDDEN', message, { status });
  if (status === 404) return calendarError('NOT_FOUND', message, { status });
  if (status === 429) return calendarError('RATE_LIMITED', message, { status });
  if (status && status >= 500) {
    return calendarError('UPSTREAM_ERROR', message, { status });
  }
  return calendarError(
    'UPSTREAM_ERROR',
    message,
    status ? { status } : undefined,
  );
}
