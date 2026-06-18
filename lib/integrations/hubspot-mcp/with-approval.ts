/**
 * lib/integrations/hubspot-mcp/with-approval.ts
 *
 * The HubSpot approval gate — the connector-specific decorator that forces
 * EVERY mutating HubSpot method through the shared connector approval gate
 * (`lib/integrations/approval`) before the REST API is touched. Mirrors
 * `docusign-mcp/with-approval.ts`, but built on the generic gate so the nine
 * connectors share one fingerprint/persistence/audit core.
 *
 * Read methods (list/get) pass straight through. Mutations — the three
 * pre-existing internal-annotation writes (updateContact / updateDeal /
 * createNote) AND the six write-action-depth additions — are intercepted: a
 * missing/invalid/expired grant returns APPROVAL_REQUIRED and the HubSpot call
 * never happens; a valid grant lets the call run and is audit-logged.
 *
 * Installed at the factory seam (`buildHubspotMcpServer`), so an ungated
 * HubSpot server cannot be obtained.
 */

import type { McpResult } from '@/lib/integrations/mcp-core';
import {
  gateAndRun,
  type ConnectorApprovalDeps,
} from '@/lib/integrations/approval';
import type {
  GetCompanyInput,
  GetCompanyOutput,
  GetContactInput,
  GetContactOutput,
  GetDealInput,
  GetDealOutput,
  HubspotMcpServer,
  ListCompaniesInput,
  ListCompaniesOutput,
  ListContactsInput,
  ListContactsOutput,
  ListDealsInput,
  ListDealsOutput,
  CreateNoteInput,
  CreateNoteOutput,
  UpdateContactInput,
  UpdateContactOutput,
  UpdateDealInput,
  UpdateDealOutput,
} from './types';
import {
  CREATE_DEAL,
  CREATE_TASK,
  HUBSPOT_CONNECTOR,
  LOG_ACTIVITY,
  SEND_EMAIL_TEMPLATE,
  SEND_SEQUENCE_ENROLLMENT,
  UPDATE_DEAL_STAGE,
  hubspotAction,
  type CreateDealInput,
  type CreateDealOutput,
  type CreateTaskInput,
  type CreateTaskOutput,
  type LogActivityInput,
  type LogActivityOutput,
  type SendEmailTemplateInput,
  type SendEmailTemplateOutput,
  type SendSequenceEnrollmentInput,
  type SendSequenceEnrollmentOutput,
  type UpdateDealStageInput,
  type UpdateDealStageOutput,
  type WriteActionDescriptor,
} from './actions';
import type { GatedAction } from '@/lib/integrations/approval';

/** Wrap a HubSpot server so all mutating methods require an approved grant. */
export function withHubspotApproval(
  inner: HubspotMcpServer,
  deps: ConnectorApprovalDeps,
): HubspotMcpServer {
  return new GatedHubspotMcpServer(inner, deps);
}

class GatedHubspotMcpServer implements HubspotMcpServer {
  readonly name: string;
  readonly workspaceId: string;

  constructor(
    private readonly inner: HubspotMcpServer,
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

  listContacts(input: ListContactsInput): Promise<McpResult<ListContactsOutput>> {
    return this.inner.listContacts(input);
  }
  getContact(input: GetContactInput): Promise<McpResult<GetContactOutput>> {
    return this.inner.getContact(input);
  }
  listDeals(input: ListDealsInput): Promise<McpResult<ListDealsOutput>> {
    return this.inner.listDeals(input);
  }
  getDeal(input: GetDealInput): Promise<McpResult<GetDealOutput>> {
    return this.inner.getDeal(input);
  }
  listCompanies(input: ListCompaniesInput): Promise<McpResult<ListCompaniesOutput>> {
    return this.inner.listCompanies(input);
  }
  getCompany(input: GetCompanyInput): Promise<McpResult<GetCompanyOutput>> {
    return this.inner.getCompany(input);
  }

  // ── Pre-existing internal-annotation writes: now gated ─────────────────

  updateContact(input: UpdateContactInput): Promise<McpResult<UpdateContactOutput>> {
    const action: GatedAction = {
      connector: HUBSPOT_CONNECTOR,
      action: 'update_contact',
      pendingApprovalId: input.pendingApprovalId,
      discipline: 'sales',
      detail: { contactId: input.contactId, properties: input.properties },
    };
    return this.gate(action, () => this.inner.updateContact(input));
  }

  updateDeal(input: UpdateDealInput): Promise<McpResult<UpdateDealOutput>> {
    const action: GatedAction = {
      connector: HUBSPOT_CONNECTOR,
      action: 'update_deal',
      pendingApprovalId: input.pendingApprovalId,
      discipline: 'sales',
      detail: { dealId: input.dealId, properties: input.properties },
    };
    return this.gate(action, () => this.inner.updateDeal(input));
  }

  createNote(input: CreateNoteInput): Promise<McpResult<CreateNoteOutput>> {
    const action: GatedAction = {
      connector: HUBSPOT_CONNECTOR,
      action: 'create_note',
      pendingApprovalId: input.pendingApprovalId,
      discipline: 'sales',
      detail: { objectType: input.objectType, objectId: input.objectId, body: input.body },
    };
    return this.gate(action, () => this.inner.createNote(input));
  }

  // ── Write-action-depth mutations ───────────────────────────────────────

  createDeal(input: CreateDealInput): Promise<McpResult<CreateDealOutput>> {
    return this.gate(hubspotAction(CREATE_DEAL, input), () => this.inner.createDeal(input));
  }
  updateDealStage(input: UpdateDealStageInput): Promise<McpResult<UpdateDealStageOutput>> {
    return this.gate(hubspotAction(UPDATE_DEAL_STAGE, input), () =>
      this.inner.updateDealStage(input),
    );
  }
  logActivity(input: LogActivityInput): Promise<McpResult<LogActivityOutput>> {
    return this.gate(hubspotAction(LOG_ACTIVITY, input), () => this.inner.logActivity(input));
  }
  createTask(input: CreateTaskInput): Promise<McpResult<CreateTaskOutput>> {
    return this.gate(hubspotAction(CREATE_TASK, input), () => this.inner.createTask(input));
  }
  sendEmailTemplate(
    input: SendEmailTemplateInput,
  ): Promise<McpResult<SendEmailTemplateOutput>> {
    return this.gate(hubspotAction(SEND_EMAIL_TEMPLATE, input), () =>
      this.inner.sendEmailTemplate(input),
    );
  }
  sendSequenceEnrollment(
    input: SendSequenceEnrollmentInput,
  ): Promise<McpResult<SendSequenceEnrollmentOutput>> {
    return this.gate(hubspotAction(SEND_SEQUENCE_ENROLLMENT, input), () =>
      this.inner.sendSequenceEnrollment(input),
    );
  }
}

// Re-export for symmetry with other connectors' approval modules.
export type { WriteActionDescriptor };
