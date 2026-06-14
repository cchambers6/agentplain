/**
 * lib/onboarding/demo-seed.ts
 *
 * The DB seam for the "first 5 minutes" demo substrate. Demo records ride on
 * `KnowledgeDocument` (the existing workspace-scoped customer-data table) with
 * `contextKind = CUSTOMER` and a `metadata.isDemo = true` flag. Two deliberate
 * design choices:
 *
 *   1. NO new table → no new migration, no new RLS policy. KnowledgeDocument
 *      already enforces workspace isolation and is the closest existing home
 *      for "records about this workspace's customers."
 *   2. NO Embedding rows are written for demo docs. The RAG retrieval path
 *      queries the Embedding table; a KnowledgeDocument with no embedding is
 *      inert storage. So demo data NEVER pollutes real retrieval — it exists
 *      only to give the activation run something concrete to act on, and to
 *      render on the welcome surface.
 *
 * Every demo doc is flagged so it can be (a) clearly badged in the UI, (b)
 * cleared in one click, and (c) auto-cleared the moment real customer data
 * lands — and so it never counts toward real metrics.
 *
 * Cold-start safe (feedback_cold_start_safe_agents): the full DemoRecord is
 * stored in metadata, so the activation run rebuilds the draft from the DB row
 * alone, with no dependency on the in-memory dataset version.
 */

import type { Prisma } from '@prisma/client';
import type { Vertical } from '@prisma/client';
import { withSystemContext } from '../db/rls';
import { demoDatasetFor, type DemoRecord } from './demo-data';

/** Stable marker stored on every demo doc's metadata. */
export const DEMO_SOURCE = 'first-five-min-activation';

/** Real customer-record threshold at which seeded demo data auto-clears. */
export const AUTO_CLEAR_REAL_RECORD_THRESHOLD = 5;

export interface SeededDemoRecord extends DemoRecord {
  /** The KnowledgeDocument.id this record was persisted as. */
  knowledgeDocumentId: string;
}

interface MaybeTx {
  /** Caller-supplied transaction client. When present the work runs inline
   *  (e.g. inside the signup transaction); otherwise a system-context
   *  transaction is opened. */
  tx?: Prisma.TransactionClient;
}

function run<T>(
  tx: Prisma.TransactionClient | undefined,
  fn: (client: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return tx ? fn(tx) : withSystemContext(fn);
}

/**
 * Seed the per-vertical demo dataset for a workspace. Idempotent: if any demo
 * doc already exists for the workspace, this is a no-op and returns 0. Returns
 * the number of demo records written.
 */
export async function seedDemoData(args: {
  workspaceId: string;
  vertical: Vertical | null;
  tx?: Prisma.TransactionClient;
}): Promise<number> {
  const dataset = demoDatasetFor(args.vertical);
  return run(args.tx, async (client) => {
    const existing = await client.knowledgeDocument.count({
      where: demoWhere(args.workspaceId),
    });
    if (existing > 0) return 0;

    const rows: Prisma.KnowledgeDocumentCreateManyInput[] = dataset.records.map(
      (record) => ({
        contextKind: 'CUSTOMER',
        workspaceId: args.workspaceId,
        title: record.title,
        body: demoBody(record),
        metadata: {
          isDemo: true,
          source: DEMO_SOURCE,
          demoRecord: record as unknown as Prisma.InputJsonValue,
        } satisfies Prisma.InputJsonValue,
      }),
    );
    await client.knowledgeDocument.createMany({ data: rows });
    return rows.length;
  });
}

/**
 * Remove every demo doc for a workspace AND the activation artifacts it
 * produced (the ACTIVATION_DRAFT queue item + its DRAFTED SkillRun), so the
 * sample data leaves no trace in the queue, the activity feed, or the
 * scorecards. Returns the number of demo docs deleted. Safe to call when none
 * exist (returns 0).
 *
 * The literals `'ACTIVATION_DRAFT'` / `'activation-first-action'` mirror
 * lib/onboarding/activation-run.ts; they're inlined here only to avoid an
 * import cycle (activation-run imports this module).
 */
export async function clearDemoData(args: {
  workspaceId: string;
  tx?: Prisma.TransactionClient;
}): Promise<number> {
  return run(args.tx, async (client) => {
    // Delete the activation SkillRun first (its queueItemId FK is SetNull, so
    // order isn't strictly required, but this keeps the feed clean atomically).
    await client.skillRun.deleteMany({
      where: { workspaceId: args.workspaceId, skillSlug: 'activation-first-action' },
    });
    await client.workApprovalQueueItem.deleteMany({
      where: { workspaceId: args.workspaceId, kind: 'ACTIVATION_DRAFT' },
    });
    const res = await client.knowledgeDocument.deleteMany({
      where: demoWhere(args.workspaceId),
    });
    return res.count;
  });
}

/** Count the workspace's remaining demo docs. */
export async function countDemoRecords(
  workspaceId: string,
  opts: MaybeTx = {},
): Promise<number> {
  return run(opts.tx, (client) =>
    client.knowledgeDocument.count({ where: demoWhere(workspaceId) }),
  );
}

/**
 * Load the workspace's demo records with their KnowledgeDocument ids, parsed
 * back from metadata. Returns [] when none are seeded.
 */
export async function listDemoRecords(
  workspaceId: string,
  opts: MaybeTx = {},
): Promise<SeededDemoRecord[]> {
  const docs = await run(opts.tx, (client) =>
    client.knowledgeDocument.findMany({
      where: demoWhere(workspaceId),
      select: { id: true, metadata: true },
      orderBy: { createdAt: 'asc' },
    }),
  );
  const out: SeededDemoRecord[] = [];
  for (const doc of docs) {
    const record = parseDemoRecord(doc.metadata);
    if (record) out.push({ ...record, knowledgeDocumentId: doc.id });
  }
  return out;
}

/**
 * Count real (non-demo) CUSTOMER knowledge docs for a workspace — the signal
 * the auto-clear uses to know the first real integration sync has landed.
 */
export async function countRealCustomerRecords(
  workspaceId: string,
  opts: MaybeTx = {},
): Promise<number> {
  return run(opts.tx, (client) =>
    client.knowledgeDocument.count({
      where: {
        workspaceId,
        contextKind: 'CUSTOMER',
        NOT: { metadata: { path: ['isDemo'], equals: true } },
      },
    }),
  );
}

/**
 * Auto-clear demo data once real customer records have arrived. The mandate:
 * "auto-clears when first real integration syncs and pulls 5+ real records."
 *
 * Idempotent + cheap. Call it from the welcome surface load and from any
 * integration-sync write path; it only deletes when BOTH (a) demo docs exist
 * and (b) at least `AUTO_CLEAR_REAL_RECORD_THRESHOLD` real customer records are
 * present. Returns the number of demo docs cleared (0 when the condition isn't
 * met). Never throws — a best-effort cleanup must not break a sync.
 */
export async function autoClearDemoIfRealData(
  workspaceId: string,
  opts: MaybeTx = {},
): Promise<number> {
  try {
    const demoCount = await countDemoRecords(workspaceId, opts);
    if (demoCount === 0) return 0;
    const realCount = await countRealCustomerRecords(workspaceId, opts);
    if (realCount < AUTO_CLEAR_REAL_RECORD_THRESHOLD) return 0;
    return clearDemoData({ workspaceId, tx: opts.tx });
  } catch {
    return 0;
  }
}

// ─── internals ──────────────────────────────────────────────────────────────

function demoWhere(workspaceId: string): Prisma.KnowledgeDocumentWhereInput {
  return {
    workspaceId,
    contextKind: 'CUSTOMER',
    metadata: { path: ['isDemo'], equals: true },
  };
}

/** Human-readable body for the KnowledgeDocument (also what a future RAG
 *  pass would read if these were ever embedded — they are not). */
function demoBody(record: DemoRecord): string {
  const lines = [record.summary, '', ...record.contextLines];
  return lines.join('\n');
}

function parseDemoRecord(metadata: unknown): DemoRecord | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const m = metadata as Record<string, unknown>;
  if (m.isDemo !== true) return null;
  const raw = m.demoRecord;
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (
    typeof r.demoId !== 'string' ||
    typeof r.demoKind !== 'string' ||
    typeof r.title !== 'string' ||
    typeof r.summary !== 'string' ||
    !r.party ||
    typeof r.party !== 'object'
  ) {
    return null;
  }
  return raw as unknown as DemoRecord;
}
