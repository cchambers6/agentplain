/**
 * lib/skills/month-end-close-cpa/taxdome-close-fetcher.ts
 *
 * Fourth implementation of `CloseFetcher` — production wiring that speaks
 * to TaxDome via the workspace-scoped TaxDome MCP
 * (`lib/integrations/taxdome-mcp`). The skill code does not change; per
 * `feedback_runner_portability.md`'s two-implementation rule the port is
 * already real, so this impl is purely additive.
 *
 * Per `feedback_no_silent_vendor_lock.md`: this file is the ONLY place
 * (besides `enrichment.ts`) the month-end-close skill touches TaxDome.
 * The skill itself sees `CloseFetcher` only.
 *
 * Per `project_no_outbound_architecture.md`: read-only. We `listClients`
 * + `listReceivedDocuments`; there is no write path on the TaxDome
 * contract today, so the no-outbound rule is satisfied by construction.
 *
 * Per `feedback_cold_start_safe_agents.md`: nothing is cached on the
 * instance — every fetch goes back through the MCP.
 *
 * ── HONESTY BAR — what the TaxDome read contract covers vs. what it cannot
 *    (verified against `lib/integrations/taxdome-mcp/types.ts`,
 *    `tools.ts`, the smoke test, and the TaxDome API docs note in
 *    `types.ts`) ──────────────────────────────────────────────────────────
 *
 *   ENGAGEMENT — derivable from `getClient` / `listClients`
 *     (`TaxdomeClientSummary` = id, name, email, active). HONEST GAPS:
 *       - TaxDome's summary has no "primary contact role" field, so we
 *         default `role: 'owner'` (same honest default the QuickBooks
 *         fetcher takes).
 *       - No cc-contact list on the summary → `ccContacts: []`.
 *       - No engagement scope on the contract → caller supplies `scope`
 *         (default `full-stack-monthly`), same as the QuickBooks fetcher.
 *       - `partnerSignoff` is a firm-internal sign-off state TaxDome does
 *         not model on this read surface → always `false` (the close is
 *         "in flight" until a human flips it). This is honest: we never
 *         claim a close is signed off when we cannot read that it is.
 *       - When the client has no email, we return NOT_APPLICABLE (a close
 *         needs a chase recipient) rather than fabricating one.
 *
 *   CHECKLIST — NOT in the TaxDome read contract. TaxDome has
 *     `listEngagementLetters` (it confirms an engagement letter EXISTS)
 *     but exposes no structured per-period document checklist. We derive
 *     the standard scope-templated checklist (the same honest pattern the
 *     QuickBooks fetcher uses — it matches the firm's engagement-letter
 *     pattern, not a field TaxDome stored). The Karbon fetcher is the
 *     one that derives a REAL checklist (from jobs); TaxDome's strength
 *     is the received-doc portal, not the task list.
 *
 *   RECEIVED DOCS — THIS is TaxDome's real strength. `listReceivedDocuments`
 *     returns client-uploaded docs (`kind === 'received-doc'`) with a real
 *     `status` (`pending-review` / `reviewed` / `sent-to-client` /
 *     `archived`), `uploadedAt`, and `filename`. We map every received-doc
 *     for the client into a `ReceivedDoc { source: 'taxdome' }`.
 *
 *     HONEST MAPPING GAP — TaxDome does not tell us WHICH checklist item a
 *     given upload satisfies (no `category` / `checklistItemId` on the
 *     contract). We do a best-effort filename → checklist-category keyword
 *     match; an upload we cannot confidently bucket is surfaced with
 *     `satisfiesChecklistItemId: null` so the skill renders it as an
 *     uncategorized receipt for the operator to triage — rather than
 *     guessing and falsely marking a checklist item received.
 */

import { buildTaxdomeMcpServer } from '@/lib/integrations/taxdome-mcp';
import type {
  TaxdomeDocumentSummary,
  TaxdomeMcpServer,
} from '@/lib/integrations/taxdome-mcp';
import { skillError, skillOk, type SkillResult } from '../types';
import {
  checklistForScope,
  deriveInternalDeadline,
  matchReceivedToChecklist,
  translateCpaMcpError,
} from './pm-fetcher-shared';
import type {
  ChecklistItem,
  ClientEngagement,
  CloseFetcher,
  EngagementScope,
  ReceivedDoc,
} from './types';

/** Honest message when TaxDome isn't connected yet for this workspace.
 *  Surfaces verbatim into the skill error so the operator notice reads as
 *  a calm "connect TaxDome" prompt. */
export const TAXDOME_NOT_CONNECTED_MESSAGE =
  'TaxDome is not yet connected for this workspace. Connect it from /integrations and Plaino will pull the received-doc portal into the next close.';

const DEFAULT_SCOPE: EngagementScope = 'full-stack-monthly';
const DEFAULT_DOC_COUNT = 100;

export interface TaxdomeCloseFetcherOptions {
  /** Override the MCP server — tests pass a fixture/mock TaxdomeMcpServer.
   *  Production omits this and the adapter builds the prod server. */
  mcp?: TaxdomeMcpServer;
  /** Per-engagement scope override. Defaults to `full-stack-monthly` so
   *  the skill enforces the long checklist; the firm narrows per-workspace
   *  config in a future iteration. */
  scope?: EngagementScope;
  /** Cap on received docs pulled per fire. Defaults to 100 (MCP max). */
  docCount?: number;
}

export class TaxdomeCloseFetcher implements CloseFetcher {
  readonly name = 'taxdome' as const;
  private readonly workspaceId: string;
  private readonly opts: Required<
    Pick<TaxdomeCloseFetcherOptions, 'scope' | 'docCount'>
  > & { mcp?: TaxdomeMcpServer };

  constructor(args: { workspaceId: string } & TaxdomeCloseFetcherOptions) {
    if (!args.workspaceId) {
      throw new Error('TaxdomeCloseFetcher: workspaceId is required');
    }
    this.workspaceId = args.workspaceId;
    this.opts = {
      mcp: args.mcp,
      scope: args.scope ?? DEFAULT_SCOPE,
      docCount: args.docCount ?? DEFAULT_DOC_COUNT,
    };
  }

  private mcp(): TaxdomeMcpServer {
    return (
      this.opts.mcp ?? buildTaxdomeMcpServer({ workspaceId: this.workspaceId })
    );
  }

  async fetchEngagement(args: {
    workspaceId: string;
    clientId: string;
    periodMonth: string;
  }): Promise<SkillResult<ClientEngagement>> {
    const guard = this.guard(args);
    if (guard) return guard;
    const res = await this.mcp().getClient({ clientId: args.clientId });
    if (!res.ok) {
      return translateCpaMcpError(res.error.code, res.error.message, {
        provider: 'TaxDome',
        notConnectedMessage: TAXDOME_NOT_CONNECTED_MESSAGE,
      });
    }
    const client = res.value.client;
    if (!client.email || client.email.trim().length === 0) {
      return skillError(
        'NOT_APPLICABLE',
        `TaxDome client ${args.clientId} has no email on file — month-end-close needs a primary contact`,
        'NO_EMAIL',
      );
    }
    return skillOk({
      clientId: client.id,
      clientName: client.name,
      primaryContact: {
        name: client.name,
        email: client.email,
        phone: null,
        // HONEST DEFAULT: TaxDome's summary has no contact-role field.
        role: 'owner',
      },
      ccContacts: [],
      periodMonth: args.periodMonth,
      scope: this.opts.scope,
      internalDeadline: deriveInternalDeadline(args.periodMonth),
      // HONEST: TaxDome does not model firm-internal partner sign-off on
      // this read surface — the close stays in flight until a human flips
      // it. We never claim signoff we cannot read.
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
    // HONEST GAP: TaxDome exposes no structured per-period checklist. We
    // derive the standard scope-templated list (matches the firm's
    // engagement-letter pattern). The Karbon fetcher is the one that
    // derives a real checklist from jobs.
    return skillOk(
      checklistForScope(this.opts.scope, args.periodMonth, deriveInternalDeadline(args.periodMonth)),
    );
  }

  async fetchReceivedDocs(args: {
    workspaceId: string;
    clientId: string;
    periodMonth: string;
  }): Promise<SkillResult<ReceivedDoc[]>> {
    const guard = this.guard(args);
    if (guard) return guard;
    // TaxDome's REAL strength: the received-doc portal. Pull the client's
    // uploaded docs and bucket them honestly against the templated
    // checklist by filename keyword. Unmatched uploads → uncategorized.
    const res = await this.mcp().listReceivedDocuments({
      clientId: args.clientId,
      count: this.opts.docCount,
    });
    if (!res.ok) {
      return translateCpaMcpError(res.error.code, res.error.message, {
        provider: 'TaxDome',
        notConnectedMessage: TAXDOME_NOT_CONNECTED_MESSAGE,
      });
    }
    const checklist = checklistForScope(
      this.opts.scope,
      args.periodMonth,
      deriveInternalDeadline(args.periodMonth),
    );
    // We do NOT treat archived docs as fresh receipts — an archived doc is
    // from a prior period or a superseded upload. `sent-to-client` is the
    // firm's OUTPUT, not a client receipt, so we exclude it too. Honest
    // received set = docs the client uploaded that are awaiting or have
    // had firm review for THIS engagement.
    const received: ReceivedDoc[] = res.value.receivedDocuments
      .filter((d) => d.status === 'pending-review' || d.status === 'reviewed')
      .map((d) => toReceivedDoc(d, checklist));
    return skillOk(received);
  }

  private guard(args: {
    workspaceId: string;
    clientId: string;
    periodMonth: string;
  }): SkillResult<never> | null {
    if (args.workspaceId !== this.workspaceId) {
      return skillError(
        'INVALID_INPUT',
        `TaxdomeCloseFetcher bound to ${this.workspaceId}, asked for ${args.workspaceId}`,
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

function toReceivedDoc(
  doc: TaxdomeDocumentSummary,
  checklist: ChecklistItem[],
): ReceivedDoc {
  const matchedItemId = matchReceivedToChecklist(doc.filename, checklist);
  return {
    id: doc.id,
    // HONEST: null when we cannot confidently bucket the filename → the
    // skill surfaces it as an uncategorized receipt for operator triage
    // rather than falsely marking a checklist item received.
    satisfiesChecklistItemId: matchedItemId,
    receivedAt: new Date(doc.uploadedAt),
    filename: doc.filename,
    source: 'taxdome',
  };
}
