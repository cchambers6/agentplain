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
 * Per `project_no_outbound_architecture.md`: the tool surface is
 * READ-ONLY — no insert / update / delete. The scheduler proposes;
 * the customer's calendar performs the actual booking.
 *
 * Per `feedback_cold_start_safe_agents.md`: `withClient` re-resolves the
 * credential on every call. No decrypted token lives on the instance.
 */

import { google, type calendar_v3 } from 'googleapis';
import { resolveCredential } from './auth';
import type { DecryptedCredential } from '@/lib/integrations/types';
import {
  type CalendarEventDto,
  type GoogleCalendarMcpResult,
  type GoogleCalendarMcpServer,
  type ListEventsInput,
  type ListEventsOutput,
  type ReadResourceInput,
  type ReadResourceOutput,
  type ResourceDescriptor,
  calendarError,
  calendarOk,
} from './types';

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
