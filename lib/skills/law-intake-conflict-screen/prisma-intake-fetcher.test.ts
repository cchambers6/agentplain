/**
 * lib/skills/law-intake-conflict-screen/prisma-intake-fetcher.test.ts
 *
 * Tests the intake-metadata parser + the un-screened dedupe query (pfd-8),
 * via a stubbed tx so no DB is required.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Prisma } from '@prisma/client';

import { PrismaIntakeFetcher, parseIntake } from './prisma-intake-fetcher';
import { CONFLICT_SCREEN_REF_TABLE } from './prisma-approval-sink';

const validIntakeMeta = {
  docType: 'intake',
  intake: {
    matterId: 'M-1',
    prospectName: 'Jane Prospect',
    prospectEmail: 'jane@example.com',
    opposingParties: ['Acme Corp', ''],
    matterDescription: 'Dispute',
    responsibleAttorney: { name: 'Pat Partner', email: 'pat@firm.example' },
  },
};

describe('parseIntake', () => {
  it('parses a valid intake blob, dropping empty opposing parties', () => {
    const out = parseIntake(validIntakeMeta as unknown as Prisma.JsonValue);
    assert.ok(out);
    assert.equal(out!.matterId, 'M-1');
    assert.deepEqual(out!.opposingParties, ['Acme Corp']);
    assert.equal(out!.responsibleAttorney.email, 'pat@firm.example');
  });

  it('returns null for non-intake docs', () => {
    assert.equal(parseIntake({ docType: 'note' } as unknown as Prisma.JsonValue), null);
    assert.equal(parseIntake({} as unknown as Prisma.JsonValue), null);
    assert.equal(parseIntake(null), null);
  });

  it('returns null when a required field is missing (never fabricates)', () => {
    const missingAttorney = {
      docType: 'intake',
      intake: { matterId: 'M-2', prospectName: 'X', prospectEmail: 'x@e.com' },
    };
    assert.equal(parseIntake(missingAttorney as unknown as Prisma.JsonValue), null);
  });
});

describe('PrismaIntakeFetcher.fetchPendingIntakes — dedupe', () => {
  it('excludes intakes whose matter is already screened', async () => {
    const tx = {
      knowledgeDocument: {
        findMany: async () => [
          { metadata: validIntakeMeta },
          {
            metadata: {
              docType: 'intake',
              intake: {
                ...validIntakeMeta.intake,
                matterId: 'M-2',
                prospectName: 'Bob Two',
              },
            },
          },
        ],
      },
      workApprovalQueueItem: {
        findMany: async (args: {
          where: { refTable: string; refId: { in: string[] } };
        }) => {
          assert.equal(args.where.refTable, CONFLICT_SCREEN_REF_TABLE);
          // M-1 is already screened.
          return [{ refId: 'M-1' }];
        },
      },
    } as unknown as Prisma.TransactionClient;

    const fetcher = new PrismaIntakeFetcher({ tx });
    const res = await fetcher.fetchPendingIntakes({ workspaceId: 'ws-1' });
    assert.ok(res.ok);
    assert.equal(res.value.length, 1);
    assert.equal(res.value[0]!.matterId, 'M-2');
  });

  it('returns empty when no intake docs exist', async () => {
    const tx = {
      knowledgeDocument: { findMany: async () => [{ metadata: { docType: 'note' } }] },
      workApprovalQueueItem: { findMany: async () => [] },
    } as unknown as Prisma.TransactionClient;
    const fetcher = new PrismaIntakeFetcher({ tx });
    const res = await fetcher.fetchPendingIntakes({ workspaceId: 'ws-1' });
    assert.ok(res.ok);
    assert.deepEqual(res.value, []);
  });
});
