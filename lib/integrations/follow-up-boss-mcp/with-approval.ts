/**
 * lib/integrations/follow-up-boss-mcp/with-approval.ts
 *
 * The Follow Up Boss approval gate — the connector-specific decorator that
 * forces EVERY mutating FUB method through the shared connector approval gate
 * (`lib/integrations/approval`) before the REST API is touched. Mirrors
 * `hubspot-mcp/with-approval.ts`, built on the generic gate so the connectors
 * share one fingerprint/persistence/audit core.
 *
 * Read methods (list/get) pass straight through. Mutations — the two
 * pre-existing internal-annotation writes (createNote / addTag) AND the three
 * write-action-depth additions (createLead / sendTextTemplate /
 * scheduleActionPlan) — are intercepted: a missing/invalid/expired grant
 * returns APPROVAL_REQUIRED and the FUB call never happens; a valid grant lets
 * the call run and is audit-logged.
 *
 * Installed at the factory seam (`buildFollowUpBossMcpServer`), so an ungated
 * FUB server cannot be obtained.
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
  FollowUpBossMcpServer,
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
import {
  CREATE_LEAD,
  FOLLOW_UP_BOSS_CONNECTOR,
  SCHEDULE_ACTION_PLAN,
  SEND_TEXT_TEMPLATE,
  fubAction,
  type CreateLeadInput,
  type CreateLeadOutput,
  type ScheduleActionPlanInput,
  type ScheduleActionPlanOutput,
  type SendTextTemplateInput,
  type SendTextTemplateOutput,
  type WriteActionDescriptor,
} from './actions';

/** Wrap a FUB server so all mutating methods require an approved grant. */
export function withFollowUpBossApproval(
  inner: FollowUpBossMcpServer,
  deps: ConnectorApprovalDeps,
): FollowUpBossMcpServer {
  return new GatedFollowUpBossMcpServer(inner, deps);
}

class GatedFollowUpBossMcpServer implements FollowUpBossMcpServer {
  readonly name: string;
  readonly workspaceId: string;

  constructor(
    private readonly inner: FollowUpBossMcpServer,
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
  listUsers(input: ListUsersInput): Promise<McpResult<ListUsersOutput>> {
    return this.inner.listUsers(input);
  }
  listLeadLists(
    input: ListLeadListsInput,
  ): Promise<McpResult<ListLeadListsOutput>> {
    return this.inner.listLeadLists(input);
  }

  // ── Pre-existing internal-annotation writes: now gated ─────────────────

  createNote(input: CreateNoteInput): Promise<McpResult<CreateNoteOutput>> {
    const action: GatedAction = {
      connector: FOLLOW_UP_BOSS_CONNECTOR,
      action: 'create_note',
      pendingApprovalId: input.pendingApprovalId,
      discipline: 'sales',
      detail: {
        leadId: input.leadId,
        body: input.body,
        isPrivate: input.isPrivate ?? null,
      },
    };
    return this.gate(action, () => this.inner.createNote(input));
  }

  addTag(input: AddTagInput): Promise<McpResult<AddTagOutput>> {
    const action: GatedAction = {
      connector: FOLLOW_UP_BOSS_CONNECTOR,
      action: 'add_tag',
      pendingApprovalId: input.pendingApprovalId,
      discipline: 'sales',
      detail: { leadId: input.leadId, tags: input.tags },
    };
    return this.gate(action, () => this.inner.addTag(input));
  }

  // ── Write-action-depth mutations ───────────────────────────────────────

  createLead(input: CreateLeadInput): Promise<McpResult<CreateLeadOutput>> {
    return this.gate(fubAction(CREATE_LEAD, input), () =>
      this.inner.createLead(input),
    );
  }
  sendTextTemplate(
    input: SendTextTemplateInput,
  ): Promise<McpResult<SendTextTemplateOutput>> {
    return this.gate(fubAction(SEND_TEXT_TEMPLATE, input), () =>
      this.inner.sendTextTemplate(input),
    );
  }
  scheduleActionPlan(
    input: ScheduleActionPlanInput,
  ): Promise<McpResult<ScheduleActionPlanOutput>> {
    return this.gate(fubAction(SCHEDULE_ACTION_PLAN, input), () =>
      this.inner.scheduleActionPlan(input),
    );
  }
}

// Re-export for symmetry with other connectors' approval modules.
export type { WriteActionDescriptor };
