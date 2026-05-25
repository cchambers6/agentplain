/**
 * tests/fixtures/_fake-prisma.ts
 *
 * Wave-5 shared test helper: a stateful in-memory Prisma-shaped client for
 * black-box integration tests that should NOT touch a real database.
 *
 * The fake honors the contract of `lib/db/rls.ts#withRls(ctx, fn, {client})`:
 *
 *   - client.$transaction(cb)  → invokes cb(tx) where tx is the same fake
 *   - tx.$executeRawUnsafe(...) → records the RLS set_config call so tests
 *                                 can verify the workspace context was set
 *
 * Only the table methods consumed by callers we exercise (workspacePreference,
 * preferenceSignal, workApprovalQueueItem, handoffLogEntry, workspace,
 * subscription, workspaceInvoice, billingEvent, auditLog) are implemented.
 * Tests reach into the recorded arrays directly when they want to assert.
 *
 * Per `feedback_no_silent_vendor_lock.md`: this helper is a TEST-ONLY adapter
 * over Prisma's call shape. It does not replace the production client.
 */

type Json = unknown;

export interface FakeWorkspacePreferenceRow {
  id: string;
  workspaceId: string;
  draftingTone: string | null;
  categorizationNotes: string | null;
  calendarWindow: string | null;
  learnedDraftNotes: string[];
  updatedAt: Date;
}

export interface FakePreferenceSignalRow {
  id: string;
  workspaceId: string;
  source: string;
  kind: string;
  text: string;
  refTable: string | null;
  refId: string | null;
  payload: Json;
  capturedAt: Date;
}

export interface FakeWorkApprovalRow {
  id: string;
  workspaceId: string;
  agentSlug: string;
  kind: string;
  refTable: string | null;
  refId: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  payload: Json;
  decidedAt: Date | null;
  decidedByUserId: string | null;
  decisionReason: string | null;
  createdAt: Date;
}

export interface FakeHandoffRow {
  id: string;
  workspaceId: string;
  fromAgent: string;
  toAgent: string;
  handoffType: string;
  payload: Json;
  relatedSubjectTable: string | null;
  relatedSubjectId: string | null;
  occurredAt: Date;
}

export interface FakeWorkspaceRow {
  id: string;
  name: string;
  slug: string;
  vertical: string;
  verticalTier: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  billingMode: string;
}

export interface FakeSubscriptionRow {
  id: string;
  workspaceId: string;
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  tier: string;
  seatBand: string;
  seats: number;
  status: string;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  defaultPaymentMethodId: string | null;
}

export interface FakeWorkspaceInvoiceRow {
  id: string;
  workspaceId: string;
  stripeInvoiceId: string;
  amountUsdCents: number;
  status: string;
  hostedInvoiceUrl: string | null;
  pdfUrl: string | null;
  periodStart: Date | null;
  periodEnd: Date | null;
  paidAt: Date | null;
}

export interface FakeBillingEventRow {
  id: string;
  stripeEventId: string;
  type: string;
  workspaceId: string | null;
  subscriptionId: string | null;
  payload: Json;
}

export interface FakeAuditLogRow {
  id: string;
  actorUserId: string | null;
  workspaceId: string | null;
  action: string;
  targetTable: string | null;
  targetId: string | null;
  payload: Json;
  occurredAt: Date;
}

export interface FakeRlsCall {
  userId: string;
  workspaceId: string;
  isOperator: string;
}

let nextId = 1;
const newId = (prefix: string) => `${prefix}_${nextId++}`;

export class FakePrismaClient {
  workspacePreferences: FakeWorkspacePreferenceRow[] = [];
  preferenceSignals: FakePreferenceSignalRow[] = [];
  workApprovals: FakeWorkApprovalRow[] = [];
  handoffs: FakeHandoffRow[] = [];
  workspaces: FakeWorkspaceRow[] = [];
  subscriptions: FakeSubscriptionRow[] = [];
  workspaceInvoices: FakeWorkspaceInvoiceRow[] = [];
  billingEvents: FakeBillingEventRow[] = [];
  audits: FakeAuditLogRow[] = [];
  rlsCalls: FakeRlsCall[] = [];

  seedWorkspace(ws: Partial<FakeWorkspaceRow> & { id: string }): FakeWorkspaceRow {
    const row: FakeWorkspaceRow = {
      id: ws.id,
      name: ws.name ?? `ws ${ws.id}`,
      slug: ws.slug ?? ws.id,
      vertical: ws.vertical ?? 'REAL_ESTATE',
      verticalTier: ws.verticalTier ?? 'REGULAR',
      stripeCustomerId: ws.stripeCustomerId ?? null,
      stripeSubscriptionId: ws.stripeSubscriptionId ?? null,
      billingMode: ws.billingMode ?? 'MANUAL_INVOICE',
    };
    this.workspaces.push(row);
    return row;
  }

  // The tx surface is identical to the client surface for our purposes —
  // we don't model transactional rollback. Tests that need rollback should
  // not use this fake.
  async $transaction<T>(cb: (tx: FakePrismaClient) => Promise<T>): Promise<T> {
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

  workspacePreference = {
    findUnique: async (args: { where: { workspaceId: string } }) => {
      return (
        this.workspacePreferences.find(
          (r) => r.workspaceId === args.where.workspaceId,
        ) ?? null
      );
    },
    upsert: async (args: {
      where: { workspaceId: string };
      create: Partial<FakeWorkspacePreferenceRow> & { workspaceId: string };
      update: Partial<FakeWorkspacePreferenceRow>;
    }) => {
      const existing = this.workspacePreferences.find(
        (r) => r.workspaceId === args.where.workspaceId,
      );
      const now = new Date();
      if (existing) {
        Object.assign(existing, args.update, { updatedAt: now });
        return existing;
      }
      const row: FakeWorkspacePreferenceRow = {
        id: newId('wp'),
        workspaceId: args.create.workspaceId,
        draftingTone: args.create.draftingTone ?? null,
        categorizationNotes: args.create.categorizationNotes ?? null,
        calendarWindow: args.create.calendarWindow ?? null,
        learnedDraftNotes: args.create.learnedDraftNotes ?? [],
        updatedAt: now,
      };
      this.workspacePreferences.push(row);
      return row;
    },
  };

  preferenceSignal = {
    create: async (args: { data: Omit<FakePreferenceSignalRow, 'id' | 'capturedAt'> }) => {
      const row: FakePreferenceSignalRow = {
        id: newId('ps'),
        workspaceId: args.data.workspaceId,
        source: args.data.source,
        kind: args.data.kind,
        text: args.data.text,
        refTable: args.data.refTable ?? null,
        refId: args.data.refId ?? null,
        payload: args.data.payload ?? null,
        capturedAt: new Date(),
      };
      this.preferenceSignals.push(row);
      return row;
    },
    findMany: async (args: {
      where: { workspaceId: string };
      orderBy?: unknown;
      take?: number;
    }) => {
      const rows = this.preferenceSignals
        .filter((r) => r.workspaceId === args.where.workspaceId)
        .slice()
        .sort((a, b) => b.capturedAt.getTime() - a.capturedAt.getTime());
      return args.take ? rows.slice(0, args.take) : rows;
    },
  };

  workApprovalQueueItem = {
    create: async (args: {
      data: Omit<FakeWorkApprovalRow, 'id' | 'createdAt' | 'decidedAt' | 'decidedByUserId' | 'decisionReason'> & {
        decidedAt?: Date | null;
        decidedByUserId?: string | null;
        decisionReason?: string | null;
      };
      select?: { id: true };
    }) => {
      const row: FakeWorkApprovalRow = {
        id: newId('wa'),
        workspaceId: args.data.workspaceId,
        agentSlug: args.data.agentSlug,
        kind: args.data.kind,
        refTable: args.data.refTable ?? null,
        refId: args.data.refId ?? null,
        status: args.data.status ?? 'PENDING',
        payload: args.data.payload ?? {},
        decidedAt: args.data.decidedAt ?? null,
        decidedByUserId: args.data.decidedByUserId ?? null,
        decisionReason: args.data.decisionReason ?? null,
        createdAt: new Date(),
      };
      this.workApprovals.push(row);
      return { id: row.id };
    },
    findFirst: async (args: { where: { id?: string; workspaceId?: string; status?: string } }) => {
      return (
        this.workApprovals.find((r) =>
          (args.where.id === undefined || r.id === args.where.id) &&
          (args.where.workspaceId === undefined || r.workspaceId === args.where.workspaceId) &&
          (args.where.status === undefined || r.status === args.where.status),
        ) ?? null
      );
    },
    findMany: async (args: { where: { workspaceId?: string } }) => {
      return this.workApprovals.filter(
        (r) =>
          args.where.workspaceId === undefined ||
          r.workspaceId === args.where.workspaceId,
      );
    },
    update: async (args: {
      where: { id: string };
      data: Partial<FakeWorkApprovalRow>;
    }) => {
      const row = this.workApprovals.find((r) => r.id === args.where.id);
      if (!row) throw new Error(`workApprovalQueueItem ${args.where.id} not found`);
      Object.assign(row, args.data);
      return row;
    },
  };

  handoffLogEntry = {
    createMany: async (args: { data: Omit<FakeHandoffRow, 'id'>[] }) => {
      for (const d of args.data) {
        this.handoffs.push({ id: newId('ho'), ...d });
      }
      return { count: args.data.length };
    },
  };

  workspace = {
    findFirst: async (args: { where: Partial<FakeWorkspaceRow>; select?: unknown }) => {
      const where = args.where;
      return (
        this.workspaces.find((w) =>
          Object.entries(where).every(([k, v]) => (w as unknown as Record<string, unknown>)[k] === v),
        ) ?? null
      );
    },
    findUnique: async (args: { where: { id: string } }) => {
      return this.workspaces.find((w) => w.id === args.where.id) ?? null;
    },
    update: async (args: {
      where: { id: string };
      data: Partial<FakeWorkspaceRow>;
    }) => {
      const row = this.workspaces.find((w) => w.id === args.where.id);
      if (!row) throw new Error(`workspace ${args.where.id} not found`);
      Object.assign(row, args.data);
      return row;
    },
  };

  subscription = {
    findUnique: async (args: { where: { stripeSubscriptionId: string }; select?: unknown }) => {
      return (
        this.subscriptions.find(
          (s) => s.stripeSubscriptionId === args.where.stripeSubscriptionId,
        ) ?? null
      );
    },
    upsert: async (args: {
      where: { stripeSubscriptionId: string };
      create: Omit<FakeSubscriptionRow, 'id'>;
      update: Partial<FakeSubscriptionRow>;
    }) => {
      const existing = this.subscriptions.find(
        (s) => s.stripeSubscriptionId === args.where.stripeSubscriptionId,
      );
      if (existing) {
        Object.assign(existing, args.update);
        return existing;
      }
      const row: FakeSubscriptionRow = { id: newId('sub'), ...args.create };
      this.subscriptions.push(row);
      return row;
    },
    update: async (args: {
      where: { stripeSubscriptionId: string };
      data: Partial<FakeSubscriptionRow>;
    }) => {
      const row = this.subscriptions.find(
        (s) => s.stripeSubscriptionId === args.where.stripeSubscriptionId,
      );
      if (!row) throw new Error(`subscription ${args.where.stripeSubscriptionId} not found`);
      Object.assign(row, args.data);
      return row;
    },
  };

  workspaceInvoice = {
    upsert: async (args: {
      where: { stripeInvoiceId: string };
      create: Omit<FakeWorkspaceInvoiceRow, 'id'>;
      update: Partial<FakeWorkspaceInvoiceRow>;
    }) => {
      const existing = this.workspaceInvoices.find(
        (i) => i.stripeInvoiceId === args.where.stripeInvoiceId,
      );
      if (existing) {
        Object.assign(existing, args.update);
        return existing;
      }
      const row: FakeWorkspaceInvoiceRow = { id: newId('inv'), ...args.create };
      this.workspaceInvoices.push(row);
      return row;
    },
  };

  billingEvent = {
    upsert: async (args: {
      where: { stripeEventId: string };
      create: Omit<FakeBillingEventRow, 'id'>;
      update: Partial<FakeBillingEventRow>;
    }) => {
      const existing = this.billingEvents.find(
        (e) => e.stripeEventId === args.where.stripeEventId,
      );
      if (existing) {
        Object.assign(existing, args.update);
        return existing;
      }
      const row: FakeBillingEventRow = { id: newId('be'), ...args.create };
      this.billingEvents.push(row);
      return row;
    },
  };

  auditLog = {
    create: async (args: { data: Omit<FakeAuditLogRow, 'id' | 'occurredAt'> }) => {
      const row: FakeAuditLogRow = {
        id: newId('al'),
        actorUserId: args.data.actorUserId ?? null,
        workspaceId: args.data.workspaceId ?? null,
        action: args.data.action,
        targetTable: args.data.targetTable ?? null,
        targetId: args.data.targetId ?? null,
        payload: args.data.payload ?? null,
        occurredAt: new Date(),
      };
      this.audits.push(row);
      return row;
    },
  };
}
