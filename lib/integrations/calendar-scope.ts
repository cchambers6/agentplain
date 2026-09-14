/**
 * lib/integrations/calendar-scope.ts
 *
 * The ONE predicate that answers "can this workspace's credential
 * actually read a calendar?" — and the reason it exists.
 *
 * `IntegrationCredential` stores `provider` and `scopes` separately. Every
 * calendar gate in this repo used to read ONLY `provider`, asking
 * "is there an ACTIVE GOOGLE or M365 row?". That question has the wrong
 * answer for the most common workspace we have: one that connected Gmail.
 * Gmail and Google Calendar ride the SAME `GOOGLE` credential row (see
 * `google-calendar-mcp/auth.ts`, which resolves the Gmail credential), and
 * `GOOGLE_DEFAULT_SCOPES` requests no calendar scope at all. So a
 * Gmail-only workspace answered "yes, calendar-ready", the scheduler swept
 * it every 15 minutes, and `calendar.events.list` 403'd at Google.
 *
 * The customer-visible half of that was worse than the engine half: the
 * agents page derived the LIVE badge from the same provider-only check, so
 * the Chief of Staff card rendered LIVE on the strength of a mail
 * connection. That is the false-live class we removed from the marketing
 * surface; this module removes it from the engine and the roster together.
 *
 * Per `reference_product_claims_vs_reality_2026_05_22`: live derives from
 * real state. The realest state available here is the scope the provider
 * actually granted, which we store verbatim precisely so scope drift is
 * observable.
 *
 * This module is PURE — no Prisma, no Next, no network. It takes rows and
 * returns verdicts, so the cron, the fetcher and the agents page can all
 * import it and cannot hold different opinions about what "connected"
 * means. That co-location is the point: the previous defect was possible
 * only because three call sites each spelled the rule out themselves.
 */

/** The two providers that can back a calendar read today. */
export type CalendarProvider = 'GOOGLE' | 'M365';

export const CALENDAR_PROVIDERS: readonly CalendarProvider[] = [
  'GOOGLE',
  'M365',
];

/**
 * Google Calendar scopes that permit reading events.
 *
 * Matches the full-access scope (`.../auth/calendar`) and every dotted
 * sub-scope (`.readonly`, `.events`, `.events.readonly`, `.freebusy`).
 * Anchored on both ends so `.../auth/calendar-something-else` — or a
 * future unrelated scope that merely CONTAINS the word calendar — does
 * not pass. A gate that accepts too much is the failure we are fixing;
 * it must not be reintroduced by a loose pattern.
 */
export const GOOGLE_CALENDAR_READ_SCOPE =
  /^https:\/\/www\.googleapis\.com\/auth\/calendar(\.[a-z]+(\.[a-z]+)?)?$/i;

/**
 * Microsoft Graph calendar scopes that permit reading events.
 *
 * Graph returns scopes sometimes bare (`Calendars.Read`) and sometimes
 * resource-qualified (`https://graph.microsoft.com/Calendars.Read`), so
 * the leading segment is optional. `ReadBasic` is included: it returns
 * start/end/busy state, which is exactly and only what the slot finder
 * consumes.
 */
export const M365_CALENDAR_READ_SCOPE =
  /(^|\/)Calendars\.(Read|ReadBasic|ReadWrite)(\.Shared)?$/i;

/**
 * True when `scopes` contains at least one scope that lets us READ the
 * calendar for `provider`.
 *
 * Read, not write, is deliberately the bar here. Every consumer of this
 * predicate today is on the read path — the sweep reads a window and
 * proposes. Booking is a separate, approval-gated action with its own
 * scope requirement; do not widen this function to cover it. A single
 * predicate that conflates "can look" with "can book" would re-create the
 * exact over-broad gate this module replaces.
 */
export function hasCalendarReadScope(
  provider: string,
  scopes: readonly string[],
): boolean {
  const pattern =
    provider === 'GOOGLE'
      ? GOOGLE_CALENDAR_READ_SCOPE
      : provider === 'M365'
        ? M365_CALENDAR_READ_SCOPE
        : null;
  if (pattern === null) return false;
  return scopes.some((s) => pattern.test(s.trim()));
}

/** The shape every caller already has in hand after a credential query. */
export interface CredentialScopeRow {
  provider: string;
  scopes: readonly string[];
}

/**
 * Narrow a set of ACTIVE credential rows to the providers that can
 * actually serve a calendar read.
 *
 * Callers should keep filtering `status: 'ACTIVE'` and
 * `provider IN (GOOGLE, M365)` in the database — that prefilter is cheap
 * and correct. What they must NOT do is treat the result of that query as
 * the answer. This function is the second half of the question.
 */
export function activeCalendarProviders(
  rows: readonly CredentialScopeRow[],
): readonly CalendarProvider[] {
  const out: CalendarProvider[] = [];
  for (const provider of CALENDAR_PROVIDERS) {
    const matching = rows.filter((r) => r.provider === provider);
    if (matching.length === 0) continue;
    if (matching.some((r) => hasCalendarReadScope(provider, r.scopes))) {
      out.push(provider);
    }
  }
  return out;
}

/**
 * Why a workspace is not calendar-ready. The distinction is load-bearing
 * for the operator: "you never connected anything" and "you connected
 * Google but only gave us your mail" need different next actions, and
 * collapsing them into one "not configured" is how the original defect
 * stayed invisible for as long as it did.
 */
export type CalendarReadinessReason =
  | 'ready'
  /** No ACTIVE GOOGLE or M365 credential at all. */
  | 'no-credential'
  /** A credential exists, but it was granted without a calendar scope. */
  | 'missing-calendar-scope';

export interface CalendarReadiness {
  ready: boolean;
  reason: CalendarReadinessReason;
  /** Providers that CAN serve a calendar read. Empty unless `ready`. */
  providers: readonly CalendarProvider[];
  /**
   * Providers the workspace has connected but WITHOUT a calendar scope.
   * Populated only on `missing-calendar-scope`; this is what the operator
   * message names so the customer knows which grant to re-authorize.
   */
  connectedWithoutScope: readonly CalendarProvider[];
}

export function calendarReadiness(
  rows: readonly CredentialScopeRow[],
): CalendarReadiness {
  const providers = activeCalendarProviders(rows);
  if (providers.length > 0) {
    return {
      ready: true,
      reason: 'ready',
      providers,
      connectedWithoutScope: [],
    };
  }
  const connectedWithoutScope = CALENDAR_PROVIDERS.filter((p) =>
    rows.some((r) => r.provider === p),
  );
  return {
    ready: false,
    reason:
      connectedWithoutScope.length > 0
        ? 'missing-calendar-scope'
        : 'no-credential',
    providers: [],
    connectedWithoutScope,
  };
}

/**
 * Operator-facing explanation of a non-ready verdict. Kept next to the
 * verdict so the two cannot drift — a reason enum whose prose lives
 * somewhere else is how a suppression's justification goes quietly wrong.
 */
export function explainCalendarReadiness(
  readiness: CalendarReadiness,
  workspaceId: string,
): string {
  switch (readiness.reason) {
    case 'ready':
      return `Workspace ${workspaceId} can read a calendar via ${readiness.providers.join(', ')}.`;
    case 'no-credential':
      return `No active GOOGLE or M365 IntegrationCredential for workspace ${workspaceId}. Connect Google Calendar or Outlook to activate the scheduler.`;
    case 'missing-calendar-scope':
      return `Workspace ${workspaceId} has an active ${readiness.connectedWithoutScope.join(' / ')} credential, but it was granted WITHOUT a calendar scope, so no calendar can be read. Reconnect and grant calendar access to activate the scheduler.`;
  }
}
