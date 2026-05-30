/**
 * lib/skills/approval-threshold.test.ts
 *
 * Pins the wave-1 audit fix §9 #2 — the work-thresholds settings page
 * promised severity gates and confidence-based auto-approve; zero code
 * read them. This module reads them. These tests prove:
 *
 *   1. Safe default — no threshold row, no opt-in → PENDING.
 *   2. Compliance severity gate — row below threshold auto-approves.
 *   3. Confidence opt-in — confidence ≥ minConfidence auto-approves.
 *   4. Malformed autoApproveWhen → safe PENDING (no surprise approval).
 *   5. Severity at-or-above threshold stays PENDING.
 *   6. Confidence below threshold stays PENDING.
 *
 * The reader is driven through a stub `Prisma.TransactionClient` so we
 * exercise the gate logic deterministically without standing up Prisma.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import type { ComplianceSeverity, Prisma } from '@prisma/client';
import {
  applyApprovalThreshold,
  parseAutoApproveWhen,
} from './approval-threshold';

const WORKSPACE_ID = 'ws-threshold-test-0001';

interface ThresholdRow {
  requiresApprovalAboveSeverity: ComplianceSeverity | null;
  autoApproveWhen: Prisma.JsonValue | null;
}

function buildStubTx(row: ThresholdRow | null): Prisma.TransactionClient {
  // Just enough surface for applyApprovalThreshold.
  return {
    workThresholdConfig: {
      async findUnique() {
        return row;
      },
    },
  } as unknown as Prisma.TransactionClient;
}

describe('applyApprovalThreshold — safe defaults', () => {
  it('returns PENDING when no threshold row exists', async () => {
    const decision = await applyApprovalThreshold({
      workspaceId: WORKSPACE_ID,
      kind: 'BUYER_INQUIRY_REPLY_DRAFT',
      confidence: 0.9,
      tx: buildStubTx(null),
    });
    assert.equal(decision.status, 'PENDING');
    assert.equal(decision.decidedAt, null);
    assert.equal(decision.decisionReason, null);
  });

  it('returns PENDING when autoApproveWhen is null even though confidence is high', async () => {
    const decision = await applyApprovalThreshold({
      workspaceId: WORKSPACE_ID,
      kind: 'BUYER_INQUIRY_REPLY_DRAFT',
      confidence: 0.99,
      tx: buildStubTx({
        requiresApprovalAboveSeverity: null,
        autoApproveWhen: null,
      }),
    });
    assert.equal(decision.status, 'PENDING');
  });

  it('returns PENDING when DB read throws', async () => {
    const errorTx = {
      workThresholdConfig: {
        async findUnique() {
          throw new Error('DB hiccup');
        },
      },
    } as unknown as Prisma.TransactionClient;
    const decision = await applyApprovalThreshold({
      workspaceId: WORKSPACE_ID,
      kind: 'BUYER_INQUIRY_REPLY_DRAFT',
      confidence: 0.9,
      tx: errorTx,
    });
    assert.equal(decision.status, 'PENDING');
  });
});

describe('applyApprovalThreshold — confidence-based auto-approve', () => {
  it('AUTO_APPROVES when confidence meets minConfidence opt-in', async () => {
    const decision = await applyApprovalThreshold({
      workspaceId: WORKSPACE_ID,
      kind: 'BUYER_INQUIRY_REPLY_DRAFT',
      confidence: 0.8,
      tx: buildStubTx({
        requiresApprovalAboveSeverity: null,
        autoApproveWhen: { minConfidence: 0.7 },
      }),
    });
    assert.equal(decision.status, 'AUTO_APPROVED');
    assert.ok(decision.decidedAt);
    assert.match(decision.decisionReason!, /confidence 0\.80/);
  });

  it('stays PENDING when confidence is below minConfidence', async () => {
    const decision = await applyApprovalThreshold({
      workspaceId: WORKSPACE_ID,
      kind: 'BUYER_INQUIRY_REPLY_DRAFT',
      confidence: 0.6,
      tx: buildStubTx({
        requiresApprovalAboveSeverity: null,
        autoApproveWhen: { minConfidence: 0.7 },
      }),
    });
    assert.equal(decision.status, 'PENDING');
  });

  it('stays PENDING when no confidence is provided', async () => {
    const decision = await applyApprovalThreshold({
      workspaceId: WORKSPACE_ID,
      kind: 'BUYER_INQUIRY_REPLY_DRAFT',
      tx: buildStubTx({
        requiresApprovalAboveSeverity: null,
        autoApproveWhen: { minConfidence: 0.7 },
      }),
    });
    assert.equal(decision.status, 'PENDING');
  });

  it('AUTO_APPROVES with minConfidence=0 — the "always approve" opt-in', async () => {
    const decision = await applyApprovalThreshold({
      workspaceId: WORKSPACE_ID,
      kind: 'BUYER_INQUIRY_REPLY_DRAFT',
      confidence: 0.4,
      tx: buildStubTx({
        requiresApprovalAboveSeverity: null,
        autoApproveWhen: { minConfidence: 0 },
      }),
    });
    assert.equal(decision.status, 'AUTO_APPROVED');
  });
});

describe('applyApprovalThreshold — compliance severity gate', () => {
  it('AUTO_APPROVES a LOW flag when threshold is "approve when severity ≥ MEDIUM"', async () => {
    const decision = await applyApprovalThreshold({
      workspaceId: WORKSPACE_ID,
      kind: 'COMPLIANCE_FLAG',
      severity: 'LOW',
      tx: buildStubTx({
        requiresApprovalAboveSeverity: 'MEDIUM',
        autoApproveWhen: null,
      }),
    });
    assert.equal(decision.status, 'AUTO_APPROVED');
    assert.match(decision.decisionReason!, /LOW below.*MEDIUM/);
  });

  it('stays PENDING when severity matches the threshold', async () => {
    const decision = await applyApprovalThreshold({
      workspaceId: WORKSPACE_ID,
      kind: 'COMPLIANCE_FLAG',
      severity: 'MEDIUM',
      tx: buildStubTx({
        requiresApprovalAboveSeverity: 'MEDIUM',
        autoApproveWhen: null,
      }),
    });
    assert.equal(decision.status, 'PENDING');
  });

  it('stays PENDING when severity exceeds the threshold', async () => {
    const decision = await applyApprovalThreshold({
      workspaceId: WORKSPACE_ID,
      kind: 'COMPLIANCE_FLAG',
      severity: 'HIGH',
      tx: buildStubTx({
        requiresApprovalAboveSeverity: 'MEDIUM',
        autoApproveWhen: null,
      }),
    });
    assert.equal(decision.status, 'PENDING');
  });

  it('stays PENDING when no severity is provided', async () => {
    const decision = await applyApprovalThreshold({
      workspaceId: WORKSPACE_ID,
      kind: 'COMPLIANCE_FLAG',
      tx: buildStubTx({
        requiresApprovalAboveSeverity: 'MEDIUM',
        autoApproveWhen: null,
      }),
    });
    assert.equal(decision.status, 'PENDING');
  });
});

describe('parseAutoApproveWhen — wire format', () => {
  it('parses a valid minConfidence', () => {
    assert.deepEqual(parseAutoApproveWhen({ minConfidence: 0.75 }), {
      minConfidence: 0.75,
    });
  });

  it('rejects out-of-range minConfidence', () => {
    assert.equal(parseAutoApproveWhen({ minConfidence: 1.5 }), null);
    assert.equal(parseAutoApproveWhen({ minConfidence: -0.1 }), null);
  });

  it('rejects non-numeric minConfidence', () => {
    assert.equal(parseAutoApproveWhen({ minConfidence: 'high' }), null);
  });

  it('rejects empty objects (not a meaningful opt-in)', () => {
    assert.equal(parseAutoApproveWhen({}), null);
  });

  it('rejects null + arrays + primitives', () => {
    assert.equal(parseAutoApproveWhen(null), null);
    assert.equal(parseAutoApproveWhen([0.5] as unknown as Prisma.JsonValue), null);
    assert.equal(parseAutoApproveWhen('hello'), null);
  });

  it('parses maxSeverity with a valid level', () => {
    assert.deepEqual(parseAutoApproveWhen({ maxSeverity: 'LOW' }), {
      maxSeverity: 'LOW',
    });
  });
});
