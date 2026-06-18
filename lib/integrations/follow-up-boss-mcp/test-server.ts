/**
 * lib/integrations/follow-up-boss-mcp/test-server.ts
 *
 * In-memory FUB MCP for tests. Mirrors the QuickBooks test-server pattern.
 * Tests seed leads + pipelines; assertions read back the captured
 * write-side calls.
 */

import { mcpError, mcpOk, type McpResult } from '@/lib/integrations/mcp-core';
import type {
  CreateLeadInput,
  CreateLeadOutput,
  ScheduleActionPlanInput,
  ScheduleActionPlanOutput,
  SendTextTemplateInput,
  SendTextTemplateOutput,
} from './actions';
import type {
  AddTagInput,
  AddTagOutput,
  CreateNoteInput,
  CreateNoteOutput,
  FollowUpBossMcpServer,
  FubLeadListSummary,
  FubLeadSummary,
  FubPipelineSummary,
  FubUserSummary,
  GetLeadInput,
  GetLeadOutput,
  GetPipelineStageInput,
  GetPipelineStageOutput,
  ListLeadListsInput,
  ListLeadListsOutput,
  ListLeadsInput,
  ListLeadsOutput,
  ListPipelinesInput,
  ListPipelinesOutput,
  ListUsersInput,
  ListUsersOutput,
} from './types';

export interface TestFollowUpBossSeed {
  leads?: FubLeadSummary[];
  pipelines?: FubPipelineSummary[];
  users?: FubUserSummary[];
  leadLists?: FubLeadListSummary[];
}

export interface RecordedFubCall {
  tool:
    | 'listLeads'
    | 'getLead'
    | 'createNote'
    | 'addTag'
    | 'listPipelines'
    | 'getPipelineStage'
    | 'listUsers'
    | 'listLeadLists'
    | 'createLead'
    | 'sendTextTemplate'
    | 'scheduleActionPlan';
  input: unknown;
}

export class RecordingFollowUpBossMcpServer implements FollowUpBossMcpServer {
  readonly name = 'recording' as const;
  readonly workspaceId: string;
  readonly calls: RecordedFubCall[] = [];
  private readonly leads: Map<string, FubLeadSummary>;
  private readonly pipelines: Map<string, FubPipelineSummary>;
  private readonly users: FubUserSummary[];
  private readonly leadLists: FubLeadListSummary[];
  private nextNoteId = 1000;
  private nextLeadId = 5000;
  private nextMessageId = 7000;
  private nextActionPlanPersonId = 9000;

  constructor(args: {
    workspaceId: string;
    seed?: TestFollowUpBossSeed;
  }) {
    this.workspaceId = args.workspaceId;
    this.leads = new Map(
      (args.seed?.leads ?? []).map((l) => [l.id, { ...l, tags: [...l.tags] }]),
    );
    this.pipelines = new Map(
      (args.seed?.pipelines ?? []).map((p) => [p.id, p]),
    );
    this.users = (args.seed?.users ?? []).map((u) => ({
      ...u,
      groups: [...u.groups],
    }));
    this.leadLists = [...(args.seed?.leadLists ?? [])];
  }

  async listLeads(input: ListLeadsInput): Promise<McpResult<ListLeadsOutput>> {
    this.calls.push({ tool: 'listLeads', input });
    const limit = input.limit ?? 25;
    const leads = [...this.leads.values()].slice(0, limit);
    return mcpOk({ leads });
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
    const noteId = `note-${this.nextNoteId++}`;
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
    return mcpOk({ pipelines: [...this.pipelines.values()].slice(0, limit) });
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

  async listUsers(input: ListUsersInput): Promise<McpResult<ListUsersOutput>> {
    this.calls.push({ tool: 'listUsers', input });
    const limit = input.limit ?? 25;
    const activeOnly = input.activeOnly ?? true;
    const filtered = activeOnly
      ? this.users.filter((u) => u.active)
      : this.users;
    return mcpOk({ users: filtered.slice(0, limit) });
  }

  async listLeadLists(
    input: ListLeadListsInput,
  ): Promise<McpResult<ListLeadListsOutput>> {
    this.calls.push({ tool: 'listLeadLists', input });
    const limit = input.limit ?? 25;
    return mcpOk({ lists: this.leadLists.slice(0, limit) });
  }

  async createLead(
    input: CreateLeadInput,
  ): Promise<McpResult<CreateLeadOutput>> {
    this.calls.push({ tool: 'createLead', input });
    return mcpOk({ leadId: `lead-${this.nextLeadId++}` });
  }

  async sendTextTemplate(
    input: SendTextTemplateInput,
  ): Promise<McpResult<SendTextTemplateOutput>> {
    this.calls.push({ tool: 'sendTextTemplate', input });
    if (!this.leads.has(input.personId)) {
      return mcpError('NOT_FOUND', `No lead ${input.personId}`);
    }
    return mcpOk({ messageId: `msg-${this.nextMessageId++}` });
  }

  async scheduleActionPlan(
    input: ScheduleActionPlanInput,
  ): Promise<McpResult<ScheduleActionPlanOutput>> {
    this.calls.push({ tool: 'scheduleActionPlan', input });
    if (!this.leads.has(input.personId)) {
      return mcpError('NOT_FOUND', `No lead ${input.personId}`);
    }
    return mcpOk({ actionPlanPersonId: `app-${this.nextActionPlanPersonId++}` });
  }
}
