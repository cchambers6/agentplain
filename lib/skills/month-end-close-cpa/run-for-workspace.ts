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
import { buildGmailMcpServer } from '@/lib/integrations/gmail-mcp';
import type { GmailMcpServer } from '@/lib/integrations/gmail-mcp';
import { readMonthEndCloseConfig } from '@/lib/skills/config';
import type { MonthEndCloseConfig } from '@/lib/skills/config';
import { GmailCloseFetcher } from './gmail-close-fetcher';
import type { CloseFetcher } from './types';
import { runSkill } from './skill';
import { PrismaCloseApprovalPersister } from './prisma-approval-persister';
import { QUICKBOOKS_NOT_CONNECTED_MESSAGE } from './quickbooks-fetcher';
import { QuickBooksCloseFetcher } from './quickbooks-fetcher';
import type { DraftPersister } from '../types';
import type { MonthEndCloseOutput } from './types';

/** One client the firm services -- enumerated from QuickBooks. */
export interface CpaClient {
  clientId: string;
  /** Present only when QuickBooks has an email on file -- clients without
   *  one are skipped (the close needs a chase recipient). */
  hasEmail: boolean;
  /** The email itself. Kept (it used to be discarded) because the Gmail
   *  received-doc scan MUST be scoped to this client's correspondence --
   *  an unscoped inbox scan would credit one client's bank statement to
   *  another client's checklist. */
  email?: string | null;
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
  /**
   * Gmail MCP server used to DETECT documents the client has already
   * emailed. Production builds one per workspace; tests inject a fixture.
   *
   * Pass `null` to force the pre-fix QuickBooks-only behaviour (every
   * checklist item pending-or-late). That is not a mode anyone should want;
   * it exists so a test can pin the old shape.
   */
  gmail?: GmailMcpServer | null;
  /** How far back the Gmail scan looks, in days. Default 60 -- a month-end
   *  close runs on the PRIOR month, so a 30-day window can miss documents
   *  emailed early in the period. */
  gmailLookbackDays?: number;
  /** Max messages scanned per client. Default 25 -- the GmailCloseFetcher's
   *  own default. The scan is per-client (scoped `from:`), so a firm with
   *  100 QuickBooks customers costs up to 100 list + 2,500 get calls per
   *  monthly fire. Well inside Gmail quota at monthly cadence, but the
   *  number is stated here rather than left to be discovered. */
  gmailMaxMessages?: number;
  /**
   * Per-engagement scope source. Defaults to the workspace's SkillConfig
   * row (`readMonthEndCloseConfig`), which is the only honest source that
   * exists today -- QuickBooks carries no engagement-scope field. Injected
   * in tests so no Postgres is required.
   */
  readConfig?: (workspaceId: string) => Promise<MonthEndCloseConfig>;
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
  const lookbackDays = input.gmailLookbackDays ?? 60;
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

  // Read ONCE per fire, not per client: the scope map is workspace-scoped
  // and a per-client read would be N decrypts for one row.
  const readConfig = input.readConfig ?? ((ws: string) => readMonthEndCloseConfig(ws));
  let scopeConfig: MonthEndCloseConfig;
  try {
    scopeConfig = await readConfig(input.workspaceId);
  } catch (err) {
    // A config read failure must not cancel a firm's close. Fall back to the
    // documented default and say so.
    console.warn(
      `month-end-close-cpa: scope config read failed for ${input.workspaceId} (` +
        `${err instanceof Error ? err.message : String(err)}) -- using full-stack-monthly`,
    );
    scopeConfig = { defaultScope: 'full-stack-monthly', scopeByClientId: {} };
  }

  const gmailServer =
    input.gmail === null
      ? null
      : (input.gmail ?? buildGmailMcpServer({ workspaceId: input.workspaceId }));

  for (const client of listed.clients) {
    if (!client.hasEmail) {
      base.clientsSkippedNoEmail += 1;
      continue;
    }
    try {
      // The engagement scope drives which documents the checklist
      // enumerates. Without this, a tax-only client was chased for a
      // payroll register and a sales-tax filing every single month: the
      // option existed and was tested, and had no caller.
      const scope =
        scopeConfig.scopeByClientId[client.clientId] ?? scopeConfig.defaultScope;

      // COMPOSITION, not replacement. QuickBooks owns the engagement and
      // the checklist (it is the system of record for the customer); Gmail
      // owns received-doc detection, because QuickBooksCloseFetcher's
      // `fetchReceivedDocs` returns [] unconditionally and says so in its
      // own header. Wiring QuickBooks alone made every item pending-or-late
      // for every client, forever. `skill.ts` is unchanged -- the
      // `CloseFetcher` port already permitted this.
      const quickbooks = new QuickBooksCloseFetcher({
        workspaceId: input.workspaceId,
        mcp,
        scope,
      });
      const clientEmail = client.email?.trim();
      const fetcher: CloseFetcher =
        gmailServer && clientEmail
          ? new GmailCloseFetcher({
              base: quickbooks,
              gmail: gmailServer,
              // Scoped to THIS client's correspondence. An unscoped scan
              // would credit one client's statement to another's checklist.
              // No `has:attachment`: the extension allowlist is the real
              // filter (see gmail-close-fetcher.ts).
              query: `from:${clientEmail} newer_than:${lookbackDays}d`,
              maxMessages: input.gmailMaxMessages ?? 25,
            })
          : quickbooks;
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
        email: c.email ?? null,
      }));
    return { ok: true as const, clients };
  };
}
