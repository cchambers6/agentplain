/**
 * lib/integrations/sierra-mcp/test-server.ts
 *
 * In-memory Sierra Interactive MCP for tests. Mirrors the FUB +
 * QuickBooks test-server patterns. Tests seed leads + pipelines;
 * assertions read back the captured write-side calls.
 */

import { mcpError, mcpOk, type McpResult } from '@/lib/integrations/mcp-core';
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
  SierraLeadSummary,
  SierraMcpServer,
  SierraPipelineSummary,
} from './types';
import type {
  CreateContactInput,
  CreateContactOutput,
  SendDripInput,
  SendDripOutput,
  UpdateStatusInput,
  UpdateStatusOutput,
} from './actions';

export interface TestSierraSeed {
  leads?: SierraLeadSummary[];
  pipelines?: SierraPipelineSummary[];
}

export interface RecordedSierraCall {
  tool:
    | 'listLeads'
    | 'getLead'
    | 'createNote'
    | 'addTag'
    | 'listPipelines'
    | 'getPipelineStage'
    | 'createContact'
    | 'sendDrip'
    | 'updateStatus';
  input: unknown;
}

export class RecordingSierraMcpServer implements SierraMcpServer {
  readonly name = 'recording' as const;
  readonly workspaceId: string;
  readonly calls: RecordedSierraCall[] = [];
  private readonly leads: Map<string, SierraLeadSummary>;
  private readonly pipelines: Map<string, SierraPipelineSummary>;
  private nextNoteId = 2000;
  private nextContactId = 3000;
  private nextEnrollmentId = 4000;

  constructor(args: { workspaceId: string; seed?: TestSierraSeed }) {
    this.workspaceId = args.workspaceId;
    this.leads = new Map(
      (args.seed?.leads ?? []).map((l) => [l.id, { ...l, tags: [...l.tags] }]),
    );
    this.pipelines = new Map(
      (args.seed?.pipelines ?? []).map((p) => [p.id, p]),
    );
  }

  async listLeads(input: ListLeadsInput): Promise<McpResult<ListLeadsOutput>> {
    this.calls.push({ tool: 'listLeads', input });
    const limit = input.limit ?? 25;
    return mcpOk({ leads: [...this.leads.values()].slice(0, limit) });
  }

  async getLead(input: GetLeadInput): Promise<McpResult<GetLeadOutput>> {
    this.calls.push({ tool: 'getLead', input });
    const lead = this.leads.get(input.leadId);
    if (!lead) return mcpError('NOT_FOUND', `No lead ${input.leadId}`);
    return mcpOk({ lead });
  }

  async createNote(
    input: CreateNoteInput,
  ): Promise<McpResult<CreateNoteOutput>> {
    this.calls.push({ tool: 'createNote', input });
    if (!this.leads.has(input.leadId)) {
      return mcpError('NOT_FOUND', `No lead ${input.leadId}`);
    }
    const noteId = `sierra-note-${this.nextNoteId++}`;
    return mcpOk({ noteId });
  }

  async addTag(input: AddTagInput): Promise<McpResult<AddTagOutput>> {
    this.calls.push({ tool: 'addTag', input });
    const lead = this.leads.get(input.leadId);
    if (!lead) return mcpError('NOT_FOUND', `No lead ${input.leadId}`);
    const merged = Array.from(new Set([...lead.tags, ...input.tags]));
    this.leads.set(input.leadId, { ...lead, tags: merged });
    return mcpOk({ applied: input.tags });
  }

  async listPipelines(
    input: ListPipelinesInput,
  ): Promise<McpResult<ListPipelinesOutput>> {
    this.calls.push({ tool: 'listPipelines', input });
    const limit = input.limit ?? 25;
    return mcpOk({
      pipelines: [...this.pipelines.values()].slice(0, limit),
    });
  }

  async getPipelineStage(
    input: GetPipelineStageInput,
  ): Promise<McpResult<GetPipelineStageOutput>> {
    this.calls.push({ tool: 'getPipelineStage', input });
    const p = this.pipelines.get(input.pipelineId);
    if (!p) return mcpError('NOT_FOUND', `No pipeline ${input.pipelineId}`);
    const stage = p.stages.find((s) => s.id === input.stageId);
    if (!stage) {
      return mcpError(
        'NOT_FOUND',
        `Pipeline ${input.pipelineId} has no stage ${input.stageId}`,
      );
    }
    return mcpOk({ stage });
  }

  // ── Write-action-depth mutations ──────────────────────────────────────

  async createContact(
    input: CreateContactInput,
  ): Promise<McpResult<CreateContactOutput>> {
    this.calls.push({ tool: 'createContact', input });
    const contactId = `sierra-contact-${this.nextContactId++}`;
    this.leads.set(contactId, {
      id: contactId,
      firstName: input.firstName,
      lastName: input.lastName,
      emails: input.email ? [input.email] : [],
      phones: input.phone ? [input.phone] : [],
      source: input.source ?? null,
      stage: null,
      tags: [],
      lastActivityAt: null,
      createdAt: null,
    });
    return mcpOk({ contactId });
  }

  async sendDrip(input: SendDripInput): Promise<McpResult<SendDripOutput>> {
    this.calls.push({ tool: 'sendDrip', input });
    const enrollmentId = `sierra-enroll-${this.nextEnrollmentId++}`;
    return mcpOk({ enrollmentId });
  }

  async updateStatus(
    input: UpdateStatusInput,
  ): Promise<McpResult<UpdateStatusOutput>> {
    this.calls.push({ tool: 'updateStatus', input });
    const lead = this.leads.get(input.leadId);
    if (lead) {
      this.leads.set(input.leadId, { ...lead, stage: input.status });
    }
    return mcpOk({ leadId: input.leadId, status: input.status });
  }
}
