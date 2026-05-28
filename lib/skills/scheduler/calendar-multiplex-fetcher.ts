/**
 * lib/skills/scheduler/calendar-multiplex-fetcher.ts
 *
 * The third implementation of `CalendarFetcher` — picks the right per-
 * provider fetcher based on the workspace's active OAuth credentials.
 *
 * Resolution order on every call:
 *   1. If the workspace has an ACTIVE GOOGLE `IntegrationCredential`,
 *      route to `GoogleCalendarFetcher`.
 *   2. Else if the workspace has an ACTIVE M365 `IntegrationCredential`,
 *      route to `OutlookCalendarFetcher`.
 *   3. Else return `skillError('NOT_CONFIGURED', …)` — the caller (cron
 *      sweep / skill multiplexer) treats this as a clean skip, not a
 *      failure. The skill emits ZERO fake events; the customer's roster
 *      degrades to "connect to activate".
 *
 * When both Google + M365 are connected, Google wins (today's primary
 * Gmail customer is the larger seg; the choice can be made customer-
 * controllable later via a workspace preference). The resolution log is
 * surfaced on `provider` for the caller's debugging.
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

import type { IntegrationProvider } from '@prisma/client';
import { withSystemContext } from '@/lib/db/rls';
import type { CalendarEvent } from '../chief-of-staff-scheduler/types';
import { skillError, skillOk, type SkillResult } from '../types';
import { GoogleCalendarFetcher } from './google-calendar-fetcher';
import { OutlookCalendarFetcher } from './outlook-calendar-fetcher';
import type { CalendarFetcher, CalendarFetcherInput } from './types';

export interface CalendarMultiplexFetcherConfig {
  workspaceId: string;
  /** Optional override for tests — when present, the multiplexer SKIPS
   *  the IntegrationCredential lookup and uses these fetchers directly.
   *  Production passes nothing here. */
  testGoogle?: CalendarFetcher | null;
  testOutlook?: CalendarFetcher | null;
  /** Optional override for tests — when present, the lookup returns this
   *  value instead of querying Prisma. */
  testProviders?: ReadonlyArray<IntegrationProvider>;
}

/**
 * Active calendar providers for a workspace. Surfaced separately from
 * the fetch so the agents page can render "live" vs "connect to activate"
 * without firing a full calendar read.
 */
export interface CalendarConnectorState {
  workspaceId: string;
  hasGoogle: boolean;
  hasM365: boolean;
}

export async function getCalendarConnectorState(
  workspaceId: string,
): Promise<CalendarConnectorState> {
  const rows = await withSystemContext((tx) =>
    tx.integrationCredential.findMany({
      where: {
        workspaceId,
        status: 'ACTIVE',
        provider: { in: ['GOOGLE', 'M365'] },
      },
      select: { provider: true },
    }),
  );
  const providers = new Set(rows.map((r) => r.provider));
  return {
    workspaceId,
    hasGoogle: providers.has('GOOGLE'),
    hasM365: providers.has('M365'),
  };
}

export class CalendarMultiplexFetcher implements CalendarFetcher {
  readonly name = 'multiplex' as const;
  /** Provider populated lazily on the first call; null when neither
   *  Google nor M365 is connected. */
  provider: 'google' | 'm365' | null = null;
  private readonly workspaceId: string;
  private readonly testGoogle: CalendarFetcher | null;
  private readonly testOutlook: CalendarFetcher | null;
  private readonly testProviders: ReadonlyArray<IntegrationProvider> | null;

  constructor(config: CalendarMultiplexFetcherConfig) {
    if (!config.workspaceId) {
      throw new Error('CalendarMultiplexFetcher: workspaceId is required');
    }
    this.workspaceId = config.workspaceId;
    this.testGoogle = config.testGoogle ?? null;
    this.testOutlook = config.testOutlook ?? null;
    this.testProviders = config.testProviders ?? null;
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
    const providers = await this.resolveProviders();
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
    return skillError(
      'NOT_CONFIGURED',
      `No active GOOGLE or M365 IntegrationCredential for workspace ${this.workspaceId}. Connect Google Calendar or Outlook to activate the scheduler.`,
    );
  }

  private async resolveProviders(): Promise<ReadonlyArray<IntegrationProvider>> {
    if (this.testProviders !== null) return this.testProviders;
    const rows = await withSystemContext((tx) =>
      tx.integrationCredential.findMany({
        where: {
          workspaceId: this.workspaceId,
          status: 'ACTIVE',
          provider: { in: ['GOOGLE', 'M365'] },
        },
        select: { provider: true },
      }),
    );
    return rows.map((r) => r.provider);
  }
}
