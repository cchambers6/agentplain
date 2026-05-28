/**
 * lib/skills/follow-up-chaser-general/outlook-fetcher.ts
 *
 * Symmetric peer of `./gmail-fetcher.ts`. Pulls operator-sent threads
 * from Outlook via the existing Outlook MCP server's `searchThreads` +
 * `readResource` tools. No new tools added on the Microsoft Graph side —
 * the same DTOs that drive the inbox triage pipeline drive this.
 *
 * Outlook query mapping:
 *   - Gmail's `in:sent newer_than:Nd` maps to a `Sent Items` folder
 *     filter + the test impl's bare `sent` token. The prod Outlook MCP
 *     server accepts Microsoft Graph's `$search` / `$filter` grammar;
 *     the cron passes a portable token that both impls recognize.
 *
 * Per `feedback_no_silent_vendor_lock.md`: imports the Outlook MCP
 * interface only. Direct Microsoft Graph calls live in `lib/
 * integrations/outlook-mcp/server.ts`.
 *
 * Per `feedback_cold_start_safe_agents.md` + `project_no_outbound_architecture.md`:
 * read-only, cold-start safe, no caching across calls.
 *
 * Per `feedback_runner_portability.md`: two implementations of
 * `FollowUpFetcher` exist for production (Gmail + Outlook); the
 * multiplexer (`./multiplex-fetcher.ts`) picks one per workspace.
 */

import {
  buildOutlookMcpServer,
  type OutlookMcpServer,
} from '@/lib/integrations/outlook-mcp';
import { skillError, skillOk, type SkillResult } from '../types';
import {
  buildOutboundThreadFromMessages,
  parseThreadResource,
} from './gmail-fetcher';
import type { FollowUpFetcher, FollowUpSnapshot, OutboundThread } from './types';

export interface OutlookFollowUpFetcherConfig {
  workspaceId: string;
  operatorEmails: ReadonlyArray<string>;
  server?: OutlookMcpServer;
  maxThreads?: number;
}

const DEFAULT_MAX_THREADS = 100;

export class OutlookFollowUpFetcher implements FollowUpFetcher {
  readonly name = 'outlook-follow-up' as const;
  readonly provider = 'm365' as const;
  private readonly workspaceId: string;
  private readonly server: OutlookMcpServer;
  private readonly operatorEmails: ReadonlySet<string>;
  private readonly maxThreads: number;

  constructor(config: OutlookFollowUpFetcherConfig) {
    if (!config.workspaceId) {
      throw new Error('OutlookFollowUpFetcher: workspaceId is required');
    }
    if (!config.operatorEmails || config.operatorEmails.length === 0) {
      throw new Error(
        'OutlookFollowUpFetcher: operatorEmails is required (we do not guess the operator address)',
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
  }): Promise<SkillResult<FollowUpSnapshot>> {
    if (args.workspaceId !== this.workspaceId) {
      return skillError(
        'INVALID_INPUT',
        `OutlookFollowUpFetcher workspaceId mismatch: bound=${this.workspaceId}, asked=${args.workspaceId}`,
      );
    }
    if (args.lookbackDays <= 0) {
      return skillError(
        'INVALID_INPUT',
        `lookbackDays must be > 0; got ${args.lookbackDays}`,
      );
    }
    // Portable token both impls understand. Prod Outlook server maps
    // `sent` → `parentFolderId eq <Sent Items>` and folds the lookback
    // window into a `receivedDateTime ge <iso>` $filter clause.
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

    const outbound: OutboundThread[] = [];
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
      const thread = buildOutboundThreadFromMessages({
        threadId: parsed.id ?? t.id,
        messages: parsed.messages,
        operatorEmails: this.operatorEmails,
      });
      if (thread) outbound.push(thread);
    }
    return skillOk({ outbound });
  }
}
