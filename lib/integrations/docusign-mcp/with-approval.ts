/**
 * lib/integrations/docusign-mcp/with-approval.ts
 *
 * The approval gate for DocuSign's two mutating actions — `send_envelope`
 * and `void_envelope`. `withDocuSignApproval` wraps any `DocuSignMcpServer`
 * in a decorator that forces every send/void through a single approval check
 * BEFORE the underlying server (and therefore the DocuSign REST API) is ever
 * touched.
 *
 * Why this exists (per `project_no_outbound_architecture.md`): agents draft;
 * the customer's own system executes. A DocuSign send mails a legal document
 * for signature; a void cancels an in-flight one. Neither may fire from an
 * autonomous agent run without an explicit, recorded human approval. Before
 * this gate, a bad agent run could send envelopes or void real contracts with
 * no review — a fail-safe risk on the highest-stakes surface we touch.
 *
 * The gate is installed at the FACTORY seam (`buildDocuSignMcpServer`), so it
 * is impossible to obtain an ungated DocuSign server: read methods
 * (list/status/recipients/download) pass straight through; send/void are
 * intercepted. A missing, mismatched, un-approved, or expired grant returns a
 * structured `APPROVAL_REQUIRED` result and the DocuSign call never happens.
 *
 * Persistence of grants lives behind the `DocuSignApprovalGate` port (two
 * implementations per `feedback_runner_portability.md`): the Prisma gate reads
 * the real `WorkApprovalQueueItem` queue the operator approves on /approvals;
 * the in-memory gate backs the smoke test. This file imports neither — it only
 * knows the port.
 */

import { createHash } from 'node:crypto';
import { mcpError, type McpResult } from '@/lib/integrations/mcp-core';
import {
  type DocuSignMcpServer,
  type DownloadCompletedDocumentInput,
  type DownloadCompletedDocumentOutput,
  type GetEnvelopeStatusInput,
  type GetEnvelopeStatusOutput,
  type GetRecipientStatusInput,
  type GetRecipientStatusOutput,
  type ListEnvelopesInput,
  type ListEnvelopesOutput,
  type SendEnvelopeInput,
  type SendEnvelopeOutput,
  type VoidEnvelopeInput,
  type VoidEnvelopeOutput,
} from './types';

// ── The action under approval ──────────────────────────────────────────────

/** Human-readable detail of a send, for the approval card the operator sees. */
export interface SendActionDetail {
  emailSubject: string;
  /** Recipient emails (signers or template roles), for the approval card. */
  recipientEmails: string[];
  source: 'template' | 'documents';
  templateId?: string;
  documentNames: string[];
}

export interface VoidActionDetail {
  envelopeId: string;
  voidedReason: string;
}

/**
 * A mutating DocuSign action presented to the gate. `pendingApprovalId` is the
 * approval token the caller carries forward once an operator has approved (it
 * is the `WorkApprovalQueueItem.id` for the Prisma gate). Absent on the first
 * attempt — the gate then returns APPROVAL_REQUIRED naming the new request.
 */
export type DocuSignGatedAction =
  | { type: 'send'; pendingApprovalId?: string; detail: SendActionDetail }
  | { type: 'void'; pendingApprovalId?: string; detail: VoidActionDetail };

/** A validated, operator-approved, unexpired grant returned by the gate. */
export interface DocuSignApprovalGrant {
  pendingApprovalId: string;
  /** User who approved, when the store records it. */
  approvedByUserId: string | null;
  /** ISO timestamp of the approval decision. */
  approvedAt: string | null;
  /** ISO timestamp after which the grant is no longer honored. */
  expiresAt: string | null;
}

/**
 * The persistence port. `check` returns `ok(grant)` ONLY when an approved,
 * unexpired grant whose fingerprint matches THIS exact action exists. Any
 * other state (no token, wrong workspace, action changed since approval,
 * still pending, rejected, expired) returns an `APPROVAL_REQUIRED` error whose
 * `reference` is the pendingApprovalId the operator must act on (when the
 * store can name one).
 */
export interface DocuSignApprovalGate {
  check(args: {
    workspaceId: string;
    action: DocuSignGatedAction;
  }): Promise<McpResult<DocuSignApprovalGrant>>;
}

// ── Fingerprinting ───────────────────────────────────────────────────────────

/**
 * A stable hash binding a grant to the exact action approved. Recomputed at
 * execution time and compared to the stored fingerprint so an approval for
 * "send the listing agreement to dana@x.com" can never be replayed to send a
 * different document or to a different recipient.
 */
export function fingerprintAction(action: DocuSignGatedAction): string {
  const canonical =
    action.type === 'send'
      ? {
          type: 'send',
          emailSubject: action.detail.emailSubject,
          recipientEmails: [...action.detail.recipientEmails].sort(),
          source: action.detail.source,
          templateId: action.detail.templateId ?? null,
          documentNames: [...action.detail.documentNames].sort(),
        }
      : {
          type: 'void',
          envelopeId: action.detail.envelopeId,
          voidedReason: action.detail.voidedReason,
        };
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

export function summarizeSend(input: SendEnvelopeInput): SendActionDetail {
  const usingTemplate = !!input.templateId;
  const recipientEmails = usingTemplate
    ? (input.templateRoles ?? []).map((r) => r.email)
    : (input.signers ?? []).map((s) => s.email);
  return {
    emailSubject: input.emailSubject,
    recipientEmails,
    source: usingTemplate ? 'template' : 'documents',
    templateId: input.templateId,
    documentNames: (input.documents ?? []).map((d) => d.name),
  };
}

export function summarizeVoid(input: VoidEnvelopeInput): VoidActionDetail {
  return { envelopeId: input.envelopeId, voidedReason: input.voidedReason };
}

// ── The decorator ────────────────────────────────────────────────────────────

/** Wrap a DocuSign server so send/void require an approved grant. */
export function withDocuSignApproval(
  inner: DocuSignMcpServer,
  gate: DocuSignApprovalGate,
): DocuSignMcpServer {
  return new GatedDocuSignMcpServer(inner, gate);
}

class GatedDocuSignMcpServer implements DocuSignMcpServer {
  readonly name: string;
  readonly workspaceId: string;
  listResources?: DocuSignMcpServer['listResources'];
  readResource?: DocuSignMcpServer['readResource'];

  constructor(
    private readonly inner: DocuSignMcpServer,
    private readonly gate: DocuSignApprovalGate,
  ) {
    this.name = inner.name;
    this.workspaceId = inner.workspaceId;
    // Optional resource surface passes straight through when the inner server
    // exposes it (bound here, not as field initializers, which would run
    // before `inner` is assigned).
    if (inner.listResources) this.listResources = inner.listResources.bind(inner);
    if (inner.readResource) this.readResource = inner.readResource.bind(inner);
  }

  // ── Read methods: straight pass-through, no approval needed ──────────────

  listEnvelopes(input: ListEnvelopesInput): Promise<McpResult<ListEnvelopesOutput>> {
    return this.inner.listEnvelopes(input);
  }

  getEnvelopeStatus(input: GetEnvelopeStatusInput): Promise<McpResult<GetEnvelopeStatusOutput>> {
    return this.inner.getEnvelopeStatus(input);
  }

  getRecipientStatus(input: GetRecipientStatusInput): Promise<McpResult<GetRecipientStatusOutput>> {
    return this.inner.getRecipientStatus(input);
  }

  downloadCompletedDocument(
    input: DownloadCompletedDocumentInput,
  ): Promise<McpResult<DownloadCompletedDocumentOutput>> {
    return this.inner.downloadCompletedDocument(input);
  }

  // ── Mutating methods: gated ──────────────────────────────────────────────

  async sendEnvelope(input: SendEnvelopeInput): Promise<McpResult<SendEnvelopeOutput>> {
    const action: DocuSignGatedAction = {
      type: 'send',
      pendingApprovalId: input.pendingApprovalId,
      detail: summarizeSend(input),
    };
    const gateResult = await this.gate.check({ workspaceId: this.workspaceId, action });
    if (!gateResult.ok) return gateResult; // APPROVAL_REQUIRED — DocuSign never called.
    return this.inner.sendEnvelope(input);
  }

  async voidEnvelope(input: VoidEnvelopeInput): Promise<McpResult<VoidEnvelopeOutput>> {
    const action: DocuSignGatedAction = {
      type: 'void',
      pendingApprovalId: input.pendingApprovalId,
      detail: summarizeVoid(input),
    };
    const gateResult = await this.gate.check({ workspaceId: this.workspaceId, action });
    if (!gateResult.ok) return gateResult; // APPROVAL_REQUIRED — DocuSign never called.
    return this.inner.voidEnvelope(input);
  }
}

// ── Shared error constructor ─────────────────────────────────────────────────

/**
 * Build the structured `APPROVAL_REQUIRED` result both gates return. `reference`
 * carries the pendingApprovalId so the caller (and the /approvals surface) know
 * exactly which request needs a human decision.
 */
export function approvalRequired(
  message: string,
  pendingApprovalId?: string,
): McpResult<never> {
  return mcpError('APPROVAL_REQUIRED', message, { reference: pendingApprovalId });
}
