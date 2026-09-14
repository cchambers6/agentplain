/**
 * Tests for `lib/integrations/calendar-scope.ts`.
 *
 * The defect this module exists to kill: a Gmail-only workspace read as
 * calendar-ready because every gate checked `provider` and none checked
 * `scopes`. The single most important case below is therefore
 * `GOOGLE + gmail.readonly → NOT ready`, and it is asserted twice — once
 * on the raw predicate and once through `calendarReadiness`, which is
 * what the cron and the agents page actually call.
 *
 * Per the repo standard: every table-driven block reports `examined N of
 * M` and fails when N is zero, so a corpus that silently empties (a
 * renamed export, a TDZ throw during collection) cannot pass as green.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  activeCalendarProviders,
  calendarReadiness,
  explainCalendarReadiness,
  hasCalendarReadScope,
  type CredentialScopeRow,
} from '../calendar-scope';

/** The exact scope set `GOOGLE_DEFAULT_SCOPES` requests today. */
const GMAIL_ONLY_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/gmail.readonly',
];

interface ScopeCase {
  label: string;
  provider: string;
  scopes: string[];
  expected: boolean;
}

const SCOPE_CASES: ScopeCase[] = [
  // ── Google: accept ────────────────────────────────────────────────
  {
    label: 'google full calendar scope',
    provider: 'GOOGLE',
    scopes: ['https://www.googleapis.com/auth/calendar'],
    expected: true,
  },
  {
    label: 'google calendar.readonly',
    provider: 'GOOGLE',
    scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
    expected: true,
  },
  {
    label: 'google calendar.events',
    provider: 'GOOGLE',
    scopes: ['https://www.googleapis.com/auth/calendar.events'],
    expected: true,
  },
  {
    label: 'google calendar.events.readonly (two dotted segments)',
    provider: 'GOOGLE',
    scopes: ['https://www.googleapis.com/auth/calendar.events.readonly'],
    expected: true,
  },
  {
    label: 'google calendar scope alongside mail scopes',
    provider: 'GOOGLE',
    scopes: [...GMAIL_ONLY_SCOPES, 'https://www.googleapis.com/auth/calendar.readonly'],
    expected: true,
  },
  {
    label: 'scope with surrounding whitespace still matches',
    provider: 'GOOGLE',
    scopes: ['  https://www.googleapis.com/auth/calendar.readonly  '],
    expected: true,
  },
  // ── Google: reject ────────────────────────────────────────────────
  {
    label: 'THE DEFECT — gmail-only grant is not calendar-ready',
    provider: 'GOOGLE',
    scopes: GMAIL_ONLY_SCOPES,
    expected: false,
  },
  {
    label: 'empty scope array',
    provider: 'GOOGLE',
    scopes: [],
    expected: false,
  },
  {
    label: 'drive scope is not a calendar scope',
    provider: 'GOOGLE',
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    expected: false,
  },
  {
    label: 'near-miss: a scope that merely contains "calendar"',
    provider: 'GOOGLE',
    scopes: ['https://www.googleapis.com/auth/calendar-notifications'],
    expected: false,
  },
  {
    label: 'wrong host is rejected even with the right path',
    provider: 'GOOGLE',
    scopes: ['https://example.com/auth/calendar'],
    expected: false,
  },
  {
    label: 'M365 scope does not satisfy a GOOGLE credential',
    provider: 'GOOGLE',
    scopes: ['Calendars.Read'],
    expected: false,
  },
  // ── M365: accept ──────────────────────────────────────────────────
  {
    label: 'graph Calendars.Read (bare)',
    provider: 'M365',
    scopes: ['Calendars.Read'],
    expected: true,
  },
  {
    label: 'graph Calendars.ReadWrite (bare)',
    provider: 'M365',
    scopes: ['Calendars.ReadWrite'],
    expected: true,
  },
  {
    label: 'graph Calendars.ReadBasic',
    provider: 'M365',
    scopes: ['Calendars.ReadBasic'],
    expected: true,
  },
  {
    label: 'graph Calendars.Read.Shared',
    provider: 'M365',
    scopes: ['Calendars.Read.Shared'],
    expected: true,
  },
  {
    label: 'graph resource-qualified scope URI',
    provider: 'M365',
    scopes: ['https://graph.microsoft.com/Calendars.Read'],
    expected: true,
  },
  {
    label: 'graph scope is case-insensitive',
    provider: 'M365',
    scopes: ['calendars.readwrite'],
    expected: true,
  },
  // ── M365: reject ──────────────────────────────────────────────────
  {
    label: 'mail-only graph grant is not calendar-ready',
    provider: 'M365',
    scopes: ['Mail.Read', 'Mail.ReadWrite', 'offline_access'],
    expected: false,
  },
  {
    label: 'Calendars without a permission suffix is not a real scope',
    provider: 'M365',
    scopes: ['Calendars'],
    expected: false,
  },
  // ── Providers that cannot serve a calendar at all ─────────────────
  {
    label: 'QUICKBOOKS is never calendar-capable',
    provider: 'QUICKBOOKS',
    scopes: ['https://www.googleapis.com/auth/calendar'],
    expected: false,
  },
];

describe('hasCalendarReadScope', () => {
  it('classifies every scope case correctly', () => {
    let examined = 0;
    for (const c of SCOPE_CASES) {
      examined += 1;
      assert.equal(
        hasCalendarReadScope(c.provider, c.scopes),
        c.expected,
        `${c.label}: expected ${c.expected} for provider=${c.provider} scopes=${JSON.stringify(c.scopes)}`,
      );
    }
    assert.equal(
      examined,
      SCOPE_CASES.length,
      `examined ${examined} of ${SCOPE_CASES.length}`,
    );
    assert.ok(examined > 0, 'examined 0 scope cases — the corpus is empty');
    // Both verdicts must be represented, or the assertion above could be
    // satisfied by a predicate hard-wired to a single answer.
    assert.ok(
      SCOPE_CASES.some((c) => c.expected) && SCOPE_CASES.some((c) => !c.expected),
      'corpus must contain both accepted and rejected scopes',
    );
  });
});

function row(provider: string, scopes: string[]): CredentialScopeRow {
  return { provider, scopes };
}

describe('activeCalendarProviders', () => {
  it('returns only providers whose grant includes a calendar scope', () => {
    const rows = [
      row('GOOGLE', GMAIL_ONLY_SCOPES),
      row('M365', ['Calendars.Read']),
    ];
    assert.deepEqual(activeCalendarProviders(rows), ['M365']);
  });

  it('returns both when both are calendar-scoped', () => {
    const rows = [
      row('GOOGLE', ['https://www.googleapis.com/auth/calendar.readonly']),
      row('M365', ['Calendars.ReadWrite']),
    ];
    assert.deepEqual(activeCalendarProviders(rows), ['GOOGLE', 'M365']);
  });

  it('is empty for a workspace with no credentials', () => {
    assert.deepEqual(activeCalendarProviders([]), []);
  });

  it('accepts the provider when ANY of its rows carries the scope', () => {
    // A workspace can hold more than one GOOGLE row (multiple accounts).
    // One calendar-scoped account is enough to read a calendar.
    const rows = [
      row('GOOGLE', GMAIL_ONLY_SCOPES),
      row('GOOGLE', ['https://www.googleapis.com/auth/calendar.events']),
    ];
    assert.deepEqual(activeCalendarProviders(rows), ['GOOGLE']);
  });
});

describe('calendarReadiness — distinguishes the two non-ready reasons', () => {
  it('no credential at all → no-credential', () => {
    const r = calendarReadiness([]);
    assert.equal(r.ready, false);
    assert.equal(r.reason, 'no-credential');
    assert.deepEqual(r.connectedWithoutScope, []);
  });

  it('THE DEFECT — Gmail connected, no calendar scope → missing-calendar-scope', () => {
    const r = calendarReadiness([row('GOOGLE', GMAIL_ONLY_SCOPES)]);
    assert.equal(r.ready, false);
    assert.equal(r.reason, 'missing-calendar-scope');
    assert.deepEqual(r.connectedWithoutScope, ['GOOGLE']);
    assert.deepEqual(r.providers, []);
  });

  it('calendar-scoped grant → ready, with the provider named', () => {
    const r = calendarReadiness([
      row('GOOGLE', ['https://www.googleapis.com/auth/calendar.readonly']),
    ]);
    assert.equal(r.ready, true);
    assert.equal(r.reason, 'ready');
    assert.deepEqual(r.providers, ['GOOGLE']);
  });
});

describe('explainCalendarReadiness — the operator can tell the two apart', () => {
  it('names the connected-but-unscoped provider so the fix is obvious', () => {
    const msg = explainCalendarReadiness(
      calendarReadiness([row('GOOGLE', GMAIL_ONLY_SCOPES)]),
      'ws-1',
    );
    assert.match(msg, /GOOGLE/);
    assert.match(msg, /WITHOUT a calendar scope/);
    assert.match(msg, /Reconnect/);
  });

  it('the no-credential message does NOT claim a scope problem', () => {
    const msg = explainCalendarReadiness(calendarReadiness([]), 'ws-1');
    assert.match(msg, /No active GOOGLE or M365/);
    assert.doesNotMatch(msg, /WITHOUT a calendar scope/);
  });
});
