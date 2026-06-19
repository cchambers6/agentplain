/**
 * lib/integrations/salesforce-mcp/with-approval.ts
 *
 * The Salesforce approval gate — the connector-specific decorator that forces
 * EVERY mutating Salesforce method through the shared connector approval gate
 * (`lib/integrations/approval`) before the REST API is touched. Mirrors
 * `hubspot-mcp/with-approval.ts`, built on the generic gate so the connectors
 * share one fingerprint/persistence/audit core.
 *
 * Read methods (list/get) pass straight through. Mutations — the pre-existing
 * `createTask` AND the four write-action-depth additions (createOpportunity /
 * updateRecord / sendEmailTemplate / logCall) — are intercepted: a
 * missing/invalid/expired grant returns APPROVAL_REQUIRED and the Salesforce
 * call never happens; a valid grant lets the call run and is audit-logged.
 *
 * Installed at the factory seam (`buildSalesforceMcpServer`), so an ungated
 * Salesforce server cannot be obtained.
 */

import type { McpResult } from '@/lib/integrations/mcp-core';
import {
  gateAndRun,
  type ConnectorApprovalDeps,
  type GatedAction,
} from '@/lib/integrations/approval';
import type {
  CreateTaskInput,
  CreateTaskOutput,
  GetAccountInput,
  GetAccountOutput,
  GetLeadInput,
  GetLeadOutput,
  GetOpportunityInput,
  GetOpportunityOutput,
  ListAccountsInput,
  ListAccountsOutput,
  ListContactsInput,
  ListContactsOutput,
  ListLeadsInput,
  ListLeadsOutput,
  ListOpportunitiesInput,
  ListOpportunitiesOutput,
  SalesforceMcpServer,
  CreateOpportunityInput,
  CreateOpportunityOutput,
  UpdateRecordInput,
  UpdateRecordOutput,
  SendEmailTemplateInput,
  SendEmailTemplateOutput,
  LogCallInput,
  LogCallOutput,
} from './types';
import {
  CREATE_OPPORTUNITY,
  CREATE_TASK,
  LOG_CALL,
  SALESFORCE_CONNECTOR,
  SEND_EMAIL_TEMPLATE,
  UPDATE_RECORD,
  salesforceAction,
  type WriteActionDescriptor,
} from './actions';

/** Wrap a Salesforce server so all mutating methods require an approved grant. */
export function withSalesforceApproval(
  inner: SalesforceMcpServer,
  deps: ConnectorApprovalDeps,
): SalesforceMcpServer {
  return new GatedSalesforceMcpServer(inner, deps);
}

class GatedSalesforceMcpServer implements SalesforceMcpServer {
  readonly name: string;
  readonly workspaceId: string;

  constructor(
    private readonly inner: SalesforceMcpServer,
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
  listOpportunities(input: ListOpportunitiesInput): Promise<McpResult<ListOpportunitiesOutput>> {
    return this.inner.listOpportunities(input);
  }
  getOpportunity(input: GetOpportunityInput): Promise<McpResult<GetOpportunityOutput>> {
    return this.inner.getOpportunity(input);
  }
  listAccounts(input: ListAccountsInput): Promise<McpResult<ListAccountsOutput>> {
    return this.inner.listAccounts(input);
  }
  getAccount(input: GetAccountInput): Promise<McpResult<GetAccountOutput>> {
    return this.inner.getAccount(input);
  }
  listContacts(input: ListContactsInput): Promise<McpResult<ListContactsOutput>> {
    return this.inner.listContacts(input);
  }

  // ── Pre-existing mutation: now gated ───────────────────────────────────

  createTask(input: CreateTaskInput): Promise<McpResult<CreateTaskOutput>> {
    return this.gate(salesforceAction(CREATE_TASK, input), () => this.inner.createTask(input));
  }

  // ── Write-action-depth mutations ───────────────────────────────────────

  createOpportunity(input: CreateOpportunityInput): Promise<McpResult<CreateOpportunityOutput>> {
    return this.gate(salesforceAction(CREATE_OPPORTUNITY, input), () =>
      this.inner.createOpportunity(input),
    );
  }
  updateRecord(input: UpdateRecordInput): Promise<McpResult<UpdateRecordOutput>> {
    return this.gate(salesforceAction(UPDATE_RECORD, input), () => this.inner.updateRecord(input));
  }
  sendEmailTemplate(input: SendEmailTemplateInput): Promise<McpResult<SendEmailTemplateOutput>> {
    return this.gate(salesforceAction(SEND_EMAIL_TEMPLATE, input), () =>
      this.inner.sendEmailTemplate(input),
    );
  }
  logCall(input: LogCallInput): Promise<McpResult<LogCallOutput>> {
    return this.gate(salesforceAction(LOG_CALL, input), () => this.inner.logCall(input));
  }
}

// Re-export for symmetry with other connectors' approval modules.
export type { WriteActionDescriptor };
