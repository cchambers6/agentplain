/**
 * lib/memory/audit.test.ts
 *
 * Pins the pure audit-input validation. The DB-write path is covered by the
 * live-DB isolation test; here we lock that a malformed event is rejected
 * (loudly, but without throwing into the caller's hot path).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { buildMemoryAuditInput, recordMemoryAccess } from './audit';

const valid = {
  workspaceId: 'ws-1',
  actorType: 'SYSTEM' as const,
  actorId: 'tiering-sweep',
  action: 'ARCHIVE' as const,
  recordType: 'WorkspaceMemoryEntry',
  recordId: 'entry-1',
  intent: 'cold-tier-offload',
  source: 'lib/memory/tiering.ts',
};

describe('audit — buildMemoryAuditInput', () => {
  it('passes a well-formed event through and trims string fields', () => {
    const out = buildMemoryAuditInput({ ...valid, actorId: '  tiering-sweep  ' });
    assert.equal(out.actorId, 'tiering-sweep');
    assert.equal(out.action, 'ARCHIVE');
    assert.equal(out.workspaceId, 'ws-1');
  });

  it('rejects an empty required field', () => {
    for (const field of ['workspaceId', 'actorId', 'recordType', 'recordId', 'intent', 'source'] as const) {
      assert.throws(
        () => buildMemoryAuditInput({ ...valid, [field]: '   ' }),
        new RegExp(field),
        `expected "${field}" to be required`,
      );
    }
  });
});

describe('audit — recordMemoryAccess error handling', () => {
  it('returns {ok:false} for a malformed event without throwing', async () => {
    const res = await recordMemoryAccess({ ...valid, workspaceId: '' });
    assert.equal(res.ok, false);
  });
});
