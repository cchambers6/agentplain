/**
 * tests/customer-data-export.test.ts
 *
 * Pins the load-bearing scoping contract of the customer data export:
 *
 *   A workspace's export NEVER contains another workspace's rows.
 *
 * The test seeds a mock Prisma client with rows for two workspaces (A and
 * B). It then calls `buildWorkspaceExport({ workspaceId: A, rls: {...A...} })`
 * and asserts:
 *
 *   1. Every per-row id surfaced in the artifact maps back to a workspace-A
 *      seed row.
 *   2. No workspace-B id leaks into ANY collection on the artifact.
 *   3. The metadata.workspaceId equals workspaceId A.
 *   4. The artifact.workspace.id equals workspaceId A.
 *   5. Encrypted KnowledgeDocument bodies decrypt in-flight when the
 *      ENCRYPTION_KEY is present.
 *   6. The mock client received the right GUC bindings under withRls
 *      (workspaceId A, isOperator false).
 *
 * The mock implements the `where: { workspaceId }` filter that production
 * Prisma applies, so the test proves the production code's per-table
 * `where` clauses do the work — not the fixtures.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { Prisma, PrismaClient } from '@prisma/client';

import { buildWorkspaceExport } from '@/lib/customer-data';
import { encrypt, loadMasterKey } from '@/lib/security/encryption';

// ─── Mock Prisma client (read-only — only the methods buildWorkspaceExport
//      uses are implemented; everything else throws). ──────────────────────

interface Row {
  id: string;
  workspaceId: string;
  [k: string]: unknown;
}

class ExportMockClient {
  workspaces: Array<{
    id: string;
    name: string;
    slug: string;
    vertical: string;
    verticalTier: string;
    tier: string;
    stateCode: string;
    billingMode: string;
    closureStatus: string;
    closingInitiatedAt: Date | null;
    scheduledHardPurgeAt: Date | null;
    closedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }> = [];
  memberships: Array<Row & { userId: string; role: string; status: string; createdAt: Date }> = [];
  onboardingStates: Array<{ workspaceId: string; currentStep: string; completedSteps: unknown; completedAt: Date | null }> = [];
  workspacePreferences: Array<{
    workspaceId: string;
    draftingTone: string | null;
    categorizationNotes: string | null;
    calendarWindow: string | null;
    learnedDraftNotes: string[];
  }> = [];
  preferenceSignals: Array<Row & { source: string; kind: string; text: string; refTable: string | null; refId: string | null; capturedAt: Date }> = [];
  knowledgeDocuments: Array<Row & { contextKind: string; title: string; body: string; sourceUrl: string | null; metadata: unknown; createdAt: Date }> = [];
  workApprovals: Array<Row & { agentSlug: string; kind: string; status: string; payload: unknown; proposedAt: Date; decidedAt: Date | null; decisionReason: string | null }> = [];
  handoffs: Array<Row & { fromAgent: string; toAgent: string; handoffType: string; payload: unknown; occurredAt: Date }> = [];
  integrations: Array<Row & { provider: string; accountEmail: string; scopes: string[]; status: string; expiresAt: Date; lastRefreshedAt: Date | null; createdAt: Date }> = [];
  webhookSubscriptions: Array<Row & { provider: string; resource: string; expiresAt: Date; status: string; lastRenewedAt: Date | null; createdAt: Date }> = [];
  webhookEvents: Array<Row & { receivedAt: Date; processed: boolean; processedAt: Date | null; rawPayload: unknown }> = [];
  auditLogRows: Array<Row & { actorUserId: string | null; action: string; targetTable: string | null; targetId: string | null; payload: unknown; occurredAt: Date }> = [];
  inquiries: Array<{ id: string; convertedWorkspaceId: string; name: string; business: string; vertical: string; email: string; inquiryType: string; status: string; createdAt: Date }> = [];
  subscriptions: Array<{ workspaceId: string; status: string; tier: string; seatBand: string; seats: number; trialEndsAt: Date | null; currentPeriodEnd: Date | null; cancelAtPeriodEnd: boolean }> = [];
  workspaceInvoices: Array<Row & { amountUsdCents: number; status: string; hostedInvoiceUrl: string | null; pdfUrl: string | null; issuedAt: Date; paidAt: Date | null }> = [];
  rlsCalls: Array<{ userId: string; workspaceId: string; isOperator: string }> = [];

  async $transaction<T>(cb: (tx: ExportMockClient) => Promise<T>): Promise<T> {
    return cb(this);
  }

  async $executeRawUnsafe(
    _sql: string,
    userId: string,
    workspaceId: string,
    isOperator: string,
  ): Promise<number> {
    this.rlsCalls.push({ userId, workspaceId, isOperator });
    return 0;
  }

  workspace = {
    findUnique: async (args: { where: { id: string } }) =>
      this.workspaces.find((w) => w.id === args.where.id) ?? null,
  };
  membership = {
    findMany: async (args: { where: { workspaceId: string } }) =>
      this.memberships.filter((r) => r.workspaceId === args.where.workspaceId),
  };
  onboardingState = {
    findUnique: async (args: { where: { workspaceId: string } }) =>
      this.onboardingStates.find((r) => r.workspaceId === args.where.workspaceId) ?? null,
  };
  workspacePreference = {
    findUnique: async (args: { where: { workspaceId: string } }) =>
      this.workspacePreferences.find((r) => r.workspaceId === args.where.workspaceId) ?? null,
  };
  preferenceSignal = {
    findMany: async (args: { where: { workspaceId: string } }) =>
      this.preferenceSignals.filter((r) => r.workspaceId === args.where.workspaceId),
  };
  knowledgeDocument = {
    findMany: async (args: { where: { workspaceId: string; contextKind: string } }) =>
      this.knowledgeDocuments.filter(
        (r) =>
          r.workspaceId === args.where.workspaceId &&
          r.contextKind === args.where.contextKind,
      ),
  };
  workApprovalQueueItem = {
    findMany: async (args: { where: { workspaceId: string } }) =>
      this.workApprovals.filter((r) => r.workspaceId === args.where.workspaceId),
  };
  handoffLogEntry = {
    findMany: async (args: { where: { workspaceId: string } }) =>
      this.handoffs.filter((r) => r.workspaceId === args.where.workspaceId),
  };
  integrationCredential = {
    findMany: async (args: { where: { workspaceId: string } }) =>
      this.integrations.filter((r) => r.workspaceId === args.where.workspaceId),
  };
  webhookSubscription = {
    findMany: async (args: { where: { workspaceId: string } }) =>
      this.webhookSubscriptions.filter((r) => r.workspaceId === args.where.workspaceId),
  };
  webhookEvent = {
    findMany: async (args: { where: { workspaceId: string } }) =>
      this.webhookEvents.filter((r) => r.workspaceId === args.where.workspaceId),
  };
  auditLog = {
    findMany: async (args: { where: { workspaceId: string } }) =>
      this.auditLogRows.filter((r) => r.workspaceId === args.where.workspaceId),
  };
  inquiry = {
    findMany: async (args: { where: { convertedWorkspaceId: string } }) =>
      this.inquiries.filter((r) => r.convertedWorkspaceId === args.where.convertedWorkspaceId),
  };
  subscription = {
    findUnique: async (args: { where: { workspaceId: string } }) =>
      this.subscriptions.find((s) => s.workspaceId === args.where.workspaceId) ?? null,
  };
  workspaceInvoice = {
    findMany: async (args: { where: { workspaceId: string } }) =>
      this.workspaceInvoices.filter((r) => r.workspaceId === args.where.workspaceId),
  };
}

const asPrismaClient = (m: ExportMockClient): PrismaClient =>
  m as unknown as PrismaClient;

// ─── Fixture seed ──────────────────────────────────────────────────────────

const WS_A = {
  id: '11111111-1111-1111-1111-111111111111',
  name: 'Tenant A Realty',
  slug: 'tenant-a',
};
const WS_B = {
  id: '22222222-2222-2222-2222-222222222222',
  name: 'Tenant B CPAs',
  slug: 'tenant-b',
};
const USER_A = '99999999-aaaa-4aaa-9aaa-aaaaaaaaaaaa';
const USER_B = 'bbbbbbbb-bbbb-4bbb-9bbb-bbbbbbbbbbbb';

function seedBothWorkspaces(mock: ExportMockClient): void {
  const workspaces: Array<{ id: string; name: string; slug: string; vertical: string }> = [
    { id: WS_A.id, name: WS_A.name, slug: WS_A.slug, vertical: 'REAL_ESTATE' },
    { id: WS_B.id, name: WS_B.name, slug: WS_B.slug, vertical: 'CPA' },
  ];
  for (const w of workspaces) {
    mock.workspaces.push({
      id: w.id,
      name: w.name,
      slug: w.slug,
      vertical: w.vertical,
      verticalTier: 'REGULAR',
      tier: 'HIGH_TOUCH',
      stateCode: 'GA',
      billingMode: 'MANUAL_INVOICE',
      closureStatus: 'ACTIVE',
      closingInitiatedAt: null,
      scheduledHardPurgeAt: null,
      closedAt: null,
      createdAt: new Date('2026-05-01T00:00:00Z'),
      updatedAt: new Date('2026-05-27T00:00:00Z'),
    });
  }

  const seed = (wsId: string, userId: string, marker: string) => {
    mock.memberships.push({
      id: `mem_${marker}`,
      workspaceId: wsId,
      userId,
      role: 'BROKER_OWNER',
      status: 'ACTIVE',
      createdAt: new Date(),
    });
    mock.onboardingStates.push({
      workspaceId: wsId,
      currentStep: 'done',
      completedSteps: ['confirm_details'],
      completedAt: new Date(),
    });
    mock.workspacePreferences.push({
      workspaceId: wsId,
      draftingTone: 'plain',
      categorizationNotes: `notes for ${marker}`,
      calendarWindow: '9-5 weekdays',
      learnedDraftNotes: [`learned for ${marker}`],
    });
    mock.preferenceSignals.push({
      id: `ps_${marker}`,
      workspaceId: wsId,
      source: 'ONBOARDING_FORM',
      kind: 'tone',
      text: `plain (${marker})`,
      refTable: null,
      refId: null,
      capturedAt: new Date(),
    });
    mock.knowledgeDocuments.push({
      id: `kd_plain_${marker}`,
      workspaceId: wsId,
      contextKind: 'CUSTOMER',
      title: `Doc plaintext ${marker}`,
      body: `the body of plaintext doc for ${marker}`,
      sourceUrl: null,
      metadata: { source: 'google-drive', fileId: `fid_${marker}` },
      createdAt: new Date(),
    });
    mock.workApprovals.push({
      id: `wa_${marker}`,
      workspaceId: wsId,
      agentSlug: 'buyer-inquiry-router',
      kind: 'BUYER_INQUIRY_REPLY_DRAFT',
      status: 'PENDING',
      payload: { draft: { body: `draft for ${marker}` } },
      proposedAt: new Date(),
      decidedAt: null,
      decisionReason: null,
    });
    mock.handoffs.push({
      id: `ho_${marker}`,
      workspaceId: wsId,
      fromAgent: 'reader',
      toAgent: 'router',
      handoffType: 'categorize',
      payload: { lane: marker },
      occurredAt: new Date(),
    });
    mock.integrations.push({
      id: `ic_${marker}`,
      workspaceId: wsId,
      provider: 'GOOGLE',
      accountEmail: `${marker}@example.com`,
      scopes: ['gmail.readonly'],
      status: 'ACTIVE',
      expiresAt: new Date(Date.now() + 3600_000),
      lastRefreshedAt: null,
      createdAt: new Date(),
    });
    mock.webhookSubscriptions.push({
      id: `ws_${marker}`,
      workspaceId: wsId,
      provider: 'GOOGLE',
      resource: `${marker}@example.com`,
      expiresAt: new Date(Date.now() + 7 * 24 * 3600_000),
      status: 'ACTIVE',
      lastRenewedAt: null,
      createdAt: new Date(),
    });
    mock.webhookEvents.push({
      id: `we_${marker}`,
      workspaceId: wsId,
      receivedAt: new Date(),
      processed: false,
      processedAt: null,
      rawPayload: { emailAddress: `${marker}@example.com`, historyId: marker },
    });
    mock.auditLogRows.push({
      id: `al_${marker}`,
      workspaceId: wsId,
      actorUserId: userId,
      action: 'test.event',
      targetTable: null,
      targetId: null,
      payload: { marker },
      occurredAt: new Date(),
    });
    mock.inquiries.push({
      id: `in_${marker}`,
      convertedWorkspaceId: wsId,
      name: marker,
      business: `${marker} Co`,
      vertical: 'realty',
      email: `${marker}@example.com`,
      inquiryType: 'CUSTOM_SKILL_BUILD',
      status: 'CONVERTED',
      createdAt: new Date(),
    });
    mock.subscriptions.push({
      workspaceId: wsId,
      status: 'ACTIVE',
      tier: 'REGULAR',
      seatBand: 'SEATS_1',
      seats: 1,
      trialEndsAt: null,
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 3600_000),
      cancelAtPeriodEnd: false,
    });
    mock.workspaceInvoices.push({
      id: `inv_${marker}`,
      workspaceId: wsId,
      amountUsdCents: 9900,
      status: 'paid',
      hostedInvoiceUrl: null,
      pdfUrl: null,
      issuedAt: new Date(),
      paidAt: new Date(),
    });
  };

  seed(WS_A.id, USER_A, 'A');
  seed(WS_B.id, USER_B, 'B');
}

// Helper: collect every id-like string that surfaces in an export artifact.
function collectIds(artifact: unknown): string[] {
  const out: string[] = [];
  const walk = (v: unknown): void => {
    if (v == null) return;
    if (typeof v === 'string') {
      out.push(v);
      return;
    }
    if (Array.isArray(v)) {
      for (const x of v) walk(x);
      return;
    }
    if (typeof v === 'object') {
      for (const x of Object.values(v as Record<string, unknown>)) walk(x);
    }
  };
  walk(artifact);
  return out;
}

// ─── Encryption env management ────────────────────────────────────────────

const ORIGINAL_KEY = process.env.ENCRYPTION_KEY;
const TEST_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

before(() => {
  process.env.ENCRYPTION_KEY = TEST_KEY;
});
after(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.ENCRYPTION_KEY;
  else process.env.ENCRYPTION_KEY = ORIGINAL_KEY;
});

// ─── Tests ────────────────────────────────────────────────────────────────

describe('buildWorkspaceExport — workspace scoping (load-bearing)', () => {
  it('an export for workspace A contains NO workspace B row, anywhere', async () => {
    const mock = new ExportMockClient();
    seedBothWorkspaces(mock);

    const artifact = await buildWorkspaceExport({
      workspaceId: WS_A.id,
      requestedByUserId: USER_A,
      rls: { userId: USER_A, workspaceId: WS_A.id, isOperator: false },
      client: asPrismaClient(mock),
    });

    // Top-level identity.
    assert.equal(artifact.metadata.workspaceId, WS_A.id);
    assert.equal(artifact.workspace.id, WS_A.id);

    // Every per-collection row that originated from B (suffix _B) is absent.
    const ids = collectIds(artifact);
    const leakedB = ids.filter((s) => s.endsWith('_B'));
    assert.deepEqual(leakedB, [], `workspace B ids leaked into A's export: ${leakedB.join(', ')}`);

    // The A-side rows ARE present (sanity: the test isn't tautologically empty).
    const aIds = ids.filter((s) => s.endsWith('_A'));
    assert.ok(aIds.length >= 10, `expected ≥10 A-side ids in the export; got ${aIds.length}`);

    // GUC binding: withRls fired ONE set_config call with workspaceId A
    // (and isOperator=false).
    assert.equal(mock.rlsCalls.length, 1);
    assert.equal(mock.rlsCalls[0].workspaceId, WS_A.id);
    assert.equal(mock.rlsCalls[0].userId, USER_A);
    assert.equal(mock.rlsCalls[0].isOperator, 'false');
  });

  it('symmetric: an export for workspace B contains NO workspace A row', async () => {
    const mock = new ExportMockClient();
    seedBothWorkspaces(mock);

    const artifact = await buildWorkspaceExport({
      workspaceId: WS_B.id,
      requestedByUserId: USER_B,
      rls: { userId: USER_B, workspaceId: WS_B.id, isOperator: false },
      client: asPrismaClient(mock),
    });

    assert.equal(artifact.metadata.workspaceId, WS_B.id);
    assert.equal(artifact.workspace.id, WS_B.id);

    const ids = collectIds(artifact);
    const leakedA = ids.filter((s) => s.endsWith('_A'));
    assert.deepEqual(leakedA, [], `workspace A ids leaked into B's export: ${leakedA.join(', ')}`);
  });

  it('rejects a context whose workspaceId does not match the requested workspaceId', async () => {
    const mock = new ExportMockClient();
    seedBothWorkspaces(mock);
    await assert.rejects(
      buildWorkspaceExport({
        workspaceId: WS_A.id,
        requestedByUserId: USER_A,
        // Smuggled foreign RLS context — must throw before any read.
        rls: { userId: USER_A, workspaceId: WS_B.id, isOperator: false },
        client: asPrismaClient(mock),
      }),
      /RLS context workspaceId mismatch/,
    );
    // No GUC set, no rows touched.
    assert.equal(mock.rlsCalls.length, 0);
  });

  it('refuses isOperator=true contexts (operator export is a different surface)', async () => {
    const mock = new ExportMockClient();
    seedBothWorkspaces(mock);
    await assert.rejects(
      buildWorkspaceExport({
        workspaceId: WS_A.id,
        requestedByUserId: USER_A,
        rls: { userId: USER_A, workspaceId: WS_A.id, isOperator: true },
        client: asPrismaClient(mock),
      }),
      /refuses isOperator=true contexts/,
    );
  });
});

describe('buildWorkspaceExport — encryption handling', () => {
  it('decrypts KnowledgeDocument.body in-flight when stored encrypted', async () => {
    const mock = new ExportMockClient();
    seedBothWorkspaces(mock);
    // Replace A's plaintext doc with a v1:...-encoded ciphertext so the
    // export must call decrypt() to render it.
    const a = mock.knowledgeDocuments.find((d) => d.id === 'kd_plain_A')!;
    const plaintext = 'the body of plaintext doc for A';
    a.body = encrypt(plaintext, loadMasterKey(TEST_KEY));

    const artifact = await buildWorkspaceExport({
      workspaceId: WS_A.id,
      requestedByUserId: USER_A,
      rls: { userId: USER_A, workspaceId: WS_A.id, isOperator: false },
      client: asPrismaClient(mock),
    });
    const exported = artifact.knowledgeDocuments.find((d) => d.id === 'kd_plain_A')!;
    assert.equal(exported.body, plaintext);
    assert.equal(exported.decryptionFailed, false);
  });

  it('passes plaintext bodies through unchanged (no decryption required)', async () => {
    const mock = new ExportMockClient();
    seedBothWorkspaces(mock);
    const artifact = await buildWorkspaceExport({
      workspaceId: WS_A.id,
      requestedByUserId: USER_A,
      rls: { userId: USER_A, workspaceId: WS_A.id, isOperator: false },
      client: asPrismaClient(mock),
    });
    const exported = artifact.knowledgeDocuments.find((d) => d.id === 'kd_plain_A')!;
    assert.equal(exported.body, 'the body of plaintext doc for A');
    assert.equal(exported.decryptionFailed, false);
  });
});

// Defensive: re-export Prisma to silence "imported but unused" if the
// transitive types disappear in a future Prisma upgrade. The Prisma
// import is what proves the mock matches the generated client shape.
export const _ = (): Prisma.TransactionClient => null as unknown as Prisma.TransactionClient;
