/**
 * Tests for the per-provider calendar fetchers + the multiplexer.
 *
 * Each adapter is tested via dependency injection of the test MCP
 * server, so no `googleapis` / Microsoft Graph round-trips happen in
 * CI. The test matrix covers:
 *
 *   - Success path: events come back through the MCP, schema-validate,
 *     and hydrate to `CalendarEvent[]` with `Date` instants.
 *   - No-events path: an empty MCP response surfaces as an empty array
 *     (not an error).
 *   - MCP-down path: the MCP server's `forcedError` surfaces as
 *     `UPSTREAM_GMAIL_ERROR` (the existing scheduler skill error code).
 *   - Missing-credential path: an MCP `CREDENTIAL_NOT_FOUND` from the
 *     server surfaces as `NOT_CONFIGURED` on the fetcher so the cron
 *     can treat it as a clean skip.
 *   - Multiplexer: prefers Google when both are connected; falls back
 *     to M365 when only M365 is; returns NOT_CONFIGURED when neither.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { GoogleCalendarFetcher } from '../google-calendar-fetcher';
import { OutlookCalendarFetcher } from '../outlook-calendar-fetcher';
import { CalendarMultiplexFetcher } from '../calendar-multiplex-fetcher';
import { TestGoogleCalendarMcpServer } from '@/lib/integrations/google-calendar-mcp';
import { TestOutlookCalendarMcpServer } from '@/lib/integrations/outlook-calendar-mcp';
import type { CalendarEventDto as GoogleCalendarEventDto } from '@/lib/integrations/google-calendar-mcp';
import type { CalendarEventDto as OutlookCalendarEventDto } from '@/lib/integrations/outlook-calendar-mcp';
import type { CalendarEvent } from '../../chief-of-staff-scheduler/types';
import type { CalendarFetcher } from '../types';
import { skillOk, type SkillResult } from '../../types';

const WORKSPACE_ID = 'ws-cal-0001';
const FROM = new Date('2026-05-28T00:00:00.000Z');
const TO = new Date('2026-06-04T00:00:00.000Z');

/** A Google grant that CAN read a calendar. */
const GOOGLE_CAL_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';
/** The scope set `GOOGLE_DEFAULT_SCOPES` actually requests today — mail
 *  only. A workspace holding exactly this used to resolve to the Google
 *  arm and 403 at Google on every sweep. */
const GMAIL_ONLY_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/gmail.readonly',
];

function googleEvent(overrides: Partial<GoogleCalendarEventDto> = {}): GoogleCalendarEventDto {
  return {
    id: 'evt-g-1',
    title: 'Sync with Jane',
    startUtc: '2026-05-29T14:00:00.000Z',
    endUtc: '2026-05-29T14:30:00.000Z',
    isBusy: true,
    ...overrides,
  };
}

function outlookEvent(overrides: Partial<OutlookCalendarEventDto> = {}): OutlookCalendarEventDto {
  return {
    id: 'evt-o-1',
    title: 'Pipeline review',
    startUtc: '2026-05-29T15:00:00.000Z',
    endUtc: '2026-05-29T16:00:00.000Z',
    isBusy: true,
    ...overrides,
  };
}

// ── GoogleCalendarFetcher ───────────────────────────────────────────────

describe('GoogleCalendarFetcher — happy path', () => {
  it('hydrates MCP events to CalendarEvent[] with Date instants', async () => {
    const server = new TestGoogleCalendarMcpServer({
      workspaceId: WORKSPACE_ID,
      seed: { events: [googleEvent()] },
    });
    const fetcher = new GoogleCalendarFetcher({ workspaceId: WORKSPACE_ID, server });
    const res = await fetcher.fetchEvents({ workspaceId: WORKSPACE_ID, from: FROM, to: TO });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value.length, 1);
    assert.equal(res.value[0].id, 'evt-g-1');
    assert.equal(res.value[0].startUtc instanceof Date, true);
    assert.equal(res.value[0].startUtc.toISOString(), '2026-05-29T14:00:00.000Z');
    assert.equal(res.value[0].isBusy, true);
  });
});

describe('GoogleCalendarFetcher — no events', () => {
  it('returns empty array when the calendar window has no events', async () => {
    const server = new TestGoogleCalendarMcpServer({
      workspaceId: WORKSPACE_ID,
      seed: { events: [] },
    });
    const fetcher = new GoogleCalendarFetcher({ workspaceId: WORKSPACE_ID, server });
    const res = await fetcher.fetchEvents({ workspaceId: WORKSPACE_ID, from: FROM, to: TO });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value.length, 0);
  });
});

describe('GoogleCalendarFetcher — MCP down', () => {
  it('surfaces MCP upstream errors as UPSTREAM_GMAIL_ERROR', async () => {
    const server = new TestGoogleCalendarMcpServer({
      workspaceId: WORKSPACE_ID,
      seed: { forcedError: { code: 'UPSTREAM_ERROR', message: 'simulated calendar API down' } },
    });
    const fetcher = new GoogleCalendarFetcher({ workspaceId: WORKSPACE_ID, server });
    const res = await fetcher.fetchEvents({ workspaceId: WORKSPACE_ID, from: FROM, to: TO });
    assert.equal(res.ok, false);
    if (res.ok) return;
    assert.equal(res.error.code, 'UPSTREAM_GMAIL_ERROR');
    assert.equal(res.error.reference, 'UPSTREAM_ERROR');
  });
});

describe('GoogleCalendarFetcher — missing credential', () => {
  it('maps CREDENTIAL_NOT_FOUND to NOT_CONFIGURED so the cron skips cleanly', async () => {
    const server = new TestGoogleCalendarMcpServer({
      workspaceId: WORKSPACE_ID,
      seed: {
        forcedError: {
          code: 'CREDENTIAL_NOT_FOUND',
          message: 'no GOOGLE credential — connect calendar',
        },
      },
    });
    const fetcher = new GoogleCalendarFetcher({ workspaceId: WORKSPACE_ID, server });
    const res = await fetcher.fetchEvents({ workspaceId: WORKSPACE_ID, from: FROM, to: TO });
    assert.equal(res.ok, false);
    if (res.ok) return;
    assert.equal(res.error.code, 'NOT_CONFIGURED');
  });
});

// ── OutlookCalendarFetcher ──────────────────────────────────────────────

describe('OutlookCalendarFetcher — happy path', () => {
  it('hydrates MCP events to CalendarEvent[] with Date instants', async () => {
    const server = new TestOutlookCalendarMcpServer({
      workspaceId: WORKSPACE_ID,
      seed: { events: [outlookEvent()] },
    });
    const fetcher = new OutlookCalendarFetcher({ workspaceId: WORKSPACE_ID, server });
    const res = await fetcher.fetchEvents({ workspaceId: WORKSPACE_ID, from: FROM, to: TO });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value.length, 1);
    assert.equal(res.value[0].id, 'evt-o-1');
    assert.equal(res.value[0].endUtc.toISOString(), '2026-05-29T16:00:00.000Z');
  });
});

describe('OutlookCalendarFetcher — no events', () => {
  it('returns empty array when the calendar window has no events', async () => {
    const server = new TestOutlookCalendarMcpServer({
      workspaceId: WORKSPACE_ID,
      seed: { events: [] },
    });
    const fetcher = new OutlookCalendarFetcher({ workspaceId: WORKSPACE_ID, server });
    const res = await fetcher.fetchEvents({ workspaceId: WORKSPACE_ID, from: FROM, to: TO });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value.length, 0);
  });
});

describe('OutlookCalendarFetcher — MCP down', () => {
  it('surfaces UPSTREAM_ERROR as UPSTREAM_GMAIL_ERROR', async () => {
    const server = new TestOutlookCalendarMcpServer({
      workspaceId: WORKSPACE_ID,
      seed: { forcedError: { code: 'RATE_LIMITED', message: 'graph 429' } },
    });
    const fetcher = new OutlookCalendarFetcher({ workspaceId: WORKSPACE_ID, server });
    const res = await fetcher.fetchEvents({ workspaceId: WORKSPACE_ID, from: FROM, to: TO });
    assert.equal(res.ok, false);
    if (res.ok) return;
    assert.equal(res.error.code, 'UPSTREAM_GMAIL_ERROR');
  });
});

describe('OutlookCalendarFetcher — missing credential', () => {
  it('maps CREDENTIAL_NOT_FOUND to NOT_CONFIGURED', async () => {
    const server = new TestOutlookCalendarMcpServer({
      workspaceId: WORKSPACE_ID,
      seed: {
        forcedError: { code: 'CREDENTIAL_NOT_FOUND', message: 'no M365 cred' },
      },
    });
    const fetcher = new OutlookCalendarFetcher({ workspaceId: WORKSPACE_ID, server });
    const res = await fetcher.fetchEvents({ workspaceId: WORKSPACE_ID, from: FROM, to: TO });
    assert.equal(res.ok, false);
    if (res.ok) return;
    assert.equal(res.error.code, 'NOT_CONFIGURED');
  });
});

// ── CalendarMultiplexFetcher ────────────────────────────────────────────

class StubCalendarFetcher implements CalendarFetcher {
  readonly name = 'stub' as const;
  readonly provider: 'google' | 'm365';
  readonly calls: number;
  private callsRef = { count: 0 };
  private readonly events: CalendarEvent[];

  constructor(provider: 'google' | 'm365', events: CalendarEvent[] = []) {
    this.provider = provider;
    this.events = events;
    this.calls = 0;
  }

  async fetchEvents(): Promise<SkillResult<CalendarEvent[]>> {
    this.callsRef.count += 1;
    return skillOk(this.events);
  }

  get callCount(): number {
    return this.callsRef.count;
  }
}

describe('CalendarMultiplexFetcher — Google wins when both are connected', () => {
  it('routes to the Google arm and never calls the M365 arm', async () => {
    const googleArm = new StubCalendarFetcher('google');
    const outlookArm = new StubCalendarFetcher('m365');
    const mux = new CalendarMultiplexFetcher({
      workspaceId: WORKSPACE_ID,
      testGoogle: googleArm,
      testOutlook: outlookArm,
      testCredentials: [
        { provider: 'GOOGLE', scopes: [GOOGLE_CAL_SCOPE] },
        { provider: 'M365', scopes: ['Calendars.Read'] },
      ],
    });
    const res = await mux.fetchEvents({ workspaceId: WORKSPACE_ID, from: FROM, to: TO });
    assert.equal(res.ok, true);
    assert.equal(mux.provider, 'google');
    assert.equal(googleArm.callCount, 1);
    assert.equal(outlookArm.callCount, 0);
  });
});

describe('CalendarMultiplexFetcher — M365 fallback', () => {
  it('routes to the M365 arm when Google is not connected', async () => {
    const googleArm = new StubCalendarFetcher('google');
    const outlookArm = new StubCalendarFetcher('m365');
    const mux = new CalendarMultiplexFetcher({
      workspaceId: WORKSPACE_ID,
      testGoogle: googleArm,
      testOutlook: outlookArm,
      testCredentials: [{ provider: 'M365', scopes: ['Calendars.Read'] }],
    });
    const res = await mux.fetchEvents({ workspaceId: WORKSPACE_ID, from: FROM, to: TO });
    assert.equal(res.ok, true);
    assert.equal(mux.provider, 'm365');
    assert.equal(googleArm.callCount, 0);
    assert.equal(outlookArm.callCount, 1);
  });
});

describe('CalendarMultiplexFetcher — neither connected', () => {
  it('returns NOT_CONFIGURED cleanly so the cron can skip', async () => {
    const mux = new CalendarMultiplexFetcher({
      workspaceId: WORKSPACE_ID,
      testCredentials: [],
    });
    const res = await mux.fetchEvents({ workspaceId: WORKSPACE_ID, from: FROM, to: TO });
    assert.equal(res.ok, false);
    if (res.ok) return;
    assert.equal(res.error.code, 'NOT_CONFIGURED');
    assert.equal(res.error.reference, 'no-credential');
    assert.equal(mux.provider, null);
  });
});

// ── The defect this PR fixes ────────────────────────────────────────────
//
// A Gmail-only workspace holds an ACTIVE GOOGLE credential. Under the
// provider-only resolver it routed to the Google arm, which then called
// `calendar.events.list` with no calendar scope and got a 403 from
// Google — every fifteen minutes, on every Gmail customer.

describe('CalendarMultiplexFetcher — Google connected WITHOUT a calendar scope', () => {
  it('does NOT route to the Google arm', async () => {
    const googleArm = new StubCalendarFetcher('google');
    const outlookArm = new StubCalendarFetcher('m365');
    const mux = new CalendarMultiplexFetcher({
      workspaceId: WORKSPACE_ID,
      testGoogle: googleArm,
      testOutlook: outlookArm,
      testCredentials: [{ provider: 'GOOGLE', scopes: GMAIL_ONLY_SCOPES }],
    });
    const res = await mux.fetchEvents({ workspaceId: WORKSPACE_ID, from: FROM, to: TO });
    assert.equal(res.ok, false);
    if (res.ok) return;
    assert.equal(res.error.code, 'NOT_CONFIGURED');
    // The reason is the load-bearing part: the operator must be able to
    // tell "never connected" from "connected without permission".
    assert.equal(res.error.reference, 'missing-calendar-scope');
    assert.match(res.error.message, /WITHOUT a calendar scope/);
    assert.equal(mux.provider, null);
    // The 403 that used to happen here: no arm was called at all.
    assert.equal(googleArm.callCount, 0);
    assert.equal(outlookArm.callCount, 0);
  });

  it('falls through to M365 when only M365 carries a calendar scope', async () => {
    const googleArm = new StubCalendarFetcher('google');
    const outlookArm = new StubCalendarFetcher('m365');
    const mux = new CalendarMultiplexFetcher({
      workspaceId: WORKSPACE_ID,
      testGoogle: googleArm,
      testOutlook: outlookArm,
      testCredentials: [
        { provider: 'GOOGLE', scopes: GMAIL_ONLY_SCOPES },
        { provider: 'M365', scopes: ['Calendars.Read'] },
      ],
    });
    const res = await mux.fetchEvents({ workspaceId: WORKSPACE_ID, from: FROM, to: TO });
    assert.equal(res.ok, true);
    assert.equal(mux.provider, 'm365');
    assert.equal(googleArm.callCount, 0);
    assert.equal(outlookArm.callCount, 1);
  });
});
