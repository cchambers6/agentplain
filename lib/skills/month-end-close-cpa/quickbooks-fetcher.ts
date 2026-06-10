/**
 * lib/skills/month-end-close-cpa/quickbooks-fetcher.ts
 *
 * Third implementation of `CloseFetcher` — the production wiring that
 * speaks to QuickBooks Online via the workspace-scoped QuickBooks MCP
 * (`lib/integrations/quickbooks-mcp`). The skill code does not change;
 * per `feedback_runner_portability.md`'s two-implementation rule the
 * port is real, so a third impl is purely additive.
 *
 * Per `feedback_no_silent_vendor_lock.md`: this file is the ONLY place
 * the month-end-close skill touches QuickBooks. The skill itself sees
 * `CloseFetcher` only.
 *
 * Per `project_no_outbound_architecture.md`: read-only. We list customers
 * + invoices + expenses; we never call `createInvoice` or `recordPayment`
 * from this adapter.
 *
 * HONESTY BAR — what QuickBooks covers vs. what it cannot:
 *
 *   ENGAGEMENT — derivable from the QuickBooks customer record (id,
 *     display name, email). QB has no "primary contact role" field, so
 *     we default to `owner`; the firm can override per engagement in a
 *     future config UI.
 *
 *   CHECKLIST — NOT in QuickBooks. We derive a templated checklist from
 *     the engagement scope (bookkeeping-only → bank + cc; full-stack →
 *     the long list). This is honest because it matches the standard CPA
 *     engagement-letter pattern, not because QB stored it. When the firm
 *     wants engagement-specific items (one-off requests, K-1s, depreciation
 *     schedules) the JSON fetcher path is the answer for that workspace
 *     until TaxDome / Karbon MCPs land.
 *
 *   RECEIVED DOCS — NOT in QuickBooks (those live in Gmail attachments
 *     and TaxDome / Karbon document portals). This adapter returns an
 *     empty array. The skill will then bucket every checklist item as
 *     `pending` or `late` based on `dueAt` vs `now`. That's the honest
 *     answer: "QB doesn't track doc receipt; here's what's outstanding
 *     according to the checklist."
 *
 * Per `feedback_cold_start_safe_agents.md`: nothing is cached on the
 * instance — every fetch goes back through the MCP.
 */

import { buildQuickbooksMcpServer } from '@/lib/integrations/quickbooks-mcp';
import type { QuickbooksMcpServer } from '@/lib/integrations/quickbooks-mcp';
import { skillError, skillOk, type SkillResult } from '../types';
import { checklistForScope, deriveInternalDeadline } from './pm-fetcher-shared';
import type {
  ChecklistItem,
  ClientEngagement,
  CloseFetcher,
  EngagementScope,
  ReceivedDoc,
} from './types';

/** Honest message when QuickBooks isn't connected yet for this workspace.
 *  Surfaces verbatim into the skill error so the operator notice on the
 *  /approvals page reads as a calm "connect QuickBooks" prompt. */
export const QUICKBOOKS_NOT_CONNECTED_MESSAGE =
  'QuickBooks is not yet connected for this workspace. Connect it from /integrations and Plaino will derive month-end engagement detail on the next fire.';

export interface QuickBooksCloseFetcherOptions {
  /** Override the MCP server — tests pass a TestQuickbooksMcpServer.
   *  Production omits this and the adapter builds the prod server. */
  mcp?: QuickbooksMcpServer;
  /** Per-engagement scope override. Defaults to `full-stack-monthly` so
   *  the skill enforces the long checklist; the firm narrows the scope
   *  via per-workspace config in a future iteration. */
  scope?: EngagementScope;
  /** Cap on customers pulled per fire. Defaults to 100 (MCP max). */
  customerCount?: number;
}

const DEFAULT_CUSTOMER_COUNT = 100;
const DEFAULT_SCOPE: EngagementScope = 'full-stack-monthly';

export class QuickBooksCloseFetcher implements CloseFetcher {
  readonly name = 'quickbooks' as const;
  private readonly workspaceId: string;
  private readonly opts: Required<
    Pick<QuickBooksCloseFetcherOptions, 'customerCount' | 'scope'>
  > & { mcp?: QuickbooksMcpServer };

  constructor(args: { workspaceId: string } & QuickBooksCloseFetcherOptions) {
    if (!args.workspaceId) {
      throw new Error('QuickBooksCloseFetcher: workspaceId is required');
    }
    this.workspaceId = args.workspaceId;
    this.opts = {
      mcp: args.mcp,
      scope: args.scope ?? DEFAULT_SCOPE,
      customerCount: args.customerCount ?? DEFAULT_CUSTOMER_COUNT,
    };
  }

  private mcp(): QuickbooksMcpServer {
    return (
      this.opts.mcp ??
      buildQuickbooksMcpServer({ workspaceId: this.workspaceId })
    );
  }

  async fetchEngagement(args: {
    workspaceId: string;
    clientId: string;
    periodMonth: string;
  }): Promise<SkillResult<ClientEngagement>> {
    const guard = this.guard(args);
    if (guard) return guard;
    const res = await this.mcp().listCustomers({ count: this.opts.customerCount });
    if (!res.ok) return translateMcpError(res.error.code, res.error.message);
    const customer = res.value.customers.find((c) => c.id === args.clientId);
    if (!customer) {
      return skillError(
        'NOT_APPLICABLE',
        `QuickBooks has no customer with id ${args.clientId} in this workspace`,
        'NOT_FOUND',
      );
    }
    if (!customer.email || customer.email.trim().length === 0) {
      return skillError(
        'NOT_APPLICABLE',
        `QuickBooks customer ${args.clientId} has no email on file — month-end-close needs a primary contact`,
        'NO_EMAIL',
      );
    }
    const internalDeadline = deriveInternalDeadline(args.periodMonth);
    return skillOk({
      clientId: customer.id,
      clientName: customer.displayName ?? customer.email,
      primaryContact: {
        name: customer.displayName ?? customer.email,
        email: customer.email,
        phone: null,
        role: 'owner',
      },
      ccContacts: [],
      periodMonth: args.periodMonth,
      scope: this.opts.scope,
      internalDeadline,
      partnerSignoff: false,
    });
  }

  async fetchChecklist(args: {
    workspaceId: string;
    clientId: string;
    periodMonth: string;
  }): Promise<SkillResult<ChecklistItem[]>> {
    const guard = this.guard(args);
    if (guard) return guard;
    // QuickBooks does not store CPA engagement checklists. Derive the
    // standard list from the scope — honest because the firm's
    // engagement letter declares the same items. The skill then chases
    // what is missing.
    const due = deriveInternalDeadline(args.periodMonth);
    return skillOk(checklistForScope(this.opts.scope, args.periodMonth, due));
  }

  async fetchReceivedDocs(args: {
    workspaceId: string;
    clientId: string;
    periodMonth: string;
  }): Promise<SkillResult<ReceivedDoc[]>> {
    const guard = this.guard(args);
    if (guard) return guard;
    // QuickBooks does not store doc-portal receipts. Returning empty is
    // the honest answer — the skill will mark everything pending/late
    // and draft the chase. When the firm connects TaxDome / Karbon /
    // Gmail-attachment MCPs the received-doc count starts flowing.
    return skillOk([]);
  }

  private guard(args: {
    workspaceId: string;
    clientId: string;
    periodMonth: string;
  }): SkillResult<never> | null {
    if (args.workspaceId !== this.workspaceId) {
      return skillError(
        'INVALID_INPUT',
        `QuickBooksCloseFetcher bound to ${this.workspaceId}, asked for ${args.workspaceId}`,
      );
    }
    if (!args.clientId) {
      return skillError('INVALID_INPUT', 'clientId is required');
    }
    if (!/^\d{4}-\d{2}$/.test(args.periodMonth)) {
      return skillError(
        'INVALID_INPUT',
        `periodMonth must be YYYY-MM, got ${args.periodMonth}`,
      );
    }
    return null;
  }
}

function translateMcpError(
  code: string,
  message: string,
): SkillResult<never> {
  if (
    code === 'CREDENTIAL_NOT_FOUND' ||
    code === 'TOKEN_EXPIRED' ||
    code === 'GRANT_REVOKED' ||
    code === 'UNAUTHORIZED' ||
    code === 'FORBIDDEN'
  ) {
    return skillError('NOT_CONFIGURED', QUICKBOOKS_NOT_CONNECTED_MESSAGE, code);
  }
  return skillError(
    'UPSTREAM_GMAIL_ERROR',
    `QuickBooks: ${message}`,
    code,
  );
}
