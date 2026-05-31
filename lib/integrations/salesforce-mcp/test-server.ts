/**
 * lib/integrations/salesforce-mcp/test-server.ts
 *
 * In-memory Salesforce MCP for tests. Tests seed leads/opportunities/
 * accounts/contacts; assertions read back captured write-side calls.
 */

import { mcpError, mcpOk, type McpResult } from '@/lib/integrations/mcp-core';
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
  SalesforceAccountSummary,
  SalesforceContactSummary,
  SalesforceLeadSummary,
  SalesforceMcpServer,
  SalesforceOpportunitySummary,
} from './types';

export interface TestSalesforceSeed {
  leads?: SalesforceLeadSummary[];
  opportunities?: SalesforceOpportunitySummary[];
  accounts?: SalesforceAccountSummary[];
  contacts?: SalesforceContactSummary[];
}

export interface RecordedSalesforceCall {
  tool:
    | 'listLeads'
    | 'getLead'
    | 'listOpportunities'
    | 'getOpportunity'
    | 'listAccounts'
    | 'getAccount'
    | 'listContacts'
    | 'createTask';
  input: unknown;
}

export class RecordingSalesforceMcpServer implements SalesforceMcpServer {
  readonly name = 'recording' as const;
  readonly workspaceId: string;
  readonly calls: RecordedSalesforceCall[] = [];
  private readonly leads: Map<string, SalesforceLeadSummary>;
  private readonly opps: Map<string, SalesforceOpportunitySummary>;
  private readonly accounts: Map<string, SalesforceAccountSummary>;
  private readonly contacts: Map<string, SalesforceContactSummary>;
  private nextTaskId = 8000;

  constructor(args: { workspaceId: string; seed?: TestSalesforceSeed }) {
    this.workspaceId = args.workspaceId;
    this.leads = new Map((args.seed?.leads ?? []).map((l) => [l.id, { ...l }]));
    this.opps = new Map((args.seed?.opportunities ?? []).map((o) => [o.id, { ...o }]));
    this.accounts = new Map((args.seed?.accounts ?? []).map((a) => [a.id, { ...a }]));
    this.contacts = new Map((args.seed?.contacts ?? []).map((c) => [c.id, { ...c }]));
  }

  async listLeads(input: ListLeadsInput): Promise<McpResult<ListLeadsOutput>> {
    this.calls.push({ tool: 'listLeads', input });
    const limit = input.limit ?? 25;
    return mcpOk({ leads: [...this.leads.values()].slice(0, limit) });
  }

  async getLead(input: GetLeadInput): Promise<McpResult<GetLeadOutput>> {
    this.calls.push({ tool: 'getLead', input });
    const l = this.leads.get(input.leadId);
    if (!l) return mcpError('NOT_FOUND', `No lead ${input.leadId}`);
    return mcpOk({ lead: l });
  }

  async listOpportunities(input: ListOpportunitiesInput): Promise<McpResult<ListOpportunitiesOutput>> {
    this.calls.push({ tool: 'listOpportunities', input });
    const limit = input.limit ?? 25;
    const filtered = input.accountId
      ? [...this.opps.values()].filter((o) => o.accountId === input.accountId)
      : [...this.opps.values()];
    return mcpOk({ opportunities: filtered.slice(0, limit) });
  }

  async getOpportunity(input: GetOpportunityInput): Promise<McpResult<GetOpportunityOutput>> {
    this.calls.push({ tool: 'getOpportunity', input });
    const o = this.opps.get(input.opportunityId);
    if (!o) return mcpError('NOT_FOUND', `No opportunity ${input.opportunityId}`);
    return mcpOk({ opportunity: o });
  }

  async listAccounts(input: ListAccountsInput): Promise<McpResult<ListAccountsOutput>> {
    this.calls.push({ tool: 'listAccounts', input });
    const limit = input.limit ?? 25;
    return mcpOk({ accounts: [...this.accounts.values()].slice(0, limit) });
  }

  async getAccount(input: GetAccountInput): Promise<McpResult<GetAccountOutput>> {
    this.calls.push({ tool: 'getAccount', input });
    const a = this.accounts.get(input.accountId);
    if (!a) return mcpError('NOT_FOUND', `No account ${input.accountId}`);
    return mcpOk({ account: a });
  }

  async listContacts(input: ListContactsInput): Promise<McpResult<ListContactsOutput>> {
    this.calls.push({ tool: 'listContacts', input });
    const limit = input.limit ?? 25;
    const filtered = input.accountId
      ? [...this.contacts.values()].filter((c) => c.accountId === input.accountId)
      : [...this.contacts.values()];
    return mcpOk({ contacts: filtered.slice(0, limit) });
  }

  async createTask(input: CreateTaskInput): Promise<McpResult<CreateTaskOutput>> {
    this.calls.push({ tool: 'createTask', input });
    if (!input.subject || input.subject.trim().length === 0) {
      return mcpError('INVALID_ARGUMENT', 'createTask requires a non-empty subject');
    }
    // Validate target ids exist if supplied.
    if (input.whoId) {
      const inLeads = this.leads.has(input.whoId);
      const inContacts = this.contacts.has(input.whoId);
      if (!inLeads && !inContacts) {
        return mcpError('NOT_FOUND', `No Lead or Contact with id ${input.whoId}`);
      }
    }
    if (input.whatId) {
      const inOpps = this.opps.has(input.whatId);
      const inAccts = this.accounts.has(input.whatId);
      if (!inOpps && !inAccts) {
        return mcpError('NOT_FOUND', `No Opportunity or Account with id ${input.whatId}`);
      }
    }
    return mcpOk({ taskId: `task-${this.nextTaskId++}` });
  }
}
