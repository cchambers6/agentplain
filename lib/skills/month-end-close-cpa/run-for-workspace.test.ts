/**
 * lib/skills/month-end-close-cpa/run-for-workspace.test.ts
 *
 * End-to-end tests for the CPA close production wrapper (pfd-8). Drives the
 * real skill through a fixture QuickBooks MCP + a recording DraftPersister,
 * proving the workspace-level caller enumerates clients and produces
 * approval-queue drafts — the value a paying CPA workspace now receives.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  priorMonth,
  runMonthEndCloseForWorkspace,
} from './run-for-workspace';
import { TestQuickbooksMcpServer } from '@/lib/integrations/quickbooks-mcp';
import { skillOk, type DraftPersister, type SkillResult } from '../types';

const WS = 'ws-cpa-1';
const NOW = new Date('2026-06-01T05:00:00Z');

class RecordingPersister implements DraftPersister {
  readonly name = 'recording' as const;
  readonly drafts: Array<{ subject: string; body: string; threadId: string }> = [];
  async persistDraft(args: {
    workspaceId: string;
    threadId: string;
    inReplyToMessageId: string | null;
    toEmails: string[];
    subject: string;
    body: string;
  }): Promise<SkillResult<{ providerDraftId: string }>> {
    this.drafts.push({ subject: args.subject, body: args.body, threadId: args.threadId });
    return skillOk({ providerDraftId: `rec-${this.drafts.length}` });
  }
}

describe('priorMonth', () => {
  it('returns the prior calendar month in YYYY-MM (UTC)', () => {
    assert.equal(priorMonth(new Date('2026-06-01T00:00:00Z')), '2026-05');
    assert.equal(priorMonth(new Date('2026-01-15T00:00:00Z')), '2025-12');
  });
});

describe('runMonthEndCloseForWorkspace — enumerates clients + drafts', () => {
  it('preps a client with an email on file and stages chase + status drafts', async () => {
    const persister = new RecordingPersister();
    const result = await runMonthEndCloseForWorkspace({
      workspaceId: WS,
      now: NOW,
      listClients: async () => ({
        ok: true,
        clients: [
          // '1' (Acme Roofing) exists in the fixture MCP WITH an email → preps.
          { clientId: '1', hasEmail: true },
          // Up-front no-email skip (does not reach the skill).
          { clientId: 'no-email', hasEmail: false },
        ],
      }),
      buildPersister: () => persister,
      mcp: new TestQuickbooksMcpServer({ workspaceId: WS }),
    });

    assert.equal(result.notConfigured, false);
    assert.equal(result.clientsConsidered, 2);
    assert.equal(result.clientsSkippedNoEmail, 1);
    // Client '1' resolves an engagement → the close preps (NOT a silent no-op).
    assert.equal(result.clientsPrepped, 1);
    assert.equal(result.failures.length, 0);
    assert.equal(result.periodMonth, '2026-05');
    // The recording persister captured at least the chase + status drafts.
    assert.ok(persister.drafts.length >= 1, 'close staged at least one draft');
  });

  it('QuickBooks not connected → notConfigured, no throw', async () => {
    const result = await runMonthEndCloseForWorkspace({
      workspaceId: WS,
      now: NOW,
      listClients: async () => ({
        ok: false,
        notConfigured: true,
        message: 'QuickBooks not connected',
      }),
      buildPersister: () => new RecordingPersister(),
    });
    assert.equal(result.notConfigured, true);
    assert.equal(result.clientsConsidered, 0);
    assert.equal(result.failures.length, 0);
  });

  it('defaults the period to the prior month when not supplied', async () => {
    const result = await runMonthEndCloseForWorkspace({
      workspaceId: WS,
      now: new Date('2026-03-01T05:00:00Z'),
      listClients: async () => ({ ok: true, clients: [] }),
      buildPersister: () => new RecordingPersister(),
    });
    assert.equal(result.periodMonth, '2026-02');
  });
});
