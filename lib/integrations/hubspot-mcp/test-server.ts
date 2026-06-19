/**
 * lib/integrations/hubspot-mcp/test-server.ts
 *
 * In-memory HubSpot MCP for tests. Tests seed contacts/deals/companies;
 * assertions read back captured write-side calls.
 */

import { mcpError, mcpOk, type McpResult } from '@/lib/integrations/mcp-core';
import type {
  CreateNoteInput,
  CreateNoteOutput,
  GetCompanyInput,
  GetCompanyOutput,
  GetContactInput,
  GetContactOutput,
  GetDealInput,
  GetDealOutput,
  HubspotCompanySummary,
  HubspotContactSummary,
  HubspotDealSummary,
  HubspotMcpServer,
  ListCompaniesInput,
  ListCompaniesOutput,
  ListContactsInput,
  ListContactsOutput,
  ListDealsInput,
  ListDealsOutput,
  UpdateContactInput,
  UpdateContactOutput,
  UpdateDealInput,
  UpdateDealOutput,
} from './types';
import type {
  CreateDealInput,
  CreateDealOutput,
  UpdateDealStageInput,
  UpdateDealStageOutput,
  LogActivityInput,
  LogActivityOutput,
  CreateTaskInput,
  CreateTaskOutput,
  SendEmailTemplateInput,
  SendEmailTemplateOutput,
  SendSequenceEnrollmentInput,
  SendSequenceEnrollmentOutput,
} from './actions';

export interface TestHubspotSeed {
  contacts?: HubspotContactSummary[];
  deals?: HubspotDealSummary[];
  companies?: HubspotCompanySummary[];
}

export interface RecordedHubspotCall {
  tool:
    | 'listContacts'
    | 'getContact'
    | 'updateContact'
    | 'listDeals'
    | 'getDeal'
    | 'updateDeal'
    | 'listCompanies'
    | 'getCompany'
    | 'createNote'
    | 'createDeal'
    | 'updateDealStage'
    | 'logActivity'
    | 'createTask'
    | 'sendEmailTemplate'
    | 'sendSequenceEnrollment';
  input: unknown;
}

export class RecordingHubspotMcpServer implements HubspotMcpServer {
  readonly name = 'recording' as const;
  readonly workspaceId: string;
  readonly calls: RecordedHubspotCall[] = [];
  private readonly contacts: Map<string, HubspotContactSummary>;
  private readonly deals: Map<string, HubspotDealSummary>;
  private readonly companies: Map<string, HubspotCompanySummary>;
  private nextNoteId = 9000;

  constructor(args: { workspaceId: string; seed?: TestHubspotSeed }) {
    this.workspaceId = args.workspaceId;
    this.contacts = new Map((args.seed?.contacts ?? []).map((c) => [c.id, { ...c }]));
    this.deals = new Map((args.seed?.deals ?? []).map((d) => [d.id, { ...d }]));
    this.companies = new Map((args.seed?.companies ?? []).map((c) => [c.id, { ...c }]));
  }

  async listContacts(input: ListContactsInput): Promise<McpResult<ListContactsOutput>> {
    this.calls.push({ tool: 'listContacts', input });
    const limit = input.limit ?? 25;
    return mcpOk({ contacts: [...this.contacts.values()].slice(0, limit) });
  }

  async getContact(input: GetContactInput): Promise<McpResult<GetContactOutput>> {
    this.calls.push({ tool: 'getContact', input });
    const c = this.contacts.get(input.contactId);
    if (!c) return mcpError('NOT_FOUND', `No contact ${input.contactId}`);
    return mcpOk({ contact: c });
  }

  async updateContact(input: UpdateContactInput): Promise<McpResult<UpdateContactOutput>> {
    this.calls.push({ tool: 'updateContact', input });
    const c = this.contacts.get(input.contactId);
    if (!c) return mcpError('NOT_FOUND', `No contact ${input.contactId}`);
    const next: HubspotContactSummary = {
      ...c,
      firstName: input.properties.firstname ?? c.firstName,
      lastName: input.properties.lastname ?? c.lastName,
      email: input.properties.email ?? c.email,
      phone: input.properties.phone ?? c.phone,
      company: input.properties.company ?? c.company,
      lifecycleStage: input.properties.lifecyclestage ?? c.lifecycleStage,
    };
    this.contacts.set(input.contactId, next);
    return mcpOk({ contactId: input.contactId });
  }

  async listDeals(input: ListDealsInput): Promise<McpResult<ListDealsOutput>> {
    this.calls.push({ tool: 'listDeals', input });
    const limit = input.limit ?? 25;
    const filtered = input.pipeline
      ? [...this.deals.values()].filter((d) => d.pipeline === input.pipeline)
      : [...this.deals.values()];
    return mcpOk({ deals: filtered.slice(0, limit) });
  }

  async getDeal(input: GetDealInput): Promise<McpResult<GetDealOutput>> {
    this.calls.push({ tool: 'getDeal', input });
    const d = this.deals.get(input.dealId);
    if (!d) return mcpError('NOT_FOUND', `No deal ${input.dealId}`);
    return mcpOk({ deal: d });
  }

  async updateDeal(input: UpdateDealInput): Promise<McpResult<UpdateDealOutput>> {
    this.calls.push({ tool: 'updateDeal', input });
    const d = this.deals.get(input.dealId);
    if (!d) return mcpError('NOT_FOUND', `No deal ${input.dealId}`);
    const next: HubspotDealSummary = {
      ...d,
      name: input.properties.dealname ?? d.name,
      amount:
        input.properties.amount !== undefined
          ? Number(input.properties.amount)
          : d.amount,
      pipeline: input.properties.pipeline ?? d.pipeline,
      dealStage: input.properties.dealstage ?? d.dealStage,
      closeDate: input.properties.closedate ?? d.closeDate,
    };
    this.deals.set(input.dealId, next);
    return mcpOk({ dealId: input.dealId });
  }

  async listCompanies(input: ListCompaniesInput): Promise<McpResult<ListCompaniesOutput>> {
    this.calls.push({ tool: 'listCompanies', input });
    const limit = input.limit ?? 25;
    return mcpOk({ companies: [...this.companies.values()].slice(0, limit) });
  }

  async getCompany(input: GetCompanyInput): Promise<McpResult<GetCompanyOutput>> {
    this.calls.push({ tool: 'getCompany', input });
    const c = this.companies.get(input.companyId);
    if (!c) return mcpError('NOT_FOUND', `No company ${input.companyId}`);
    return mcpOk({ company: c });
  }

  async createNote(input: CreateNoteInput): Promise<McpResult<CreateNoteOutput>> {
    this.calls.push({ tool: 'createNote', input });
    const exists =
      (input.objectType === 'contacts' && this.contacts.has(input.objectId)) ||
      (input.objectType === 'deals' && this.deals.has(input.objectId)) ||
      (input.objectType === 'companies' && this.companies.has(input.objectId));
    if (!exists) {
      return mcpError('NOT_FOUND', `No ${input.objectType} ${input.objectId}`);
    }
    return mcpOk({ noteId: `note-${this.nextNoteId++}` });
  }

  // ── Write-action-depth mutations (recorded; canned success) ───────────

  async createDeal(input: CreateDealInput): Promise<McpResult<CreateDealOutput>> {
    this.calls.push({ tool: 'createDeal', input });
    if (!input.dealName) return mcpError('INVALID_ARGUMENT', 'createDeal requires dealName');
    const id = `deal-${this.nextNoteId++}`;
    this.deals.set(id, {
      id,
      name: input.dealName,
      amount: input.amount !== undefined ? Number(input.amount) : null,
      pipeline: input.pipeline ?? null,
      dealStage: input.dealStage ?? null,
      closeDate: input.closeDate ?? null,
      createdAt: null,
      updatedAt: null,
    });
    return mcpOk({ dealId: id });
  }

  async updateDealStage(
    input: UpdateDealStageInput,
  ): Promise<McpResult<UpdateDealStageOutput>> {
    this.calls.push({ tool: 'updateDealStage', input });
    const d = this.deals.get(input.dealId);
    if (!d) return mcpError('NOT_FOUND', `No deal ${input.dealId}`);
    this.deals.set(input.dealId, {
      ...d,
      dealStage: input.dealStage,
      pipeline: input.pipeline ?? d.pipeline,
    });
    return mcpOk({ dealId: input.dealId, dealStage: input.dealStage });
  }

  async logActivity(input: LogActivityInput): Promise<McpResult<LogActivityOutput>> {
    this.calls.push({ tool: 'logActivity', input });
    if (!input.body) return mcpError('INVALID_ARGUMENT', 'logActivity requires a body');
    return mcpOk({ activityId: `activity-${this.nextNoteId++}`, activityType: input.activityType });
  }

  async createTask(input: CreateTaskInput): Promise<McpResult<CreateTaskOutput>> {
    this.calls.push({ tool: 'createTask', input });
    if (!input.title) return mcpError('INVALID_ARGUMENT', 'createTask requires a title');
    return mcpOk({ taskId: `task-${this.nextNoteId++}` });
  }

  async sendEmailTemplate(
    input: SendEmailTemplateInput,
  ): Promise<McpResult<SendEmailTemplateOutput>> {
    this.calls.push({ tool: 'sendEmailTemplate', input });
    if (!input.emailId) return mcpError('INVALID_ARGUMENT', 'sendEmailTemplate requires emailId');
    return mcpOk({ statusId: `status-${this.nextNoteId++}` });
  }

  async sendSequenceEnrollment(
    input: SendSequenceEnrollmentInput,
  ): Promise<McpResult<SendSequenceEnrollmentOutput>> {
    this.calls.push({ tool: 'sendSequenceEnrollment', input });
    if (!input.sequenceId) {
      return mcpError('INVALID_ARGUMENT', 'sendSequenceEnrollment requires sequenceId');
    }
    return mcpOk({ enrollmentId: `enrollment-${this.nextNoteId++}` });
  }
}
