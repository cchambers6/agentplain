/**
 * lib/skills/process-doc-drafter-general/multiplex-fetcher.ts
 *
 * Multiplexer routing to GmailProcessDocFetcher or
 * OutlookProcessDocFetcher based on the workspace's active
 * IntegrationCredential. Mirrors `../follow-up-chaser-general/multiplex-
 * fetcher.ts` one-for-one.
 *
 * Resolution order: Google → M365 → NOT_CONFIGURED.
 *
 * Per `feedback_cold_start_safe_agents.md`: re-reads credentials on
 * every call.
 *
 * Per `feedback_no_silent_vendor_lock.md`: imports the per-provider
 * fetcher classes only.
 */

import type { IntegrationProvider } from '@prisma/client';
import { withSystemContext } from '@/lib/db/rls';
import { skillError, type SkillResult } from '../types';
import { GmailProcessDocFetcher } from './gmail-fetcher';
import { OutlookProcessDocFetcher } from './outlook-fetcher';
import type { ProcessDocFetcher, ProcessDocSnapshot } from './types';

export interface ProcessDocMultiplexFetcherConfig {
  workspaceId: string;
  testGoogle?: ProcessDocFetcher | null;
  testOutlook?: ProcessDocFetcher | null;
  testCredentials?: ReadonlyArray<{
    provider: IntegrationProvider;
    accountEmail: string;
  }>;
}

interface CredentialRow {
  provider: IntegrationProvider;
  accountEmail: string;
}

export interface ProcessDocConnectorState {
  workspaceId: string;
  hasGoogle: boolean;
  hasM365: boolean;
}

export async function getProcessDocConnectorState(
  workspaceId: string,
): Promise<ProcessDocConnectorState> {
  const rows = await loadActiveEmailCredentials(workspaceId);
  const providers = new Set(rows.map((r) => r.provider));
  return {
    workspaceId,
    hasGoogle: providers.has('GOOGLE'),
    hasM365: providers.has('M365'),
  };
}

export class ProcessDocMultiplexFetcher implements ProcessDocFetcher {
  readonly name = 'process-doc-multiplex' as const;
  provider: 'google' | 'm365' | null = null;
  private readonly workspaceId: string;
  private readonly testGoogle: ProcessDocFetcher | null;
  private readonly testOutlook: ProcessDocFetcher | null;
  private readonly testCredentials: ReadonlyArray<CredentialRow> | null;

  constructor(config: ProcessDocMultiplexFetcherConfig) {
    if (!config.workspaceId) {
      throw new Error('ProcessDocMultiplexFetcher: workspaceId is required');
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
  }): Promise<SkillResult<ProcessDocSnapshot>> {
    if (args.workspaceId !== this.workspaceId) {
      return skillError(
        'INVALID_INPUT',
        `ProcessDocMultiplexFetcher workspaceId mismatch: bound=${this.workspaceId}, asked=${args.workspaceId}`,
      );
    }
    const credentials = await this.resolveCredentials();
    const google = credentials.find((c) => c.provider === 'GOOGLE');
    if (google) {
      this.provider = 'google';
      const fetcher =
        this.testGoogle ??
        new GmailProcessDocFetcher({
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
        new OutlookProcessDocFetcher({
          workspaceId: this.workspaceId,
          operatorEmails: [m365.accountEmail],
        });
      return fetcher.fetchSnapshot(args);
    }
    this.provider = null;
    return skillError(
      'NOT_CONFIGURED',
      `No active GOOGLE or M365 IntegrationCredential for workspace ${this.workspaceId}. Connect Gmail or Outlook to activate the process-doc drafter.`,
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

export const __testing = {
  loadActiveEmailCredentials,
};
