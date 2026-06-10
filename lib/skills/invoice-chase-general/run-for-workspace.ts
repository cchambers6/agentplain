/**
 * lib/skills/invoice-chase-general/run-for-workspace.ts
 *
 * Production entry point for one invoice-chase-general run against a
 * single workspace. Composes:
 *
 *   gateSkillFire   — vacation / scheduling-window gate
 *   isWorkspacePaused — billing-pause gate
 *   QuickBooksArFetcher — real QuickBooks AR pull
 *   runSkill        — draft generation
 *   PrismaInvoiceChaseApprovalSink — approval queue write
 *
 * Returns the raw `SkillResult` so the cron sweep can distinguish
 * NOT_CONFIGURED (skip) from real errors (report to Sentry).
 *
 * Per `feedback_cold_start_safe_agents.md`: stateless — every call
 * constructs a fresh fetcher and sink.
 *
 * Per `fire-gate.ts` + how `follow-up-chaser-sweep.ts` uses it:
 * gate checks are CALLER-side so this function can be tested without
 * standing up Prisma. The sweep function handles the gates; this
 * function assumes gates already passed when called directly.
 */

import { QuickBooksArFetcher } from './quickbooks-ar-fetcher';
import type { QuickBooksArFetcherOptions } from './quickbooks-ar-fetcher';
import { runSkill } from './skill';
import { PrismaInvoiceChaseApprovalSink } from './prisma-approval-sink';
import type { SkillResult } from '../types';
import type {
  ArAgingFetcher,
  InvoiceChaseApprovalSink,
  InvoiceChaseInput,
  InvoiceChaseOutput,
} from './types';

export interface RunInvoiceChaseForWorkspaceInput
  extends Omit<InvoiceChaseInput, 'sink' | 'fetcher'> {
  /** Override the fetcher — defaults to QuickBooksArFetcher. Tests pass
   *  an inline fixture fetcher. */
  fetcher?: ArAgingFetcher;
  /** Override the sink — defaults to PrismaInvoiceChaseApprovalSink. Pass
   *  null to suppress persistence (dry-run). */
  sink?: InvoiceChaseApprovalSink | null;
  /** Pass QuickBooks MCP options through to the default fetcher. */
  quickbooksOptions?: Pick<
    QuickBooksArFetcherOptions,
    'mcp' | 'invoiceCount' | 'customerCount'
  >;
}

export async function runInvoiceChaseForWorkspace(
  input: RunInvoiceChaseForWorkspaceInput,
): Promise<SkillResult<InvoiceChaseOutput>> {
  const fetcher =
    input.fetcher ??
    new QuickBooksArFetcher({
      workspaceId: input.workspaceId,
      ...input.quickbooksOptions,
    });
  const sink =
    input.sink === undefined ? new PrismaInvoiceChaseApprovalSink() : input.sink;
  return runSkill({
    ...input,
    fetcher,
    sink: sink ?? undefined,
  });
}
