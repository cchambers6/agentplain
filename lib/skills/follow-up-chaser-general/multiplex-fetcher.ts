/**
 * lib/skills/follow-up-chaser-general/multiplex-fetcher.ts
 *
 * Multiplexer that routes to GmailFollowUpFetcher when the workspace
 * has an ACTIVE Google credential, OutlookFollowUpFetcher when it has
 * an ACTIVE M365 credential, and returns `NOT_CONFIGURED` cleanly when
 * neither is connected. Mirrors `lib/skills/scheduler/calendar-multiplex-
 * fetcher.ts` one-for-one.
 *
 * Resolution order:
 *   1. ACTIVE GOOGLE → GmailFollowUpFetcher
 *   2. ACTIVE M365   → OutlookFollowUpFetcher
 *   3. Neither       → skillError('NOT_CONFIGURED', …)
 *
 * Per `feedback_no_silent_vendor_lock.md`: imports the per-provider
 * fetcher CLASSES (not the SDKs). Provider choice is data, not a build-
 * time decision.
 *
 * Per `feedback_cold_start_safe_agents.md`: re-reads
 * IntegrationCredential rows on every call. No in-memory cache of
 * "which provider this workspace uses."
 *
 * Per `project_no_outbound_architecture.md`: read-only — the multiplexer
 * just selects a fetcher; no fetcher writes outbound.
 *
 * Per `feedback_no_guesses_no_estimates.md`: the operator's own email is
 * derived from `IntegrationCredential.accountEmail` (the field already
 * stored when the OAuth flow lands). The multiplexer passes that
 * through; the per-provider fetcher refuses to run with an empty list.
 */

import type { IntegrationProvider } from '@prisma/client';
import { withSystemContext } from '@/lib/db/rls';
import { skillError, type SkillResult } from '../types';
import { GmailFollowUpFetcher } from './gmail-fetcher';
import { OutlookFollowUpFetcher } from './outlook-fetcher';
import type { FollowUpFetcher, FollowUpSnapshot } from './types';

export interface FollowUpMultiplexFetcherConfig {
  workspaceId: string;
  /** Test override — when present, the multiplexer SKIPS the
   *  IntegrationCredential lookup and uses these fetchers directly.
   *  Production passes nothing here. */
  testGoogle?: FollowUpFetcher | null;
  testOutlook?: FollowUpFetcher | null;
  /** Test override — when present, returns this value instead of
   *  querying Prisma. Each entry is `{ provider, accountEmail }`. */
  testCredentials?: ReadonlyArray<{
    provider: IntegrationProvider;
    accountEmail: string;
  }>;
}

interface CredentialRow {
  provider: IntegrationProvider;
  accountEmail: string;
}

/** Cross-skill helper exported for the cron sweep — same shape returned
 *  by `getCalendarConnectorState`. */
export interface FollowUpConnectorState {
  workspaceId: string;
  hasGoogle: boolean;
  hasM365: boolean;
}

export async function getFollowUpConnectorState(
  workspaceId: string,
): Promise<FollowUpConnectorState> {
  const rows = await loadActiveEmailCredentials(workspaceId);
  const providers = new Set(rows.map((r) => r.provider));
  return {
    workspaceId,
    hasGoogle: providers.has('GOOGLE'),
    hasM365: providers.has('M365'),
  };
}

export class FollowUpMultiplexFetcher implements FollowUpFetcher {
  readonly name = 'follow-up-multiplex' as const;
  /** Provider populated lazily on the first call; null when neither
   *  Google nor M365 is connected. */
  provider: 'google' | 'm365' | null = null;
  private readonly workspaceId: string;
  private readonly testGoogle: FollowUpFetcher | null;
  private readonly testOutlook: FollowUpFetcher | null;
  private readonly testCredentials: ReadonlyArray<CredentialRow> | null;

  constructor(config: FollowUpMultiplexFetcherConfig) {
    if (!config.workspaceId) {
      throw new Error('FollowUpMultiplexFetcher: workspaceId is required');
    }
    this.workspaceId = config.workspaceId;
    this.testGoogle = config.testGoogle ?? null;
    this.testOutlook = config.testOutlook ?? null;
    this.testCredentials = config.testCredentials ?? null;
  }

  async fetchSnapshot(args: {
    workspaceId: string;
    asOf: Date;
    lookbackDays: number;
  }): Promise<SkillResult<FollowUpSnapshot>> {
    if (args.workspaceId !== this.workspaceId) {
      return skillError(
        'INVALID_INPUT',
        `FollowUpMultiplexFetcher workspaceId mismatch: bound=${this.workspaceId}, asked=${args.workspaceId}`,
      );
    }
    const credentials = await this.resolveCredentials();
    const google = credentials.find((c) => c.provider === 'GOOGLE');
    if (google) {
      this.provider = 'google';
      const fetcher =
        this.testGoogle ??
        new GmailFollowUpFetcher({
          workspaceId: this.workspaceId,
          operatorEmails: [google.accountEmail],
        });
      return fetcher.fetchSnapshot(args);
    }
    const m365 = credentials.find((c) => c.provider === 'M365');
    if (m365) {
      this.provider = 'm365';
      const fetcher =
        this.testOutlook ??
        new OutlookFollowUpFetcher({
          workspaceId: this.workspaceId,
          operatorEmails: [m365.accountEmail],
        });
      return fetcher.fetchSnapshot(args);
    }
    this.provider = null;
    return skillError(
      'NOT_CONFIGURED',
      `No active GOOGLE or M365 IntegrationCredential for workspace ${this.workspaceId}. Connect Gmail or Outlook to activate the follow-up chaser.`,
    );
  }

  private async resolveCredentials(): Promise<ReadonlyArray<CredentialRow>> {
    if (this.testCredentials !== null) return this.testCredentials;
    return loadActiveEmailCredentials(this.workspaceId);
  }
}

async function loadActiveEmailCredentials(
  workspaceId: string,
): Promise<CredentialRow[]> {
  return withSystemContext(async (tx) => {
    const rows = await tx.integrationCredential.findMany({
      where: {
        workspaceId,
        status: 'ACTIVE',
        provider: { in: ['GOOGLE', 'M365'] },
      },
      select: { provider: true, accountEmail: true },
    });
    return rows
      .filter((r): r is { provider: IntegrationProvider; accountEmail: string } =>
        typeof r.accountEmail === 'string' && r.accountEmail.length > 0,
      )
      .map((r) => ({ provider: r.provider, accountEmail: r.accountEmail }));
  });
}

/** Exposed for tests so the lookup can be exercised without standing
 *  up the full multiplexer. */
export const __testing = {
  loadActiveEmailCredentials,
};
