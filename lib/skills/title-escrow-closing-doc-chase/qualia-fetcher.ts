/**
 * lib/skills/title-escrow-closing-doc-chase/qualia-fetcher.ts
 *
 * Production wiring of the `ClosingFileFetcher` port to Qualia via the
 * workspace-scoped Qualia MCP server (`lib/integrations/qualia-mcp`). This
 * resolves the keystone audit finding for the title-escrow family: the
 * `ClosingFileFetcher` PORT already existed (with `JsonClosingFileFetcher`
 * as the second impl and "SoftPro / Qualia / RamQuest MCP" noted in
 * json-fetcher.ts) — this is the ADAPTER that was missing.
 *
 * Per `feedback_runner_portability.md`'s two-implementation rule, adding a
 * real impl behind the existing port is purely additive — skill.ts does not
 * change.
 *
 * Per `feedback_no_silent_vendor_lock.md`: the ONLY place the closing-doc
 * skill touches Qualia, and it only ever speaks the `QualiaMcpServer`
 * interface — never raw Qualia JSON.
 *
 * Per `project_no_outbound_architecture.md`: read-only. We read the order +
 * checklist + receipts; we never write back to Qualia.
 *
 * Per `feedback_cold_start_safe_agents.md`: nothing is cached on the
 * instance — each fetch builds the server fresh (which re-reads the flag +
 * re-resolves the credential), so a flag flip / key rotation lands on the
 * next fire.
 *
 * Honesty seam — when Qualia isn't configured (no credential, or a 401) the
 * fetcher returns a NOT_CONFIGURED skill error with a calm "connect Qualia"
 * message rather than throwing or faking a closing file.
 *
 * Honest mapping gaps (documented, not faked): Qualia's order does not
 * guarantee a closing-coordinator contact on every file. When it is absent
 * the fetcher surfaces an operator-merge placeholder ContactPerson so the
 * draft still has a signature line the human fills in — it never invents a
 * real name/email.
 */

import { buildQualiaMcpServer } from '@/lib/integrations/qualia-mcp';
import type {
  QualiaMcpServer,
  QualiaOrderSummary,
  QualiaPartyRole,
} from '@/lib/integrations/qualia-mcp';
import { skillError, skillOk, type SkillResult } from '../types';
import type {
  ChecklistItem,
  ClosingFile,
  ClosingFileFetcher,
  ClosingParty,
  ContactPerson,
  ReceivedDoc,
} from './types';

/** Calm message surfaced when Qualia isn't usable yet for this workspace. */
export const QUALIA_NOT_CONNECTED_MESSAGE =
  'Qualia is not yet connected for this workspace. Connect it from /integrations (and set QUALIA_ADAPTER_LIVE=on) and Plaino will pick up the closing checklist on the next fire.';

/** Operator-merge placeholder closing coordinator. Used only when Qualia's
 *  order carries no coordinator — the draft signs with an operator merge
 *  field the closing team fills in rather than a fabricated contact. */
const OPERATOR_COORDINATOR_PLACEHOLDER: ContactPerson = {
  name: '{{operator: closing coordinator name}}',
  email: '{{operator: closing coordinator email}}',
  role: 'underwriter',
};

export interface QualiaClosingFetcherOptions {
  /** Override the MCP server — tests pass a TestQualiaMcpServer or stub.
   *  Production omits this and the fetcher builds the flagged server. */
  mcp?: QualiaMcpServer;
}

export class QualiaClosingFileFetcher implements ClosingFileFetcher {
  readonly name = 'qualia' as const;
  private readonly workspaceId: string;
  private readonly opts: QualiaClosingFetcherOptions;

  constructor(args: { workspaceId: string } & QualiaClosingFetcherOptions) {
    if (!args.workspaceId) throw new Error('QualiaClosingFileFetcher: workspaceId is required');
    this.workspaceId = args.workspaceId;
    this.opts = { mcp: args.mcp };
  }

  /** Build the server fresh per call — cold-start safe (re-reads flag+cred). */
  private mcp(): QualiaMcpServer {
    return this.opts.mcp ?? buildQualiaMcpServer({ workspaceId: this.workspaceId });
  }

  async fetchFile(args: { workspaceId: string; fileId: string }): Promise<SkillResult<ClosingFile>> {
    const order = await this.load(args);
    if (!order.ok) return order;
    return skillOk(toClosingFile(order.value.order));
  }

  async fetchChecklist(args: {
    workspaceId: string;
    fileId: string;
  }): Promise<SkillResult<ChecklistItem[]>> {
    const order = await this.load(args);
    if (!order.ok) return order;
    return skillOk(order.value.checklist.map(toChecklistItem));
  }

  async fetchReceivedDocs(args: {
    workspaceId: string;
    fileId: string;
  }): Promise<SkillResult<ReceivedDoc[]>> {
    const order = await this.load(args);
    if (!order.ok) return order;
    return skillOk(order.value.receivedDocs.map(toReceivedDoc));
  }

  private async load(args: {
    workspaceId: string;
    fileId: string;
  }): Promise<
    SkillResult<{
      order: QualiaOrderSummary;
      checklist: import('@/lib/integrations/qualia-mcp').QualiaChecklistItem[];
      receivedDocs: import('@/lib/integrations/qualia-mcp').QualiaReceivedDoc[];
    }>
  > {
    if (args.workspaceId !== this.workspaceId) {
      return skillError(
        'INVALID_INPUT',
        `QualiaClosingFileFetcher bound to ${this.workspaceId}, asked for ${args.workspaceId}`,
      );
    }
    const res = await this.mcp().getClosingOrder({ orderId: args.fileId });
    if (!res.ok) return translateMcpError(res.error.code, res.error.message);
    return skillOk(res.value);
  }
}

/** Translate a Qualia MCP error into a skill error. Auth-class codes surface
 *  the calm NOT_CONFIGURED notice; everything else surfaces the raw upstream
 *  message under the shared UPSTREAM_GMAIL_ERROR code the skill speaks. */
function translateMcpError(code: string, message: string): SkillResult<never> {
  if (
    code === 'CREDENTIAL_NOT_FOUND' ||
    code === 'UNAUTHORIZED' ||
    code === 'FORBIDDEN' ||
    code === 'TOKEN_EXPIRED' ||
    code === 'GRANT_REVOKED'
  ) {
    return skillError('NOT_CONFIGURED', QUALIA_NOT_CONNECTED_MESSAGE, code);
  }
  return skillError('UPSTREAM_GMAIL_ERROR', `Qualia: ${message}`, code);
}

function toContact(party: { name: string; email: string | null; role: QualiaPartyRole }): ContactPerson {
  return {
    name: party.name,
    // The skill addresses chase emails by recipient; a party with no email
    // gets an operator-merge placeholder rather than a fabricated address.
    email: party.email ?? '{{operator: contact email}}',
    role: party.role as ClosingParty,
  };
}

export function toClosingFile(order: QualiaOrderSummary): ClosingFile {
  return {
    fileId: order.id,
    propertyAddress: order.propertyAddress,
    scheduledClosingDate: order.scheduledClosingDate ?? '{{operator: scheduled closing date}}',
    closingCoordinator: order.closingCoordinator
      ? toContact(order.closingCoordinator)
      : OPERATOR_COORDINATOR_PLACEHOLDER,
    contacts: order.parties.map(toContact),
  };
}

export function toChecklistItem(item: {
  id: string;
  label: string;
  responsibleParty: QualiaPartyRole;
  dueDate: string | null;
  required: boolean;
}): ChecklistItem {
  return {
    id: item.id,
    label: item.label,
    responsibleParty: item.responsibleParty as ClosingParty,
    // No due date on file → treat as due now (so it surfaces as pending, not
    // silently late). The skill computes daysPastDue from this.
    dueAt: item.dueDate ? new Date(item.dueDate) : new Date(),
    required: item.required,
  };
}

export function toReceivedDoc(doc: {
  id: string;
  satisfiesChecklistItemId: string | null;
  receivedAt: string;
  filename: string;
}): ReceivedDoc {
  return {
    id: doc.id,
    satisfiesChecklistItemId: doc.satisfiesChecklistItemId,
    receivedAt: new Date(doc.receivedAt),
    filename: doc.filename,
  };
}
