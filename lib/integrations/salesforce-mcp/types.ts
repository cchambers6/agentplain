/**
 * lib/integrations/salesforce-mcp/types.ts
 *
 * Wave-7 Salesforce MCP. Universal CRM at the enterprise + mid-market
 * tier. Uses OAuth 2.0 with refresh tokens + instance URL discovery (the
 * per-org REST host is returned on the token response and must be
 * threaded into every API call).
 *
 * Per `feedback_no_silent_vendor_lock.md`: this file is the ONLY place
 * that names Salesforce's REST shape. Skills + cron sweeps speak the
 * typed MCP interface below.
 *
 * Per `project_no_outbound_architecture.md`: every mutating method is
 * approval-gated at the factory seam (`with-approval.ts`). Internal
 * annotations (create_task / log_call / create_opportunity / update_record)
 * and the one genuinely OUTBOUND action (send_email_template) all require a
 * recorded human approval before the REST call is reached.
 *
 * Per `feedback_runner_portability.md`: two impls — `ProdSalesforceMcpServer`
 * (production REST) and `RecordingSalesforceMcpServer` (test).
 *
 * HONEST CONCESSION (registry side): a customer running their own dev-
 * tier Connected App can use this MCP today. Production AppExchange
 * distribution requires Connected App security review.
 */

import type { McpResult } from '@/lib/integrations/mcp-core';
import type {
  CreateOpportunityInput,
  CreateOpportunityOutput,
  UpdateRecordInput,
  UpdateRecordOutput,
  SendEmailTemplateInput,
  SendEmailTemplateOutput,
  LogCallInput,
  LogCallOutput,
} from './actions';

export type {
  CreateOpportunityInput,
  CreateOpportunityOutput,
  UpdateRecordInput,
  UpdateRecordOutput,
  SendEmailTemplateInput,
  SendEmailTemplateOutput,
  LogCallInput,
  LogCallOutput,
};

// ── DTOs the MCP returns ──────────────────────────────────────────────

export interface SalesforceLeadSummary {
  /** Salesforce Lead id (18-char ID, but we surface as string). */
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  /** Lead status (e.g. "Open - Not Contacted", "Working - Contacted"). */
  status: string | null;
  /** Lead source (e.g. "Web", "Phone Inquiry", "Partner Referral"). */
  leadSource: string | null;
  /** Lead rating (e.g. "Hot", "Warm", "Cold"). */
  rating: string | null;
  createdAt: string | null;
  modifiedAt: string | null;
}

export interface SalesforceOpportunitySummary {
  id: string;
  name: string | null;
  amount: number | null;
  stage: string | null;
  /** Salesforce uses ISO date for close date. */
  closeDate: string | null;
  /** Account id (Salesforce Account = company). */
  accountId: string | null;
  probability: number | null;
  createdAt: string | null;
  modifiedAt: string | null;
}

export interface SalesforceAccountSummary {
  id: string;
  name: string | null;
  /** Industry picklist value. */
  industry: string | null;
  website: string | null;
  phone: string | null;
  createdAt: string | null;
  modifiedAt: string | null;
}

export interface SalesforceContactSummary {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  /** Account id this contact rolls up to. */
  accountId: string | null;
  title: string | null;
  createdAt: string | null;
  modifiedAt: string | null;
}

// ── Tool I/O shapes ───────────────────────────────────────────────────

export interface ListLeadsInput {
  limit?: number;
  /** When set, only leads modified after this ISO timestamp. */
  modifiedSince?: string;
}
export interface ListLeadsOutput {
  leads: SalesforceLeadSummary[];
}

export interface GetLeadInput {
  leadId: string;
}
export interface GetLeadOutput {
  lead: SalesforceLeadSummary;
}

export interface ListOpportunitiesInput {
  limit?: number;
  /** Optional account filter. */
  accountId?: string;
}
export interface ListOpportunitiesOutput {
  opportunities: SalesforceOpportunitySummary[];
}

export interface GetOpportunityInput {
  opportunityId: string;
}
export interface GetOpportunityOutput {
  opportunity: SalesforceOpportunitySummary;
}

export interface ListAccountsInput {
  limit?: number;
}
export interface ListAccountsOutput {
  accounts: SalesforceAccountSummary[];
}

export interface GetAccountInput {
  accountId: string;
}
export interface GetAccountOutput {
  account: SalesforceAccountSummary;
}

export interface ListContactsInput {
  limit?: number;
  accountId?: string;
}
export interface ListContactsOutput {
  contacts: SalesforceContactSummary[];
}

export interface CreateTaskInput {
  /** Salesforce id of the target (Lead, Contact, Opportunity, Account). */
  whatId?: string;
  /** Salesforce id of the lead/contact the task relates to. */
  whoId?: string;
  subject: string;
  description?: string;
  /** Status picklist — defaults to "Not Started". */
  status?: string;
  /** Priority picklist — defaults to "Normal". */
  priority?: string;
  /** Approval token once the operator has approved this exact task. */
  pendingApprovalId?: string;
}
export interface CreateTaskOutput {
  taskId: string;
}

// ── Server interface ──────────────────────────────────────────────────

export interface SalesforceMcpServer {
  readonly name: string;
  readonly workspaceId: string;

  listLeads(input: ListLeadsInput): Promise<McpResult<ListLeadsOutput>>;
  getLead(input: GetLeadInput): Promise<McpResult<GetLeadOutput>>;
  listOpportunities(input: ListOpportunitiesInput): Promise<McpResult<ListOpportunitiesOutput>>;
  getOpportunity(input: GetOpportunityInput): Promise<McpResult<GetOpportunityOutput>>;
  listAccounts(input: ListAccountsInput): Promise<McpResult<ListAccountsOutput>>;
  getAccount(input: GetAccountInput): Promise<McpResult<GetAccountOutput>>;
  listContacts(input: ListContactsInput): Promise<McpResult<ListContactsOutput>>;
  createTask(input: CreateTaskInput): Promise<McpResult<CreateTaskOutput>>;

  // ── Write-action-depth mutations (all approval-gated) ──────────────────
  createOpportunity(input: CreateOpportunityInput): Promise<McpResult<CreateOpportunityOutput>>;
  updateRecord(input: UpdateRecordInput): Promise<McpResult<UpdateRecordOutput>>;
  sendEmailTemplate(input: SendEmailTemplateInput): Promise<McpResult<SendEmailTemplateOutput>>;
  logCall(input: LogCallInput): Promise<McpResult<LogCallOutput>>;
}
