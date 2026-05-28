/**
 * lib/skills/process-doc-drafter-general/outlook-fetcher.ts
 *
 * Outlook peer of `./gmail-fetcher.ts`. Same shape; mirrors the
 * follow-up-chaser's Outlook fetcher for cross-provider consistency.
 *
 * Per `feedback_no_silent_vendor_lock.md` / `feedback_runner_portability.md`:
 * two implementations of `ProcessDocFetcher` exist for production
 * (Gmail + Outlook); the multiplexer picks one per workspace.
 */

import {
  buildOutlookMcpServer,
  type OutlookMcpServer,
} from '@/lib/integrations/outlook-mcp';
import { skillError, skillOk, type SkillResult } from '../types';
import { parseThreadResource } from '../follow-up-chaser-general/gmail-fetcher';
import { buildPastActionFromMessage } from './gmail-fetcher';
import type {
  PastAction,
  ProcessDocFetcher,
  ProcessDocSnapshot,
} from './types';

export interface OutlookProcessDocFetcherConfig {
  workspaceId: string;
  operatorEmails: ReadonlyArray<string>;
  server?: OutlookMcpServer;
  maxThreads?: number;
}

const DEFAULT_MAX_THREADS = 100;

export class OutlookProcessDocFetcher implements ProcessDocFetcher {
  readonly name = 'outlook-process-doc' as const;
  readonly provider = 'm365' as const;
  private readonly workspaceId: string;
  private readonly server: OutlookMcpServer;
  private readonly operatorEmails: ReadonlySet<string>;
  private readonly maxThreads: number;

  constructor(config: OutlookProcessDocFetcherConfig) {
    if (!config.workspaceId) {
      throw new Error('OutlookProcessDocFetcher: workspaceId is required');
    }
    if (!config.operatorEmails || config.operatorEmails.length === 0) {
      throw new Error(
        'OutlookProcessDocFetcher: operatorEmails is required (we do not guess the operator address)',
      );
    }
    this.workspaceId = config.workspaceId;
    this.server =
      config.server ?? buildOutlookMcpServer({ workspaceId: config.workspaceId });
    this.operatorEmails = new Set(
      config.operatorEmails.map((e) => e.trim().toLowerCase()),
    );
    this.maxThreads = config.maxThreads ?? DEFAULT_MAX_THREADS;
  }

  async fetchSnapshot(args: {
    workspaceId: string;
    asOf: Date;
    lookbackDays: number;
  }): Promise<SkillResult<ProcessDocSnapshot>> {
    if (args.workspaceId !== this.workspaceId) {
      return skillError(
        'INVALID_INPUT',
        `OutlookProcessDocFetcher workspaceId mismatch: bound=${this.workspaceId}, asked=${args.workspaceId}`,
      );
    }
    if (args.lookbackDays <= 0) {
      return skillError(
        'INVALID_INPUT',
        `lookbackDays must be > 0; got ${args.lookbackDays}`,
      );
    }
    const sinceIso = new Date(
      args.asOf.getTime() - args.lookbackDays * 24 * 60 * 60 * 1000,
    ).toISOString();
    const query = `sent receivedDateTime ge ${sinceIso}`;
    const threads = await this.server.searchThreads({
      query,
      maxResults: this.maxThreads,
    });
    if (!threads.ok) {
      if (threads.error.code === 'CREDENTIAL_NOT_FOUND') {
        return skillError(
          'NOT_CONFIGURED',
          `Outlook credential not connected for workspace ${this.workspaceId}.`,
          threads.error.code,
        );
      }
      return skillError(
        'UPSTREAM_GMAIL_ERROR',
        `Outlook searchThreads failed: ${threads.error.message}`,
        threads.error.code,
      );
    }

    const pastActions: PastAction[] = [];
    for (const t of threads.value.threads) {
      if (!t.id) continue;
      const uri = `outlook://workspace/${this.workspaceId}/threads/${t.id}`;
      const resource = await this.server.readResource({ uri });
      if (!resource.ok) {
        if (resource.error.code === 'NOT_FOUND') continue;
        return skillError(
          'UPSTREAM_GMAIL_ERROR',
          `Outlook readResource (thread ${t.id}) failed: ${resource.error.message}`,
          resource.error.code,
        );
      }
      const parsed = parseThreadResource(resource.value.text);
      if (!parsed) continue;
      for (const msg of parsed.messages) {
        const action = buildPastActionFromMessage({
          message: msg,
          operatorEmails: this.operatorEmails,
        });
        if (action) pastActions.push(action);
      }
    }
    return skillOk({ pastActions, existingProcessDocs: [] });
  }
}
