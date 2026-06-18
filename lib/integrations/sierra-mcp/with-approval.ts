/**
 * lib/integrations/sierra-mcp/with-approval.ts
 *
 * The Sierra approval gate — the connector-specific decorator that forces
 * EVERY mutating Sierra method through the shared connector approval gate
 * (`lib/integrations/approval`) before the REST API is touched. Mirrors
 * `hubspot-mcp/with-approval.ts`, built on the generic gate so the connectors
 * share one fingerprint/persistence/audit core.
 *
 * Read methods (listLeads/getLead/listPipelines/getPipelineStage) pass straight
 * through. Mutations — the two pre-existing internal-annotation writes
 * (createNote / addTag) AND the three write-action-depth additions
 * (createContact / sendDrip / updateStatus) — are intercepted: a missing/
 * invalid/expired grant returns APPROVAL_REQUIRED and the Sierra call never
 * happens; a valid grant lets the call run and is audit-logged.
 *
 * Installed at the factory seam (`buildSierraMcpServer`), so an ungated Sierra
 * server cannot be obtained.
 */

import type { McpResult } from '@/lib/integrations/mcp-core';
import {
  gateAndRun,
  type ConnectorApprovalDeps,
  type GatedAction,
} from '@/lib/integrations/approval';
import type {
  AddTagInput,
  AddTagOutput,
  CreateNoteInput,
  CreateNoteOutput,
  GetLeadInput,
  GetLeadOutput,
  GetPipelineStageInput,
  GetPipelineStageOutput,
  ListLeadsInput,
  ListLeadsOutput,
  ListPipelinesInput,
  ListPipelinesOutput,
  SierraMcpServer,
} from './types';
import {
  CREATE_CONTACT,
  SEND_DRIP,
  SIERRA_CONNECTOR,
  UPDATE_STATUS,
  sierraAction,
  type CreateContactInput,
  type CreateContactOutput,
  type SendDripInput,
  type SendDripOutput,
  type UpdateStatusInput,
  type UpdateStatusOutput,
  type WriteActionDescriptor,
} from './actions';

/** Wrap a Sierra server so all mutating methods require an approved grant. */
export function withSierraApproval(
  inner: SierraMcpServer,
  deps: ConnectorApprovalDeps,
): SierraMcpServer {
  return new GatedSierraMcpServer(inner, deps);
}

class GatedSierraMcpServer implements SierraMcpServer {
  readonly name: string;
  readonly workspaceId: string;

  constructor(
    private readonly inner: SierraMcpServer,
    private readonly deps: ConnectorApprovalDeps,
  ) {
    this.name = inner.name;
    this.workspaceId = inner.workspaceId;
  }

  private gate<T>(action: GatedAction, execute: () => Promise<McpResult<T>>) {
    return gateAndRun({
      gate: this.deps.gate,
      audit: this.deps.audit,
      workspaceId: this.workspaceId,
      action,
      execute,
    });
  }

  // ── Reads: straight pass-through ───────────────────────────────────────

  listLeads(input: ListLeadsInput): Promise<McpResult<ListLeadsOutput>> {
    return this.inner.listLeads(input);
  }
  getLead(input: GetLeadInput): Promise<McpResult<GetLeadOutput>> {
    return this.inner.getLead(input);
  }
  listPipelines(
    input: ListPipelinesInput,
  ): Promise<McpResult<ListPipelinesOutput>> {
    return this.inner.listPipelines(input);
  }
  getPipelineStage(
    input: GetPipelineStageInput,
  ): Promise<McpResult<GetPipelineStageOutput>> {
    return this.inner.getPipelineStage(input);
  }

  // ── Pre-existing internal-annotation writes: now gated ─────────────────

  createNote(input: CreateNoteInput): Promise<McpResult<CreateNoteOutput>> {
    const action: GatedAction = {
      connector: SIERRA_CONNECTOR,
      action: 'create_note',
      pendingApprovalId: input.pendingApprovalId,
      discipline: 'sales',
      detail: {
        leadId: input.leadId,
        body: input.body,
        isPrivate: input.isPrivate ?? true,
      },
    };
    return this.gate(action, () => this.inner.createNote(input));
  }

  addTag(input: AddTagInput): Promise<McpResult<AddTagOutput>> {
    const action: GatedAction = {
      connector: SIERRA_CONNECTOR,
      action: 'add_tag',
      pendingApprovalId: input.pendingApprovalId,
      discipline: 'sales',
      detail: { leadId: input.leadId, tags: input.tags },
    };
    return this.gate(action, () => this.inner.addTag(input));
  }

  // ── Write-action-depth mutations ───────────────────────────────────────

  createContact(
    input: CreateContactInput,
  ): Promise<McpResult<CreateContactOutput>> {
    return this.gate(sierraAction(CREATE_CONTACT, input), () =>
      this.inner.createContact(input),
    );
  }
  sendDrip(input: SendDripInput): Promise<McpResult<SendDripOutput>> {
    return this.gate(sierraAction(SEND_DRIP, input), () =>
      this.inner.sendDrip(input),
    );
  }
  updateStatus(
    input: UpdateStatusInput,
  ): Promise<McpResult<UpdateStatusOutput>> {
    return this.gate(sierraAction(UPDATE_STATUS, input), () =>
      this.inner.updateStatus(input),
    );
  }
}

// Re-export for symmetry with other connectors' approval modules.
export type { WriteActionDescriptor };
