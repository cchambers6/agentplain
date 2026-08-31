/**
 * lib/skills/finance-pulse-general/activity-snapshot.test.ts
 *
 * REGRESSION (2026-08-30): `invoiceChaseDrafts` counted
 * `agentSlug: 'invoice-chasing-realestate'` — a schema-only catalog entry with
 * no Prisma sink, no sweep row, and no production caller. The producer that
 * actually fires is `invoice-chase-general`, whose sink writes
 * `INVOICE_CHASE_GENERAL_AGENT_SLUG`. So the weekly pulse rendered
 * "Invoice-chase drafts produced: 0" on every workspace, always, while the
 * SAME rows were being counted correctly one query down by
 * `financeApprovalsPending` (which filters `discipline: 'finance'`).
 *
 * That last part is what makes this provable without a database: seed one row
 * from the REAL sink and the two counters disagree. `financeApprovalsPending`
 * sees it; `invoiceChaseDrafts` does not.
 *
 * The rows here are built by `buildApprovalRow` imported from the sink itself,
 * not hand-written. A hand-written fixture would pin today's string and would
 * have passed against the bug.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// The sink encrypts its payload envelope, so the row builder needs a key.
// Same shape as lib/memory/byo-storage.test.ts — never clobber a real one.
process.env.ENCRYPTION_KEY =
  process.env.ENCRYPTION_KEY ??
  '0'.repeat(64);

import { buildFinancePulseSnapshot } from './activity-snapshot';
import {
  buildApprovalRow,
  INVOICE_CHASE_GENERAL_AGENT_SLUG,
} from '../invoice-chase-general/prisma-approval-sink';
import type { InvoiceChaseDraft } from '../invoice-chase-general/types';

const WORKSPACE_ID = 'ws-finance-snapshot-001';
const NOW = new Date('2026-06-08T13:00:00.000Z');
const IN_WINDOW = new Date('2026-06-05T09:00:00.000Z'); // 3 days back

function draft(id: string): InvoiceChaseDraft {
  return {
    draftId: id,
    invoiceId: `inv-${id}`,
    docNumber: '1042',
    customerName: 'Northwind Partners',
    customerEmail: 'ap@northwind.example',
    balanceUsd: 4250,
    daysOverdue: 21,
    tier: 'firm',
    subject: 'Invoice 1042 — following up',
    body: 'Hi {{operator: name}}, checking in on invoice 1042.',
    confidence: 0.82,
    reasoning: '21 days overdue; firm tier.',
  };
}

/** A `WorkApprovalQueueItem` row as it exists at rest. */
interface Row {
  workspaceId: string;
  agentSlug: string;
  discipline: string | null;
  status: string;
  proposedAt: Date;
  decidedAt: Date | null;
}

/** One row per draft, with agentSlug + discipline taken from the production
 *  sink's own row builder. */
function sinkRows(...drafts: InvoiceChaseDraft[]): Row[] {
  return drafts.map((d) => {
    const built = buildApprovalRow(WORKSPACE_ID, d);
    return {
      workspaceId: built.workspaceId,
      agentSlug: built.agentSlug,
      discipline: built.discipline ?? null,
      status: built.status ?? 'PENDING',
      proposedAt: IN_WINDOW,
      decidedAt: null,
    };
  });
}

/** The narrow slice of Prisma `where` that `readInternal` actually uses. */
function matches(row: Row, where: Record<string, unknown>): boolean {
  for (const [field, condition] of Object.entries(where)) {
    const value = (row as unknown as Record<string, unknown>)[field];
    if (condition === null || typeof condition !== 'object') {
      if (value !== condition) return false;
      continue;
    }
    const c = condition as { gte?: Date; in?: readonly string[] };
    if (c.gte !== undefined) {
      if (!(value instanceof Date) || value < c.gte) return false;
    }
    if (c.in !== undefined) {
      if (typeof value !== 'string' || !c.in.includes(value)) return false;
    }
  }
  return true;
}

function fakeSystemContext(rows: Row[]) {
  const tx = {
    workspace: {
      findUnique: async () => ({
        id: WORKSPACE_ID,
        name: 'Northwind CPA',
        vertical: 'cpa',
      }),
    },
    workApprovalQueueItem: {
      count: async (args: { where: Record<string, unknown> }) =>
        rows.filter((r) => matches(r, args.where)).length,
    },
    preferenceSignal: { count: async () => 0 },
  };
  return async <T>(fn: (t: never) => Promise<T>): Promise<T> =>
    fn(tx as never);
}

function snapshotWith(rows: Row[]) {
  return buildFinancePulseSnapshot({
    workspaceId: WORKSPACE_ID,
    now: NOW,
    systemContext: fakeSystemContext(rows),
    buildQuickbooksMcp: null,
  });
}

describe('finance-pulse activity snapshot — invoice-chase attribution', () => {
  it('counts rows the invoice-chase sink actually wrote', async () => {
    const snapshot = await snapshotWith(sinkRows(draft('d1'), draft('d2')));

    assert.equal(
      snapshot.internal.invoiceChaseDrafts,
      2,
      `invoiceChaseDrafts must count rows carrying the slug the invoice-chase ` +
        `sink writes ("${INVOICE_CHASE_GENERAL_AGENT_SLUG}"). Reading 0 here ` +
        `means the counter filters a slug no sink produces — the weekly pulse ` +
        `then renders "Invoice-chase drafts produced: 0" on every workspace.`,
    );
  });

  it('the two counters agree: a row the discipline filter sees, the slug filter sees', async () => {
    const rows = sinkRows(draft('d1'));
    const snapshot = await snapshotWith(rows);

    // `financeApprovalsPending` filters `discipline: 'finance'`, which the sink
    // sets from SKILL_DISCIPLINE. It has always counted these rows correctly.
    assert.equal(snapshot.internal.financeApprovalsPending, 1);
    assert.equal(
      snapshot.internal.invoiceChaseDrafts,
      snapshot.internal.financeApprovalsPending,
      'the same pending invoice-chase row is visible to the discipline filter ' +
        'but invisible to the agentSlug filter — the two disagree about one row ' +
        'in one table, which is only possible if the slug filter is wrong',
    );
  });

  it('does not count a foreign slug (the filter still discriminates)', async () => {
    const rows = sinkRows(draft('d1'));
    const foreign: Row[] = [
      { ...rows[0], agentSlug: 'some-other-skill', discipline: 'operations' },
    ];
    const snapshot = await snapshotWith(foreign);
    assert.equal(snapshot.internal.invoiceChaseDrafts, 0);
  });

  it('excludes rows proposed before the window', async () => {
    const rows = sinkRows(draft('d1')).map((r) => ({
      ...r,
      proposedAt: new Date('2026-05-01T09:00:00.000Z'),
    }));
    const snapshot = await snapshotWith(rows);
    assert.equal(snapshot.internal.invoiceChaseDrafts, 0);
  });
});
