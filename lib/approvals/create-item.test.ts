/**
 * lib/approvals/create-item.test.ts
 *
 * Two kinds of enforcement, both structural:
 *
 *   1. THE DOOR HOLDS — a create attempted without a valid provenance
 *      block throws BEFORE the transaction is touched. Proven with a
 *      recording stub tx: on the rejection paths the stub records zero
 *      calls, so there is no partial write to clean up.
 *
 *   2. THE DOOR IS THE ONLY DOOR — a repo scan asserts that a direct
 *      `create` on the WorkApprovalQueueItem Prisma delegate appears in
 *      exactly one file across lib/, app/ and prisma/: create-item.ts
 *      itself. A future writer who adds a direct create fails CI instead
 *      of quietly re-introducing an unattributable row six months from
 *      now. (This file builds the scanned pattern by concatenation so it
 *      does not match itself.)
 *
 * (2) is the load-bearing one. (1) can be satisfied by a careful author;
 * (2) cannot be bypassed by an author at all. Same enforcement shape the
 * trust module uses to pin permission + source by test.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Prisma } from '@prisma/client';

import {
  createWorkApprovalItem,
  skillRunApprovalProvenance,
} from './create-item';
import { buildProvenance, ProvenanceError } from '../provenance/types';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');

const ROW = {
  workspaceId: 'ws-1',
  agentSlug: 'inbox-triage-general',
  kind: 'BUYER_INQUIRY_REPLY_DRAFT',
  refTable: 'WebhookEvent',
  refId: 'evt-42',
  status: 'PENDING',
  payload: { note: 'draft' },
} as unknown as Prisma.WorkApprovalQueueItemUncheckedCreateInput;

/** Records every create call so a rejection can be proven to have
 *  happened BEFORE the database was involved. */
function stubTx() {
  const calls: Array<{ data: unknown; select: unknown }> = [];
  const tx = {
    workApprovalQueueItem: {
      create: async (args: { data: unknown; select: unknown }) => {
        calls.push(args);
        return { id: 'created-1' };
      },
    },
  };
  return { calls, tx: tx as unknown as Prisma.TransactionClient };
}

describe('createWorkApprovalItem — the door rejects before it writes', () => {
  it('throws on a structurally invalid block and never calls the tx', async () => {
    const { calls, tx } = stubTx();
    await assert.rejects(
      () =>
        createWorkApprovalItem(tx, {
          data: ROW,
          // Hand-rolled (never went through buildProvenance) and missing
          // both sourceRef and storedBy — the exact shape of "someone
          // added a write path and filled the field in by hand".
          provenance: {
            sourceType: 'skill-run',
            origin: 'agent',
            recordType: 'approval-item',
          } as never,
        }),
      ProvenanceError,
    );
    assert.equal(calls.length, 0, 'no row may be attempted on a bad block');
  });

  it('throws when the block was built for a different record type', async () => {
    const { calls, tx } = stubTx();
    const memoryBlock = buildProvenance({
      sourceType: 'customer-chat',
      origin: 'customer',
      recordType: 'memory-entry',
      sourceRef: 'ChatMessage:abc',
      storedBy: 'plaino',
      confidence: 1,
    });
    await assert.rejects(
      () => createWorkApprovalItem(tx, { data: ROW, provenance: memoryBlock }),
      /recordType mismatch/,
    );
    assert.equal(calls.length, 0);
  });

  it('throws on a dishonest block (inference claiming verified)', async () => {
    const { calls, tx } = stubTx();
    await assert.rejects(
      () =>
        createWorkApprovalItem(tx, {
          data: ROW,
          provenance: {
            sourceType: 'agent-inference',
            origin: 'agent',
            recordType: 'approval-item',
            sourceRef: 'WebhookEvent:evt-42',
            storedBy: 'inbox-triage-general',
            sourceHash: null,
            confidence: 0.7,
            verified: true,
            capturedAt: '2026-08-02T12:00:00.000Z',
          } as never,
        }),
      ProvenanceError,
    );
    assert.equal(calls.length, 0);
  });

  it('writes the row WITH the block when provenance is valid', async () => {
    const { calls, tx } = stubTx();
    const created = await createWorkApprovalItem(tx, {
      data: ROW,
      provenance: skillRunApprovalProvenance(ROW, {
        now: new Date('2026-08-02T12:00:00.000Z'),
      }),
    });
    assert.equal(created.id, 'created-1');
    assert.equal(calls.length, 1);
    const data = calls[0].data as Record<string, unknown>;
    assert.equal(data.workspaceId, 'ws-1');
    assert.deepEqual(data.provenance, {
      sourceType: 'skill-run',
      origin: 'agent',
      recordType: 'approval-item',
      sourceRef: 'WebhookEvent:evt-42',
      storedBy: 'inbox-triage-general',
      sourceHash: null,
      confidence: 0.8,
      verified: false,
      capturedAt: '2026-08-02T12:00:00.000Z',
    });
    assert.deepEqual(calls[0].select, { id: true });
  });
});

describe('skillRunApprovalProvenance — citation derived from the row', () => {
  it('cites refTable:refId and credits the row agentSlug', () => {
    const p = skillRunApprovalProvenance(ROW);
    assert.equal(p.sourceRef, 'WebhookEvent:evt-42');
    assert.equal(p.storedBy, 'inbox-triage-general');
    assert.equal(p.sourceType, 'skill-run');
    assert.equal(p.origin, 'agent');
  });

  it('never births a verified row — approval is the vouching act', () => {
    assert.equal(skillRunApprovalProvenance(ROW).verified, false);
    assert.equal(
      skillRunApprovalProvenance(ROW, { confidence: 1 }).verified,
      false,
    );
  });

  it('honors a caller-supplied confidence over the 0.8 default', () => {
    assert.equal(skillRunApprovalProvenance(ROW).confidence, 0.8);
    assert.equal(
      skillRunApprovalProvenance(ROW, { confidence: 0.42 }).confidence,
      0.42,
    );
  });
});

describe('repo scan — create-item.ts is the ONLY approvals write door', () => {
  // Built by concatenation so this test file does not itself match the
  // pattern it scans for.
  const PATTERN = 'workApprovalQueueItem' + '.create(';
  const ALLOWED = ['lib/approvals/create-item.ts'];

  it('finds no direct workApprovalQueueItem create outside the door', () => {
    const hits: string[] = [];
    for (const dir of ['lib', 'app', 'prisma']) {
      walk(path.join(REPO_ROOT, dir), (file) => {
        if (!/\.(ts|tsx|js|mjs)$/.test(file)) return;
        const src = fs.readFileSync(file, 'utf8');
        if (!src.includes(PATTERN)) return;
        hits.push(path.relative(REPO_ROOT, file).split(path.sep).join('/'));
      });
    }
    assert.deepEqual(
      hits.sort(),
      ALLOWED,
      `Every WorkApprovalQueueItem write must go through createWorkApprovalItem ` +
        `(lib/approvals/create-item.ts) so it carries provenance. Direct writes found in: ` +
        hits.filter((h) => !ALLOWED.includes(h)).join(', '),
    );
  });
});

function walk(dir: string, visit: (file: string) => void): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return; // directory absent in this checkout — nothing to scan
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.claude') continue;
      if (entry.name === '.next' || entry.name === 'generated') continue;
      walk(full, visit);
      continue;
    }
    if (entry.isFile()) visit(full);
  }
}
