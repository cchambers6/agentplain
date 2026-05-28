/**
 * lib/integrations/outlook-calendar-mcp/server.ts
 *
 * Production Outlook Calendar MCP server. Wraps Microsoft Graph's
 * `/me/calendarView` (and `/me/calendars/{id}/calendarView`) behind the
 * `OutlookCalendarMcpServer` interface. Mirrors the structure of
 * `lib/integrations/outlook-mcp/server.ts` so the seam to Graph is
 * narrow and consistent.
 *
 * Per `feedback_no_silent_vendor_lock.md`: this file is the SOLE seam in
 * the outlook-calendar-mcp folder that hits `https://graph.microsoft.com/`.
 * Skill code, route handlers, and cron functions speak the MCP interface
 * only. We use raw `fetch` to avoid pulling
 * `@microsoft/microsoft-graph-client` into the dependency surface for
 * Phase B — the same posture outlook-mcp/server.ts takes.
 *
 * Per `project_no_outbound_architecture.md`: read-only — no POST / PATCH
 * / DELETE on /me/events. The scheduler proposes; the customer's
 * calendar performs the booking.
 *
 * Per `feedback_cold_start_safe_agents.md`: every method re-resolves the
 * credential through the outlook-mcp auth resolver.
 */

import { resolveCredential } from './auth';
import type { DecryptedCredential } from '@/lib/integrations/types';
import {
  type CalendarEventDto,
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

  // ── Tools ────────────────────────────────────────────────────────────

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
      const res = await this.graphGet<GraphListResponse<GraphEvent>>(cred, url);
      if (!res.ok) return res;
      const events: CalendarEventDto[] = (res.value.value ?? [])
        .map(parseGraphEvent)
        .filter((e): e is CalendarEventDto => e !== null);
      return calendarOk({ events });
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
    const match = RESOURCE_URI_WINDOW_RE.exec(input.uri);
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

  private async graphGet<T>(
    cred: DecryptedCredential,
    url: string,
  ): Promise<OutlookCalendarMcpResult<T>> {
    const headers = new Headers();
    headers.set('Authorization', `Bearer ${cred.accessToken}`);
    headers.set('Accept', 'application/json');
    headers.set('Prefer', 'outlook.timezone="UTC"');
    let res: Response;
    try {
      res = await this.fetchImpl(url, { method: 'GET', headers });
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
    return calendarOk(parsed as T);
  }
}

// ── helpers ─────────────────────────────────────────────────────────────

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
