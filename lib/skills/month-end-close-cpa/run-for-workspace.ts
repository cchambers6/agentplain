/**
 * lib/skills/month-end-close-cpa/run-for-workspace.ts
 *
 * Production entry point for a CPA month-end-close run across a single
 * workspace. The base skill (`./skill.ts`) is per-CLIENT — it closes ONE
 * engagement. This wrapper does the workspace-level work the production
 * caller needs:
 *
 *   1. Enumerate the firm's clients from QuickBooks (the engagement source).
 *   2. Pick the period being closed (the prior calendar month at a
 *      month-end fire).
 *   3. Run the close skill per client, persisting each chase + status draft
 *      as a WorkApprovalQueueItem the CSM reviews in /approvals.
 *
 * Returns an aggregate result so the monthly sweep can report how many
 * engagements were prepped vs skipped (QuickBooks not connected, no email
 * on file, etc.) — distinguishing NOT_CONFIGURED (clean skip) from a real
 * error, exactly as the invoice-chase sweep does.
 *
 * Per `feedback_cold_start_safe_agents.md`: stateless — every call builds a
 * fresh fetcher + persister.
 *
 * Per `feedback_runner_portability.md`: the client lister + per-client
 * runner are injectable so the sweep + this function are testable without
 * Prisma or QuickBooks.
 */

import { buildQuickbooksMcpServer } from '@/lib/integrations/quickbooks-mcp';
import type { QuickbooksMcpServer } from '@/lib/integrations/quickbooks-mcp';
import { runSkill } from './skill';
import { PrismaCloseApprovalPersister } from './prisma-approval-persister';
import { QUICKBOOKS_NOT_CONNECTED_MESSAGE } from './quickbooks-fetcher';
import { QuickBooksCloseFetcher } from './quickbooks-fetcher';
import type { DraftPersister } from '../types';
import type { MonthEndCloseOutput } from './types';

/** One client the firm services — enumerated from QuickBooks. */
export interface CpaClient {
  clientId: string;
  /** Present only when QuickBooks has an email on file — clients without
   *  one are skipped (the close needs a chase recipient). */
  hasEmail: boolean;
}

export interface RunMonthEndCloseForWorkspaceInput {
  workspaceId: string;
  /** Period in `YYYY-MM` form. Defaults to the prior calendar month
   *  relative to `now` — the canonical "close last month" semantic. */
  periodMonth?: string;
  /** Fixed clock for deterministic tests. */
  now?: Date;
  /** Override the client lister. Production lists QuickBooks customers
   *  (with an email on file); tests inject a deterministic list. */
  listClients?: (args: {
    workspaceId: string;
  }) => Promise<{ ok: true; clients: CpaClient[] } | { ok: false; notConfigured: boolean; message: string }>;
  /** Override the per-client persister factory. Tests inject a recording
   *  persister so no Prisma connection is required. */
  buildPersister?: (workspaceId: string) => DraftPersister;
  /** Override the QuickBooks MCP server (tests inject a fixture server). */
  mcp?: QuickbooksMcpServer;
}

export interface MonthEndCloseForWorkspaceResult {
  ok: boolean;
  /** NOT_CONFIGURED → the firm has not connected QuickBooks; a clean skip. */
  notConfigured: boolean;
  periodMonth: string;
  clientsConsidered: number;
  clientsPrepped: number;
  clientsSkippedNoEmail: number;
  closesReady: number;
  /** One output per prepped client (for the sweep's audit log). */
  outputs: MonthEndCloseOutput[];
  failures: Array<{ clientId: string; reason: string }>;
}

/** Compute the prior calendar month in `YYYY-MM` form (UTC). */
export function priorMonth(now: Date): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  d.setUTCMonth(d.getUTCMonth() - 1);
  const yr = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${yr}-${mo}`;
}

export async function runMonthEndCloseForWorkspace(
  input: RunMonthEndCloseForWorkspaceInput,
): Promise<MonthEndCloseForWorkspaceResult> {
  const now = input.now ?? new Date();
  const periodMonth = input.periodMonth ?? priorMonth(now);
  const mcp = input.mcp ?? buildQuickbooksMcpServer({ workspaceId: input.workspaceId });
  const listClients = input.listClients ?? defaultListClients(mcp);
  const buildPersister =
    input.buildPersister ?? (() => new PrismaCloseApprovalPersister());

  const base: MonthEndCloseForWorkspaceResult = {
    ok: true,
    notConfigured: false,
    periodMonth,
    clientsConsidered: 0,
    clientsPrepped: 0,
    clientsSkippedNoEmail: 0,
    closesReady: 0,
    outputs: [],
    failures: [],
  };

  const listed = await listClients({ workspaceId: input.workspaceId });
  if (!listed.ok) {
    return {
      ...base,
      ok: !listed.notConfigured ? false : true,
      notConfigured: listed.notConfigured,
    };
  }

  base.clientsConsidered = listed.clients.length;
  const persister = buildPersister(input.workspaceId);

  for (const client of listed.clients) {
    if (!client.hasEmail) {
      base.clientsSkippedNoEmail += 1;
      continue;
    }
    try {
      const fetcher = new QuickBooksCloseFetcher({
        workspaceId: input.workspaceId,
        mcp,
      });
      const res = await runSkill({
        workspaceId: input.workspaceId,
        clientId: client.clientId,
        periodMonth,
        fetcher,
        persister,
        now,
      });
      if (!res.ok) {
        // NOT_CONFIGURED (QB disconnected mid-run) / NOT_APPLICABLE (client
        // has no email) are clean skips — name them, don't fail the sweep.
        if (res.error.code === 'NOT_CONFIGURED') {
          base.notConfigured = true;
          continue;
        }
        if (res.error.code === 'NOT_APPLICABLE') {
          base.clientsSkippedNoEmail += 1;
          continue;
        }
        base.failures.push({
          clientId: client.clientId,
          reason: `${res.error.code}: ${res.error.message}`,
        });
        continue;
      }
      base.clientsPrepped += 1;
      if (res.value.closeReady) base.closesReady += 1;
      base.outputs.push(res.value);
    } catch (err) {
      base.failures.push({
        clientId: client.clientId,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return base;
}

/**
 * Default client lister — enumerates QuickBooks customers and keeps the
 * active ones, flagging whether each has an email on file. A
 * credential/auth failure resolves to a NOT_CONFIGURED skip (the firm has
 * not connected QuickBooks) rather than a hard error.
 */
function defaultListClients(mcp: QuickbooksMcpServer) {
  return async (args: { workspaceId: string }) => {
    void args;
    const res = await mcp.listCustomers({ count: 100 });
    if (!res.ok) {
      const code = res.error.code;
      const notConfigured =
        code === 'CREDENTIAL_NOT_FOUND' ||
        code === 'TOKEN_EXPIRED' ||
        code === 'GRANT_REVOKED' ||
        code === 'WORKSPACE_NOT_FOUND';
      return {
        ok: false as const,
        notConfigured,
        message: notConfigured
          ? QUICKBOOKS_NOT_CONNECTED_MESSAGE
          : `QuickBooks listCustomers failed: ${res.error.message}`,
      };
    }
    const clients: CpaClient[] = res.value.customers
      .filter((c) => c.active !== false)
      .map((c) => ({
        clientId: c.id,
        hasEmail: !!c.email && c.email.trim().length > 0,
      }));
    return { ok: true as const, clients };
  };
}
