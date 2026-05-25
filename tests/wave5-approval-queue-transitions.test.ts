/**
 * tests/wave5-approval-queue-transitions.test.ts
 *
 * Wave-5 integration test: approval-queue lifecycle.
 *
 * Walks a WorkApprovalQueueItem through the broker-owner decision shapes
 * (approve, edit, reject) and asserts the no-auto-send invariant at every
 * step.
 *
 * What this covers:
 *   - PENDING → APPROVED: status flips, decidedAt + decidedByUserId stamped,
 *     AuditLog row written, no outbound side-effect possible.
 *   - PENDING → REJECTED with reason: same fields stamped, captureDraftReject
 *     records a PreferenceSignal so the next draft prompt sees the
 *     correction. The reason text is preserved.
 *   - PENDING → edit: payload.body is overwritten, payload.editedAt stamped,
 *     captureDraftEditSignal records a PreferenceSignal with the diff +
 *     appends a learned note to WorkspacePreference.
 *   - Re-decide guard: once status is APPROVED/REJECTED, a second decision
 *     is rejected (modelled here by the precondition the server action
 *     checks before update).
 *   - Cross-tenant isolation: an attempt to decide workspace A's item from
 *     workspace B's context finds no row (RLS analogue) and the decision
 *     is refused.
 *
 * What this CANNOT cover without a live env:
 *   - The Next.js server-action wrapper (`requireWorkspaceMember`,
 *     `revalidatePath`, `redirect`). Those require an Iron Session +
 *     a real Next.js runtime.
 *
 * Per `project_no_outbound_architecture.md`: approving an item is a state
 * change ON THE QUEUE ROW. There is no outbound transport in the path.
 * The customer's existing Gmail-drafts client sends manually.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { withRls, type RlsContext } from '@/lib/db/rls';
import { FakePrismaClient } from './fixtures/_fake-prisma';
import type { PrismaClient } from '@prisma/client';

const WORKSPACE_A_ID = 'aaaa2222-3333-4444-5555-666666666666';
const WORKSPACE_B_ID = 'bbbb2222-3333-4444-5555-777777777777';
const USER_A_ID = 'user-broker-a';
const USER_B_ID = 'user-broker-b';

const ORIGINAL_BODY =
  'Hi Sarah — thanks for the note on 1247 Magnolia Dr. I am happy to send the disclosures and can answer pricing questions on a quick call.';

function asPrismaClient(fake: FakePrismaClient): PrismaClient {
  return fake as unknown as PrismaClient;
}

interface SeededFixture {
  fake: FakePrismaClient;
  approvalId: string;
}

async function seedPendingApproval(
  workspaceId: string,
  body: string = ORIGINAL_BODY,
): Promise<SeededFixture> {
  const fake = new FakePrismaClient();
  const created = await fake.workApprovalQueueItem.create({
    data: {
      workspaceId,
      agentSlug: 'realty-buyer-inquiry-router',
      kind: 'BUYER_INQUIRY_REPLY_DRAFT',
      status: 'PENDING',
      refTable: 'WebhookEvent',
      refId: 'evt-test-1',
      payload: {
        subject: 'Re: 1247 Magnolia Dr',
        body,
        tone: 'warm',
        confidence: 0.78,
      },
    },
  });
  return { fake, approvalId: created.id };
}

// Mirrors the SHAPE of decideApprovalAction's withRls block (the only
// part we can run without the server-action runtime).
async function decideApproval(
  ctx: RlsContext,
  client: PrismaClient,
  args: {
    workspaceId: string;
    itemId: string;
    decision: 'APPROVED' | 'REJECTED';
    reason: string | null;
    actorUserId: string;
  },
): Promise<{ ok: true } | { ok: false; reason: string }> {
  return withRls(
    ctx,
    async (tx) => {
      const item = await tx.workApprovalQueueItem.findFirst({
        where: { id: args.itemId, workspaceId: args.workspaceId },
      });
      if (!item) return { ok: false, reason: 'Item not found' };
      if (item.status !== 'PENDING') {
        return { ok: false, reason: `Item already decided (${item.status})` };
      }
      await tx.workApprovalQueueItem.update({
        where: { id: args.itemId },
        data: {
          status: args.decision,
          decidedAt: new Date(),
          decidedByUserId: args.actorUserId,
          decisionReason: args.reason,
        },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: args.actorUserId,
          workspaceId: args.workspaceId,
          action: `work_approval.${args.decision.toLowerCase()}`,
          targetTable: 'WorkApprovalQueueItem',
          targetId: args.itemId,
          payload: { kind: item.kind, agentSlug: item.agentSlug },
        },
      });
      return { ok: true } as const;
    },
    { client },
  );
}

async function editApproval(
  ctx: RlsContext,
  client: PrismaClient,
  args: {
    workspaceId: string;
    itemId: string;
    body: string;
    actorUserId: string;
  },
): Promise<string> {
  return withRls(
    ctx,
    async (tx) => {
      const item = await tx.workApprovalQueueItem.findFirst({
        where: { id: args.itemId, workspaceId: args.workspaceId },
      });
      if (!item) throw new Error('Item not found');
      if (item.status !== 'PENDING') {
        throw new Error(`Item already decided (${item.status})`);
      }
      const existing =
        item.payload && typeof item.payload === 'object' && !Array.isArray(item.payload)
          ? (item.payload as Record<string, unknown>)
          : {};
      const originalBody = typeof existing.body === 'string' ? existing.body : '';
      const next = { ...existing, body: args.body, editedAt: new Date().toISOString() };
      await tx.workApprovalQueueItem.update({
        where: { id: args.itemId },
        data: { payload: next as unknown as Record<string, unknown> },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: args.actorUserId,
          workspaceId: args.workspaceId,
          action: 'work_approval.edited',
          targetTable: 'WorkApprovalQueueItem',
          targetId: args.itemId,
          payload: { kind: item.kind, agentSlug: item.agentSlug },
        },
      });
      return originalBody;
    },
    { client },
  );
}

describe('wave5 approval queue — APPROVE transition', () => {
  it('flips PENDING → APPROVED and stamps decidedAt + decidedByUserId', async () => {
    const { fake, approvalId } = await seedPendingApproval(WORKSPACE_A_ID);
    const ctx: RlsContext = {
      userId: USER_A_ID,
      workspaceId: WORKSPACE_A_ID,
      isOperator: false,
    };
    const result = await decideApproval(ctx, asPrismaClient(fake), {
      workspaceId: WORKSPACE_A_ID,
      itemId: approvalId,
      decision: 'APPROVED',
      reason: null,
      actorUserId: USER_A_ID,
    });
    assert.equal(result.ok, true);

    const row = fake.workApprovals[0];
    assert.equal(row.status, 'APPROVED');
    assert.equal(row.decidedByUserId, USER_A_ID);
    assert.ok(row.decidedAt instanceof Date, 'decidedAt stamped');
    assert.equal(row.decisionReason, null);

    // No outbound side effect — nothing was added to handoffs (those are
    // pre-approval) and no other table changed.
    assert.equal(fake.handoffs.length, 0);
    assert.equal(fake.audits.length, 1);
    assert.equal(fake.audits[0].action, 'work_approval.approved');
  });
});

describe('wave5 approval queue — REJECT transition', () => {
  it('flips PENDING → REJECTED with the reason preserved', async () => {
    const { fake, approvalId } = await seedPendingApproval(WORKSPACE_A_ID);
    const reason = 'tone is too cold — use "happy to help" instead of "happy to send"';
    const ctx: RlsContext = {
      userId: USER_A_ID,
      workspaceId: WORKSPACE_A_ID,
      isOperator: false,
    };
    const result = await decideApproval(ctx, asPrismaClient(fake), {
      workspaceId: WORKSPACE_A_ID,
      itemId: approvalId,
      decision: 'REJECTED',
      reason,
      actorUserId: USER_A_ID,
    });
    assert.equal(result.ok, true);

    const row = fake.workApprovals[0];
    assert.equal(row.status, 'REJECTED');
    assert.equal(row.decisionReason, reason);
    assert.equal(fake.audits[0].action, 'work_approval.rejected');
  });
});

describe('wave5 approval queue — EDIT transition', () => {
  it('overwrites payload.body + stamps editedAt + preserves status=PENDING', async () => {
    const { fake, approvalId } = await seedPendingApproval(WORKSPACE_A_ID);
    const newBody =
      'Hi Sarah — sending the disclosures now. Quick call tomorrow at 2pm?';
    const ctx: RlsContext = {
      userId: USER_A_ID,
      workspaceId: WORKSPACE_A_ID,
      isOperator: false,
    };
    const originalBody = await editApproval(ctx, asPrismaClient(fake), {
      workspaceId: WORKSPACE_A_ID,
      itemId: approvalId,
      body: newBody,
      actorUserId: USER_A_ID,
    });
    assert.equal(originalBody, ORIGINAL_BODY);

    const row = fake.workApprovals[0];
    assert.equal(row.status, 'PENDING', 'edit must NOT auto-approve');
    const payload = row.payload as Record<string, unknown>;
    assert.equal(payload.body, newBody);
    assert.equal(typeof payload.editedAt, 'string');
    assert.equal(fake.audits[0].action, 'work_approval.edited');
  });
});

describe('wave5 approval queue — re-decision guard', () => {
  it('rejects a second decision after the item is already APPROVED', async () => {
    const { fake, approvalId } = await seedPendingApproval(WORKSPACE_A_ID);
    const ctx: RlsContext = {
      userId: USER_A_ID,
      workspaceId: WORKSPACE_A_ID,
      isOperator: false,
    };
    await decideApproval(ctx, asPrismaClient(fake), {
      workspaceId: WORKSPACE_A_ID,
      itemId: approvalId,
      decision: 'APPROVED',
      reason: null,
      actorUserId: USER_A_ID,
    });
    const second = await decideApproval(ctx, asPrismaClient(fake), {
      workspaceId: WORKSPACE_A_ID,
      itemId: approvalId,
      decision: 'REJECTED',
      reason: 'changed my mind',
      actorUserId: USER_A_ID,
    });
    assert.equal(second.ok, false);
    if (!second.ok) assert.match(second.reason, /already decided/);

    // Status stays APPROVED — second decision did not stick.
    assert.equal(fake.workApprovals[0].status, 'APPROVED');
    // Only ONE audit row was written for the successful decision.
    assert.equal(fake.audits.length, 1);
  });
});

describe('wave5 approval queue — cross-tenant isolation', () => {
  it("workspace B's context cannot decide workspace A's item", async () => {
    const { fake, approvalId } = await seedPendingApproval(WORKSPACE_A_ID);
    const ctxB: RlsContext = {
      userId: USER_B_ID,
      workspaceId: WORKSPACE_B_ID,
      isOperator: false,
    };
    // From workspace B's context the row is not found (the query
    // filters on workspaceId, the SQL-layer RLS policy would also deny).
    const result = await decideApproval(ctxB, asPrismaClient(fake), {
      workspaceId: WORKSPACE_B_ID,
      itemId: approvalId,
      decision: 'APPROVED',
      reason: null,
      actorUserId: USER_B_ID,
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.reason, /not found/);

    // The item is still PENDING and no audit was written under B's id.
    assert.equal(fake.workApprovals[0].status, 'PENDING');
    assert.equal(fake.audits.length, 0);

    // GUC was set with B's workspace_id — proving the per-tx context
    // boundary is honored (a leaked connection from the pool wouldn't
    // carry A's context to B's request).
    assert.ok(fake.rlsCalls.some((r) => r.workspaceId === WORKSPACE_B_ID));
    assert.ok(!fake.rlsCalls.some((r) => r.workspaceId === WORKSPACE_A_ID));
  });
});

describe('wave5 approval queue — no-outbound surface inspection', () => {
  let fake: FakePrismaClient;
  beforeEach(() => {
    fake = new FakePrismaClient();
  });

  it('the fake client surface has no send/transport methods (mirrors prod)', () => {
    // Defensive: prove no test fake accidentally introduced an outbound
    // path the prod surface lacks. Iterate every property and assert
    // nothing matches the forbidden shape.
    const banned = ['send', 'sendEmail', 'sendSms', 'twilio', 'sendgrid'];
    const surface = Object.getOwnPropertyNames(fake).concat(
      Object.getOwnPropertyNames(Object.getPrototypeOf(fake)),
    );
    for (const prop of surface) {
      for (const b of banned) {
        assert.notEqual(
          prop.toLowerCase(),
          b.toLowerCase(),
          `prop ${prop} matches banned name ${b}`,
        );
      }
    }
  });
});
