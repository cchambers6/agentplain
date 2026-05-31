/**
 * lib/integrations/follow-up-boss-mcp/types.ts
 *
 * Wave-3 Follow Up Boss MCP. The realty CRM with the largest install
 * base among small independent brokerages (the wave-2 deferred-CRM
 * top of list per PR #123). Authenticates with a per-workspace API
 * key (HTTP Basic) — no OAuth.
 *
 * Per `feedback_no_silent_vendor_lock.md`: this file is the ONLY place
 * that names FUB's REST shape. Skills + cron sweeps speak the typed
 * MCP interface below.
 *
 * Per `project_no_outbound_architecture.md`: the MCP exposes `create_note`
 * and `add_tag` (write paths) that the lead-triage skill calls to MIRROR
 * agentplain's triage decision back into the broker's CRM — these are
 * INTERNAL annotations on the broker's own CRM, not customer-facing
 * outbound. No tool here sends mail, SMS, or anything to the lead.
 *
 * Per `feedback_runner_portability.md`: two impls — `ProdFollowUpBossMcpServer`
 * (production REST) and `RecordingFollowUpBossMcpServer` (test).
 */

import type { McpResult } from '@/lib/integrations/mcp-core';

// ── DTOs the MCP returns ──────────────────────────────────────────────

export interface FubLeadSummary {
  /** FUB person id. */
  id: string;
  firstName: string | null;
  lastName: string | null;
  emails: string[];
  phones: string[];
  /** Free-text source ("Zillow", "IDX", "Manual", etc.). */
  source: string | null;
  /** Pipeline stage at the time of read. */
  stage: string | null;
  /** Tags currently applied. */
  tags: string[];
  /** UTC ISO timestamp of last activity in FUB. */
  lastActivityAt: string | null;
  /** UTC ISO timestamp the lead was created in FUB. */
  createdAt: string | null;
}

export interface FubPipelineSummary {
  id: string;
  name: string;
  stages: Array<{ id: string; name: string; sortOrder: number }>;
}

/** Wave-4 — FUB account user (agent on the brokerage's roster). The
 *  `list_users` tool surfaces these so the lead-triage skill can route
 *  to a specific agent based on territory + specialty tags FUB carries
 *  on each user. */
export interface FubUserSummary {
  /** FUB user id. */
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  /** FUB account role — "Owner", "Lender", "Agent", "Admin", etc. */
  role: string | null;
  /** Whether the user is currently active in FUB. */
  active: boolean;
  /** FUB exposes a per-user `groups` array — brokerages typically use
   *  groups as specialty / territory tags ("luxury", "north fulton",
   *  "first-time buyer"). The lead-triage skill reads these. */
  groups: string[];
}

/** Wave-4 — FUB lead-list (drip-campaign equivalent on the FUB side).
 *  Surfaced so the lead-triage skill can enrol cold / nurture leads in
 *  the right list rather than routing to `manual`. */
export interface FubLeadListSummary {
  id: string;
  name: string;
  /** FUB exposes a per-list visibility flag — public lists are shared
   *  across the team; private ones are owner-only. */
  isPublic: boolean;
}

// ── Tool I/O shapes ───────────────────────────────────────────────────

export interface ListLeadsInput {
  /** Cap on results. Default 25, max 100. */
  limit?: number;
  /** When set, only leads modified after this ISO timestamp. */
  modifiedSince?: string;
}
export interface ListLeadsOutput {
  leads: FubLeadSummary[];
}

export interface GetLeadInput {
  leadId: string;
}
export interface GetLeadOutput {
  lead: FubLeadSummary;
}

export interface CreateNoteInput {
  leadId: string;
  body: string;
  /** Whether the note is visible to all FUB users on the account
   *  (default true) or pinned as private. */
  isPrivate?: boolean;
}
export interface CreateNoteOutput {
  noteId: string;
}

export interface AddTagInput {
  leadId: string;
  /** Tag name(s) to add. FUB upserts by name. */
  tags: string[];
}
export interface AddTagOutput {
  applied: string[];
}

export interface ListPipelinesInput {
  /** Optional cap. */
  limit?: number;
}
export interface ListPipelinesOutput {
  pipelines: FubPipelineSummary[];
}

export interface GetPipelineStageInput {
  pipelineId: string;
  stageId: string;
}
export interface GetPipelineStageOutput {
  stage: { id: string; name: string; sortOrder: number };
}

export interface ListUsersInput {
  limit?: number;
  /** When true, only `active === true` users are returned. Defaults
   *  true — the lead-triage roster shouldn't route to disabled users. */
  activeOnly?: boolean;
}
export interface ListUsersOutput {
  users: FubUserSummary[];
}

export interface ListLeadListsInput {
  limit?: number;
}
export interface ListLeadListsOutput {
  lists: FubLeadListSummary[];
}

// ── Server interface ──────────────────────────────────────────────────

export interface FollowUpBossMcpServer {
  readonly name: string;
  readonly workspaceId: string;

  listLeads(input: ListLeadsInput): Promise<McpResult<ListLeadsOutput>>;
  getLead(input: GetLeadInput): Promise<McpResult<GetLeadOutput>>;
  createNote(input: CreateNoteInput): Promise<McpResult<CreateNoteOutput>>;
  addTag(input: AddTagInput): Promise<McpResult<AddTagOutput>>;
  listPipelines(
    input: ListPipelinesInput,
  ): Promise<McpResult<ListPipelinesOutput>>;
  getPipelineStage(
    input: GetPipelineStageInput,
  ): Promise<McpResult<GetPipelineStageOutput>>;
  /** Wave-4 — populate the lead-triage agent roster from FUB. */
  listUsers(input: ListUsersInput): Promise<McpResult<ListUsersOutput>>;
  /** Wave-4 — surface FUB lead-lists so the lead-triage skill can
   *  route cold / nurture leads to a real list instead of `manual`. */
  listLeadLists(
    input: ListLeadListsInput,
  ): Promise<McpResult<ListLeadListsOutput>>;
}
