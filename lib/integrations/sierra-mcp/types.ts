/**
 * lib/integrations/sierra-mcp/types.ts
 *
 * Wave-4 Sierra Interactive MCP. Sierra is one of the top realty CRMs
 * among small brokerages and exposes a per-account API key
 * (`Authorization: Bearer <key>`). No OAuth partner enrollment needed.
 *
 * The 6-tool surface mirrors the wave-3 Follow Up Boss MCP so the
 * lead-triage-realestate skill consumes both through one provider-
 * neutral port — adding a third realty CRM means dropping in another
 * MCP that honors the same `RealtyCrmMcpServer`-shaped contract.
 *
 * Per `feedback_no_silent_vendor_lock.md`: this file is the ONLY place
 * that names Sierra's REST shape. Skills + cron sweeps speak the typed
 * MCP interface below.
 *
 * Per `project_no_outbound_architecture.md`: `createNote` and `addTag`
 * are INTERNAL annotations on the broker's own CRM — never customer-
 * facing outbound.
 *
 * Per `feedback_runner_portability.md`: two impls — `ProdSierraMcpServer`
 * (production REST) and `RecordingSierraMcpServer` (test).
 */

import type { McpResult } from '@/lib/integrations/mcp-core';

// ── DTOs the MCP returns ──────────────────────────────────────────────

export interface SierraLeadSummary {
  /** Sierra contact id. */
  id: string;
  firstName: string | null;
  lastName: string | null;
  emails: string[];
  phones: string[];
  /** Free-text source ("Zillow", "IDX", "Sierra Lead Capture"...). */
  source: string | null;
  /** Pipeline stage at read time. */
  stage: string | null;
  /** Tags currently applied. */
  tags: string[];
  lastActivityAt: string | null;
  createdAt: string | null;
}

export interface SierraPipelineSummary {
  id: string;
  name: string;
  stages: Array<{ id: string; name: string; sortOrder: number }>;
}

// ── Tool I/O shapes ───────────────────────────────────────────────────

export interface ListLeadsInput {
  limit?: number;
  modifiedSince?: string;
}
export interface ListLeadsOutput {
  leads: SierraLeadSummary[];
}

export interface GetLeadInput {
  leadId: string;
}
export interface GetLeadOutput {
  lead: SierraLeadSummary;
}

export interface CreateNoteInput {
  leadId: string;
  body: string;
  /** Whether the note is internal-only (default true). Sierra honors a
   *  per-note privacy flag; we default to internal so triage notes
   *  never accidentally surface to a customer-facing portal view. */
  isPrivate?: boolean;
}
export interface CreateNoteOutput {
  noteId: string;
}

export interface AddTagInput {
  leadId: string;
  tags: string[];
}
export interface AddTagOutput {
  applied: string[];
}

export interface ListPipelinesInput {
  limit?: number;
}
export interface ListPipelinesOutput {
  pipelines: SierraPipelineSummary[];
}

export interface GetPipelineStageInput {
  pipelineId: string;
  stageId: string;
}
export interface GetPipelineStageOutput {
  stage: { id: string; name: string; sortOrder: number };
}

// ── Server interface ──────────────────────────────────────────────────

export interface SierraMcpServer {
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
}
