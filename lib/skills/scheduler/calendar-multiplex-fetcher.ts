/**
 * lib/skills/scheduler/calendar-multiplex-fetcher.ts
 *
 * The third implementation of `CalendarFetcher` — picks the right per-
 * provider fetcher based on the workspace's active OAuth credentials.
 *
 * Resolution order on every call:
 *   1. If the workspace has an ACTIVE GOOGLE `IntegrationCredential`
 *      WHOSE GRANTED SCOPES INCLUDE A CALENDAR READ SCOPE, route to
 *      `GoogleCalendarFetcher`.
 *   2. Else if the same holds for an ACTIVE M365 credential, route to
 *      `OutlookCalendarFetcher`.
 *   3. Else return `skillError('NOT_CONFIGURED', …)` — the caller (cron
 *      sweep / skill multiplexer) treats this as a clean skip, not a
 *      failure. The skill emits ZERO fake events; the customer's roster
 *      degrades to "connect to activate".
 *
 * ── The scope check is new, and it is the point ─────────────────────────
 *
 * This resolver used to ask only "is there an ACTIVE GOOGLE or M365 row?".
 * That is the wrong question. Gmail and Google Calendar ride the SAME
 * GOOGLE credential row (`google-calendar-mcp/auth.ts` resolves the Gmail
 * credential), and `GOOGLE_DEFAULT_SCOPES` requests no calendar scope. So
 * every Gmail-connected workspace resolved to `google`, the sweep called
 * `calendar.events.list`, and Google returned 403 — once every fifteen
 * minutes, forever, on a workspace whose roster was simultaneously
 * rendering the Chief of Staff card as LIVE.
 *
 * The verdict now comes from `lib/integrations/calendar-scope.ts`, shared
 * with the cron and the agents page so the three cannot hold different
 * opinions about what "connected" means.
 *
 * NOT_CONFIGURED still covers both non-ready cases, because both are a
 * clean skip for the cron — but the MESSAGE now distinguishes them. An
 * operator reading "no credential" when the real problem is "credential
 * without calendar permission" goes looking in the wrong place, and the
 * customer sees a Connections page where everything is green.
 *
 * Per `feedback_cold_start_safe_agents.md`: every call re-reads the
 * IntegrationCredential rows. No in-memory cache of "which provider this
 * workspace uses."
 *
 * Per `feedback_no_silent_vendor_lock.md`: this file imports the
 * per-provider fetcher CLASSES only (not the underlying SDKs). Provider
 * choice is data, not a build-time decision.
 *
 * Per `project_no_outbound_architecture.md`: read-only — the multiplexer
 * just selects a fetcher; no fetcher writes to the calendar.
 */

import { withSystemContext } from '@/lib/db/rls';
import {
  calendarReadiness,
  explainCalendarReadiness,
  type CalendarProvider,
  type CalendarReadiness,
  type CredentialScopeRow,
} from '@/lib/integrations/calendar-scope';
import type { CalendarEvent } from '../chief-of-staff-scheduler/types';
import { skillError, skillOk, type SkillResult } from '../types';
import { GoogleCalendarFetcher } from './google-calendar-fetcher';
import { OutlookCalendarFetcher } from './outlook-calendar-fetcher';
import type { CalendarFetcher, CalendarFetcherInput } from './types';

/**
 * Reads the ACTIVE calendar-capable credential rows for a workspace.
 * Injectable so a caller that already holds an RLS-scoped transaction
 * (the agents page runs under the member's context, NOT system context)
 * can supply its own reader rather than forcing a second, wider read.
 */
export type CredentialScopeReader = (
  workspaceId: string,
) => Promise<CredentialScopeRow[]>;

/** Default reader — used by the cron, which legitimately runs as system. */
const systemCredentialReader: CredentialScopeReader = (workspaceId) =>
  withSystemContext((tx) =>
    tx.integrationCredential.findMany({
      where: {
        workspaceId,
        status: 'ACTIVE',
        provider: { in: ['GOOGLE', 'M365'] },
      },
      // `scopes` is the field that makes this check real. Selecting only
      // `provider` here is the original defect.
      select: { provider: true, scopes: true },
    }),
  );

export interface CalendarMultiplexFetcherConfig {
  workspaceId: string;
  /** Optional override for tests — when present, the multiplexer SKIPS
   *  the IntegrationCredential lookup and uses these fetchers directly.
   *  Production passes nothing here. */
  testGoogle?: CalendarFetcher | null;
  testOutlook?: CalendarFetcher | null;
  /**
   * Optional override for tests — when present, the credential lookup
   * returns these rows instead of querying Prisma. Rows carry `scopes`,
   * so a test can express "Google connected, mail scope only" (the
   * defect case) rather than only "Google connected".
   */
  testCredentials?: readonly CredentialScopeRow[];
  /** Override the credential reader (production callers with their own
   *  RLS context). Ignored when `testCredentials` is set. */
  readCredentials?: CredentialScopeReader;
}

/**
 * Calendar readiness for a workspace. Surfaced separately from the fetch
 * so the agents page can render "live" vs "connect to activate" without
 * firing a full calendar read.
 *
 * `hasGoogle` / `hasM365` are retained for existing call sites, but their
 * MEANING has changed: they are now "can serve a calendar read", not
 * "has a credential of this provider". That is the whole fix — a name
 * that kept its shape and corrected its truth conditions.
 */
export interface CalendarConnectorState {
  workspaceId: string;
  hasGoogle: boolean;
  hasM365: boolean;
  /** Full verdict, including WHY a workspace is not ready. */
  readiness: CalendarReadiness;
}

export async function getCalendarConnectorState(
  workspaceId: string,
  opts: { readCredentials?: CredentialScopeReader } = {},
): Promise<CalendarConnectorState> {
  const read = opts.readCredentials ?? systemCredentialReader;
  const rows = await read(workspaceId);
  const readiness = calendarReadiness(rows);
  return {
    workspaceId,
    hasGoogle: readiness.providers.includes('GOOGLE'),
    hasM365: readiness.providers.includes('M365'),
    readiness,
  };
}

export class CalendarMultiplexFetcher implements CalendarFetcher {
  readonly name = 'multiplex' as const;
  /** Provider populated lazily on the first call; null when neither
   *  Google nor M365 can serve a calendar read. */
  provider: 'google' | 'm365' | null = null;
  private readonly workspaceId: string;
  private readonly testGoogle: CalendarFetcher | null;
  private readonly testOutlook: CalendarFetcher | null;
  private readonly testCredentials: readonly CredentialScopeRow[] | null;
  private readonly readCredentials: CredentialScopeReader;

  constructor(config: CalendarMultiplexFetcherConfig) {
    if (!config.workspaceId) {
      throw new Error('CalendarMultiplexFetcher: workspaceId is required');
    }
    this.workspaceId = config.workspaceId;
    this.testGoogle = config.testGoogle ?? null;
    this.testOutlook = config.testOutlook ?? null;
    this.testCredentials = config.testCredentials ?? null;
    this.readCredentials = config.readCredentials ?? systemCredentialReader;
  }

  async fetchEvents(
    input: CalendarFetcherInput,
  ): Promise<SkillResult<CalendarEvent[]>> {
    if (input.workspaceId !== this.workspaceId) {
      return skillError(
        'INVALID_INPUT',
        `CalendarMultiplexFetcher workspaceId mismatch: bound=${this.workspaceId}, asked=${input.workspaceId}`,
      );
    }
    const readiness = await this.resolveReadiness();
    const providers = readiness.providers;
    if (providers.includes('GOOGLE')) {
      this.provider = 'google';
      const fetcher =
        this.testGoogle ?? new GoogleCalendarFetcher({ workspaceId: this.workspaceId });
      return fetcher.fetchEvents(input);
    }
    if (providers.includes('M365')) {
      this.provider = 'm365';
      const fetcher =
        this.testOutlook ?? new OutlookCalendarFetcher({ workspaceId: this.workspaceId });
      return fetcher.fetchEvents(input);
    }
    this.provider = null;
    // One error code, two distinguishable messages. The cron treats both
    // as a clean skip; the operator can tell them apart.
    return skillError(
      'NOT_CONFIGURED',
      explainCalendarReadiness(readiness, this.workspaceId),
      readiness.reason,
    );
  }

  /** Exposed so the cron can ask "why not" without a second query. */
  async resolveReadiness(): Promise<CalendarReadiness> {
    if (this.testCredentials !== null) {
      return calendarReadiness(this.testCredentials);
    }
    return calendarReadiness(await this.readCredentials(this.workspaceId));
  }

  /** Providers that can actually serve a calendar read. */
  async resolveProviders(): Promise<readonly CalendarProvider[]> {
    return (await this.resolveReadiness()).providers;
  }
}
