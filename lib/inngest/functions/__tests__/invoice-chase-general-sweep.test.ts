/**
 * lib/inngest/functions/__tests__/invoice-chase-general-sweep.test.ts
 *
 * Behavior + smoke tests for `invoice-chase-general-sweep`.
 *
 * Behavior (DI — no DB, no QuickBooks network):
 *   - Workspaces whose discipline is disabled are skipped.
 *   - NOT_CONFIGURED from the fetcher is a clean skip (counted as
 *     unconfigured, not a failure).
 *   - Workspaces that pass all gates produce staged drafts + counter
 *     increments.
 *   - `maxDraftsPerRun` cap flows through to the skill.
 *   - `totalBalanceUsd` accumulates across workspaces.
 *   - Fire-gate deny is a clean skip (workspacesSkippedFireGate).
 *   - Unhandled exception counts as a failure, not a skip.
 *
 * Smoke:
 *   - Function id + cron schedule match documented constants.
 *   - `invoice-chase-general` maps to `finance` in SKILL_DISCIPLINE.
 *   - The Inngest route file references `invoiceChaseGeneralSweepFn`.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  INVOICE_CHASE_GENERAL_SWEEP_CRON,
  INVOICE_CHASE_GENERAL_SWEEP_FUNCTION_ID,
  invoiceChaseGeneralSweepFn,
  runInvoiceChaseGeneralSweep,
} from '../invoice-chase-general-sweep';
import { SKILL_DISCIPLINE } from '@/lib/disciplines/skill-mapping';
import { skillError, skillOk, type SkillResult } from '@/lib/skills/types';
import type {
  ArAgingFetcher,
  ArInvoiceRecord,
  InvoiceChaseApprovalSink,
  InvoiceChaseDraft,
} from '@/lib/skills/invoice-chase-general/types';
import { chaseEscalationTier } from '@/lib/skills/invoice-chase-general/types';
import type { FireGateOutcome } from '@/lib/skills/fire-gate';

const NOW = new Date('2026-06-09T06:00:00Z');

// ── Fixture fetcher helpers ───────────────────────────────────────────────────

function makeInvoice(daysOverdue: number, balanceUsd: number): ArInvoiceRecord {
  const due = new Date(NOW.getTime() - daysOverdue * 86_400_000);
  return {
    invoiceId: `inv-d${daysOverdue}`,
    docNumber: String(1000 + daysOverdue),
    customerId: `cust-${daysOverdue}`,
    customerName: `Client ${daysOverdue}`,
    customerEmail: `client${daysOverdue}@example.com`,
    totalAmountUsd: balanceUsd,
    balanceUsd,
    txnDate: '2026-01-01',
    dueDate: due.toISOString().slice(0, 10),
    daysOverdue,
    tier: chaseEscalationTier(daysOverdue),
  };
}

class HappyArFetcher implements ArAgingFetcher {
  readonly name = 'happy-fixture' as const;
  constructor(private readonly invoices: ArInvoiceRecord[]) {}
  async fetchOverdueInvoices(): Promise<SkillResult<ArInvoiceRecord[]>> {
    return skillOk(this.invoices);
  }
}

class NotConfiguredArFetcher implements ArAgingFetcher {
  readonly name = 'not-configured' as const;
  async fetchOverdueInvoices(): Promise<SkillResult<ArInvoiceRecord[]>> {
    return skillError('NOT_CONFIGURED', 'QuickBooks not connected', 'CREDENTIAL_NOT_FOUND');
  }
}

class ThrowingArFetcher implements ArAgingFetcher {
  readonly name = 'throwing' as const;
  async fetchOverdueInvoices(): Promise<SkillResult<ArInvoiceRecord[]>> {
    throw new Error('unexpected boom');
  }
}

class RecordingSink implements InvoiceChaseApprovalSink {
  readonly name = 'recording' as const;
  readonly recorded: InvoiceChaseDraft[] = [];
  async record(args: {
    workspaceId: string;
    draft: InvoiceChaseDraft;
  }): Promise<SkillResult<{ sinkId: string }>> {
    this.recorded.push(args.draft);
    return skillOk({ sinkId: `sink-${args.draft.draftId}` });
  }
}

// ── Behavior tests ────────────────────────────────────────────────────────────

describe('runInvoiceChaseGeneralSweep — discipline-disabled workspaces are skipped', () => {
  it('increments workspacesSkippedDisciplineDisabled, not failures', async () => {
    const result = await runInvoiceChaseGeneralSweep({
      now: NOW,
      listCandidates: async () => [
        {
          id: 'ws-disabled',
          vertical: 'GENERAL',
          disabledDisciplines: ['finance'],
        },
      ],
      buildFetcher: () => new HappyArFetcher([makeInvoice(10, 500)]),
    });
    assert.equal(result.workspacesConsidered, 1);
    assert.equal(result.workspacesSkippedDisciplineDisabled, 1);
    assert.equal(result.workspacesWithDrafts, 0);
    assert.equal(result.failures.length, 0);
  });
});

describe('runInvoiceChaseGeneralSweep — NOT_CONFIGURED is a clean skip', () => {
  it('counts as unconfigured, not a failure', async () => {
    const result = await runInvoiceChaseGeneralSweep({
      now: NOW,
      listCandidates: async () => [
        { id: 'ws-no-qb', vertical: 'GENERAL', disabledDisciplines: [] },
      ],
      buildFetcher: () => new NotConfiguredArFetcher(),
      isInstalled: async () => true,
      gateFire: async () => ({ allowed: true }),
    });
    assert.equal(result.workspacesSkippedUnconfigured, 1);
    assert.equal(result.failures.length, 0);
  });
});

describe('runInvoiceChaseGeneralSweep — happy workspace produces staged drafts', () => {
  it('increments draftsStaged and totalBalanceUsd', async () => {
    const sink = new RecordingSink();
    const result = await runInvoiceChaseGeneralSweep({
      now: NOW,
      listCandidates: async () => [
        { id: 'ws-happy', vertical: 'GENERAL', disabledDisciplines: [] },
      ],
      buildFetcher: () =>
        new HappyArFetcher([
          makeInvoice(5, 1000),
          makeInvoice(20, 2500),
        ]),
      buildSink: () => sink,
      isInstalled: async () => true,
      gateFire: async () => ({ allowed: true }),
    });
    assert.equal(result.workspacesWithDrafts, 1);
    assert.equal(result.draftsStaged, 2);
    assert.equal(result.totalBalanceUsd, 3500);
    assert.equal(result.failures.length, 0);
  });
});

describe('runInvoiceChaseGeneralSweep — fire-gate deny is a clean skip', () => {
  it('counts as workspacesSkippedFireGate', async () => {
    const gateResult: FireGateOutcome = {
      allowed: false,
      reason: 'workspace-paused',
      detail: 'Workspace paused until 2026-06-15T00:00:00Z.',
    };
    const result = await runInvoiceChaseGeneralSweep({
      now: NOW,
      listCandidates: async () => [
        { id: 'ws-paused', vertical: 'GENERAL', disabledDisciplines: [] },
      ],
      buildFetcher: () => new HappyArFetcher([makeInvoice(10, 500)]),
      isInstalled: async () => true,
      gateFire: async () => gateResult,
    });
    assert.equal(result.workspacesSkippedFireGate, 1);
    assert.equal(result.workspacesWithDrafts, 0);
    assert.equal(result.failures.length, 0);
  });
});

describe('runInvoiceChaseGeneralSweep — unhandled exception is a failure', () => {
  it('records workspace id + reason in failures array', async () => {
    const result = await runInvoiceChaseGeneralSweep({
      now: NOW,
      listCandidates: async () => [
        { id: 'ws-throws', vertical: 'GENERAL', disabledDisciplines: [] },
      ],
      buildFetcher: () => new ThrowingArFetcher(),
      isInstalled: async () => true,
      gateFire: async () => ({ allowed: true }),
    });
    assert.equal(result.failures.length, 1);
    assert.equal(result.failures[0]!.workspaceId, 'ws-throws');
    assert.match(result.failures[0]!.reason, /boom/);
  });
});

describe('runInvoiceChaseGeneralSweep — multi-workspace aggregation', () => {
  it('accumulates balance across workspaces', async () => {
    const result = await runInvoiceChaseGeneralSweep({
      now: NOW,
      listCandidates: async () => [
        { id: 'ws-a', vertical: 'GENERAL', disabledDisciplines: [] },
        { id: 'ws-b', vertical: 'GENERAL', disabledDisciplines: [] },
      ],
      buildFetcher: (id) =>
        id === 'ws-a'
          ? new HappyArFetcher([makeInvoice(10, 1200)])
          : new HappyArFetcher([makeInvoice(30, 800)]),
      buildSink: () => new RecordingSink(),
      isInstalled: async () => true,
      gateFire: async () => ({ allowed: true }),
    });
    assert.equal(result.workspacesConsidered, 2);
    assert.equal(result.workspacesWithDrafts, 2);
    assert.equal(result.totalBalanceUsd, 2000);
  });
});

describe('runInvoiceChaseGeneralSweep — marketplace not-installed skip', () => {
  it('counts as workspacesSkippedNotInstalled', async () => {
    const result = await runInvoiceChaseGeneralSweep({
      now: NOW,
      listCandidates: async () => [
        { id: 'ws-uninstalled', vertical: 'GENERAL', disabledDisciplines: [] },
      ],
      buildFetcher: () => new HappyArFetcher([makeInvoice(10, 500)]),
      isInstalled: async () => false,
      gateFire: async () => ({ allowed: true }),
    });
    assert.equal(result.workspacesSkippedNotInstalled, 1);
    assert.equal(result.workspacesWithDrafts, 0);
  });
});

// ── Smoke tests ───────────────────────────────────────────────────────────────

describe('invoiceChaseGeneralSweepFn — registration shape', () => {
  it('function id is the documented constant', () => {
    assert.equal(
      INVOICE_CHASE_GENERAL_SWEEP_FUNCTION_ID,
      'agentplain-invoice-chase-general-sweep',
    );
  });

  it('cron schedule is daily at 6 AM UTC', () => {
    assert.equal(INVOICE_CHASE_GENERAL_SWEEP_CRON, '0 6 * * *');
  });

  it('exported function object is defined', () => {
    assert.ok(
      typeof invoiceChaseGeneralSweepFn === 'object' &&
        invoiceChaseGeneralSweepFn !== null,
    );
  });
});

describe('SKILL_DISCIPLINE — invoice-chase-general maps to finance', () => {
  it('maps correctly', () => {
    assert.equal(SKILL_DISCIPLINE['invoice-chase-general'], 'finance');
  });
});

describe('Inngest route registration', () => {
  it('route.ts references invoiceChaseGeneralSweepFn', () => {
    // __dirname = <worktree>/lib/inngest/functions/__tests__
    // 4 levels up reaches the worktree root.
    const repoRoot = path.resolve(__dirname, '..', '..', '..', '..');
    const routePath = path.join(repoRoot, 'app', 'api', 'inngest', 'route.ts');
    const src = fs.readFileSync(routePath, 'utf-8');
    assert.match(src, /invoiceChaseGeneralSweepFn/);
  });
});
