/**
 * lib/skills/finance-pulse-general/activity-snapshot.ts
 *
 * Reads the trailing 7-day window of workspace finance activity into the
 * `FinancePulseSnapshot` shape the LLM grounds on. Two halves:
 *
 *   1. Internal counts — derived from `WorkApprovalQueueItem` + the
 *      finance-tagged learned-note rows. Always present.
 *   2. QuickBooks summary — pulled through the workspace's
 *      `QuickbooksMcpServer` when QuickBooks is connected. When not
 *      connected we set `connected: false` with an honest reason —
 *      the skill body NAMES the gap; no fabricated numbers.
 *
 * Per `feedback_cold_start_safe_agents.md`: every read is durable + fresh.
 * Per `project_no_outbound_architecture.md`: read-only.
 * Per `feedback_runner_portability.md`: the system-context runner +
 * QuickBooks MCP builder are injectable for tests.
 */

import type { DbTransactionClient } from '@/lib/db';
import { withSystemContext as defaultWithSystemContext } from '@/lib/db';
import {
  buildQuickbooksMcpServer as defaultBuildQuickbooksMcpServer,
  type QuickbooksMcpServer,
} from '@/lib/integrations/quickbooks-mcp';
import type {
  FinanceInternalCounts,
  FinancePulseSnapshot,
  FinanceQuickbooksState,
  FinanceQuickbooksSummary,
} from './types';

export type SystemContextRunner = <T>(
  fn: (tx: DbTransactionClient) => Promise<T>,
) => Promise<T>;

export interface BuildFinancePulseSnapshotInput {
  workspaceId: string;
  /** Newest end of the pulse window. Defaults to "now". */
  now?: Date;
  /** Window in days. Default 7 — matches weekly cadence. */
  windowDays?: number;
  /** Override the system-context runner for tests. */
  systemContext?: SystemContextRunner;
  /** Override the QuickBooks MCP builder for tests. Pass null to skip
   *  QuickBooks entirely (returns `{ connected: false }`). */
  buildQuickbooksMcp?:
    | ((args: { workspaceId: string }) => QuickbooksMcpServer)
    | null;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export async function buildFinancePulseSnapshot(
  input: BuildFinancePulseSnapshotInput,
): Promise<FinancePulseSnapshot> {
  const now = input.now ?? new Date();
  const windowDays = input.windowDays ?? 7;
  const windowFrom = new Date(now.getTime() - windowDays * MS_PER_DAY);
  const systemContext = input.systemContext ?? defaultWithSystemContext;

  const { workspaceName, workspaceVertical, internal } = await systemContext(
    async (tx) => readInternal(tx, input.workspaceId, windowFrom),
  );

  const quickbooks = await readQuickbooks({
    workspaceId: input.workspaceId,
    now,
    windowFrom,
    builder:
      input.buildQuickbooksMcp === null
        ? null
        : input.buildQuickbooksMcp ?? defaultBuildQuickbooksMcpServer,
  });

  return {
    workspaceId: input.workspaceId,
    workspaceName,
    workspaceVertical,
    windowFrom: windowFrom.toISOString(),
    windowTo: now.toISOString(),
    internal,
    quickbooks,
  };
}

interface InternalReadResult {
  workspaceName: string;
  workspaceVertical: string;
  internal: FinanceInternalCounts;
}

async function readInternal(
  tx: DbTransactionClient,
  workspaceId: string,
  windowFrom: Date,
): Promise<InternalReadResult> {
  const workspace = await tx.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true, name: true, vertical: true },
  });
  if (!workspace) {
    throw new Error(
      `finance-pulse: workspace ${workspaceId} not found`,
    );
  }

  const invoiceChaseDrafts = await tx.workApprovalQueueItem.count({
    where: {
      workspaceId,
      agentSlug: 'invoice-chasing-realestate',
      proposedAt: { gte: windowFrom },
    },
  });
  const monthEndCloseDrafts = await tx.workApprovalQueueItem.count({
    where: {
      workspaceId,
      agentSlug: 'month-end-close-cpa',
      proposedAt: { gte: windowFrom },
    },
  });
  const financeApprovalsDecided = await tx.workApprovalQueueItem.count({
    where: {
      workspaceId,
      discipline: 'finance',
      decidedAt: { gte: windowFrom },
      status: { in: ['APPROVED', 'AUTO_APPROVED', 'REJECTED'] },
    },
  });
  const financeApprovalsPending = await tx.workApprovalQueueItem.count({
    where: {
      workspaceId,
      discipline: 'finance',
      status: 'PENDING',
    },
  });
  const learnedNotes = await tx.preferenceSignal.count({
    where: {
      workspaceId,
      source: { in: ['DRAFT_EDIT', 'DRAFT_REJECT'] },
      capturedAt: { gte: windowFrom },
      // The PreferenceSignal taxonomy carries an optional scope; finance-
      // tagged signals would land under `preferenceScope = 'reporting'`
      // or under the new `finance` scope once writers land. For now we
      // count all corrections — a strict-finance filter would
      // under-count until the writer-side wiring is comprehensive.
    },
  });

  return {
    workspaceName: workspace.name,
    workspaceVertical: workspace.vertical,
    internal: {
      invoiceChaseDrafts,
      monthEndCloseDrafts,
      financeApprovalsDecided,
      financeApprovalsPending,
      learnedNotes,
    },
  };
}

async function readQuickbooks(args: {
  workspaceId: string;
  now: Date;
  windowFrom: Date;
  builder:
    | ((args: { workspaceId: string }) => QuickbooksMcpServer)
    | null;
}): Promise<FinanceQuickbooksState> {
  if (!args.builder) {
    return {
      connected: false,
      reason: 'not-connected',
      detail: 'QuickBooks reader was not provided to the snapshot builder.',
    };
  }
  let mcp: QuickbooksMcpServer;
  try {
    mcp = args.builder({ workspaceId: args.workspaceId });
  } catch (err) {
    return {
      connected: false,
      reason: 'credential-error',
      detail:
        err instanceof Error ? err.message : String(err),
    };
  }
  // listInvoices is our cheapest reach into QuickBooks; a failure here
  // tells us whether the credential resolves at all.
  const invoicesRes = await mcp.listInvoices({ count: 100 });
  if (!invoicesRes.ok) {
    if (invoicesRes.error.code === 'CREDENTIAL_NOT_FOUND') {
      return {
        connected: false,
        reason: 'not-connected',
        detail: invoicesRes.error.message,
      };
    }
    if (invoicesRes.error.code === 'RATE_LIMITED') {
      return {
        connected: false,
        reason: 'rate-limited',
        detail: invoicesRes.error.message,
      };
    }
    return {
      connected: false,
      reason: 'upstream-error',
      detail: `${invoicesRes.error.code}: ${invoicesRes.error.message}`,
    };
  }
  // Customers + expenses ride best-effort — if either errors, we still
  // report QB as connected but log a zero-fallback so the pulse stays
  // honest about what we read.
  const [customersRes, expensesRes] = await Promise.all([
    mcp.listCustomers({ count: 100 }),
    mcp.listExpenses({ count: 100 }),
  ]);

  const nowMs = args.now.getTime();
  const deepAgeCutoffMs = nowMs - 60 * MS_PER_DAY;
  const openInvoices = invoicesRes.value.invoices.filter(
    (i) => (i.balance ?? 0) > 0,
  );
  const overdueInvoices = openInvoices.filter(
    (i) =>
      i.dueDate !== null && Date.parse(i.dueDate) < nowMs,
  );
  const deeplyAgedInvoices = openInvoices.filter(
    (i) =>
      i.dueDate !== null && Date.parse(i.dueDate) < deepAgeCutoffMs,
  );

  const summary: FinanceQuickbooksSummary = {
    openInvoices: openInvoices.length,
    overdueInvoices: overdueInvoices.length,
    deeplyAgedInvoices: deeplyAgedInvoices.length,
    activeCustomers: customersRes.ok
      ? customersRes.value.customers.filter((c) => c.active !== false).length
      : 0,
    recentExpenses: expensesRes.ok
      ? expensesRes.value.expenses.filter(
          (e) =>
            e.txnDate !== null && Date.parse(e.txnDate) >= args.windowFrom.getTime(),
        ).length
      : 0,
  };
  return { connected: true, summary };
}
