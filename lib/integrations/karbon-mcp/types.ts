/**
 * lib/integrations/karbon-mcp/types.ts
 *
 * Karbon HQ MCP server tool surface. One instance per `{workspaceId}` per
 * request (never reused across workspaces). Built on
 * `lib/integrations/mcp-core` — the vendor-neutral JSON-RPC envelope +
 * result shapes — so the wire format matches the shipped Gmail/Outlook/
 * QuickBooks/TaxDome servers.
 *
 * Per `feedback_integration_acceptance_is_functional.md`: this surface
 * covers the real CPA-firm value loop — list/read the firm's workflows
 * (Karbon's name for in-flight engagements), list/read clients, list
 * jobs (single tasks attached to a workflow), and recurring tasks. The
 * month-end-close-cpa skill reads these to enrich its draft chase
 * emails ("3 stuck jobs in Karbon" / "engagement workflow Q3-2026 has
 * been blocked for 9 days").
 *
 * Per `project_no_outbound_architecture.md`: read-only by contract.
 *
 * Per `feedback_no_silent_vendor_lock.md`: Karbon REST calls only
 * appear in `server.ts`. The skill layer (and any tool dispatch) sees
 * the `KarbonMcpServer` interface.
 *
 * Auth note: Karbon API v3 uses two static headers (`Authorization:
 * Bearer <accessToken>` + `AccessKey: <accessKey>`) per the developer
 * docs at developers.karbonhq.com (read 2026-05-29). Both are static
 * keys provided after partner registration. We persist the
 * `accessToken` (the Bearer) in `IntegrationCredential.access
 * TokenEncrypted` and the `accessKey` (the per-firm AccessKey header)
 * in `providerMetadata.accessKey`. `refreshTokenEncrypted` stays NULL;
 * `expiresAt` is pinned far in the future. Neither key rotates.
 */

import type { McpResult, McpServerBase } from '@/lib/integrations/mcp-core';

export type KarbonMcpResult<T> = McpResult<T>;

// ── DTOs ─────────────────────────────────────────────────────────────────

export interface KarbonClientSummary {
  id: string;
  name: string;
  email: string | null;
  /** Karbon distinguishes Organization vs Contact clients; we flatten
   *  to `kind` for downstream filtering. */
  kind: 'organization' | 'contact';
}

export interface ListClientsInput {
  count?: number;
}
export interface ListClientsOutput {
  clients: KarbonClientSummary[];
}

export interface GetClientInput {
  clientId: string;
}
export interface GetClientOutput {
  client: KarbonClientSummary;
}

export interface KarbonWorkflowSummary {
  id: string;
  /** Engagement / workflow title — "2026 Tax Return", "Q1 Monthly Close". */
  title: string;
  clientId: string | null;
  /** Karbon workflow status — `active`, `completed`, `archived`. */
  status: 'active' | 'completed' | 'archived';
  /** Days since the workflow last advanced (any job state transition).
   *  null when the API does not surface a last-activity timestamp. */
  daysSinceLastActivity: number | null;
}

export interface ListWorkflowsInput {
  clientId?: string;
  status?: KarbonWorkflowSummary['status'];
  count?: number;
}
export interface ListWorkflowsOutput {
  workflows: KarbonWorkflowSummary[];
}

export interface GetWorkflowInput {
  workflowId: string;
}
export interface GetWorkflowOutput {
  workflow: KarbonWorkflowSummary;
}

export interface KarbonJobSummary {
  id: string;
  workflowId: string;
  /** Title of the job (a workflow line item). */
  title: string;
  /** Workflow column the job is in — `todo`, `in-progress`, `review`,
   *  `done`, `blocked`. We map all Karbon column states into this set
   *  so downstream consumers can filter without knowing Karbon's
   *  per-firm column names. */
  status: 'todo' | 'in-progress' | 'review' | 'done' | 'blocked';
  /** Assignee (firm staff) — null when unassigned. */
  assigneeEmail: string | null;
  /** Due date for the job — null when no due date set. */
  dueAt: string | null;
}

export interface ListJobsInput {
  workflowId?: string;
  status?: KarbonJobSummary['status'];
  count?: number;
}
export interface ListJobsOutput {
  jobs: KarbonJobSummary[];
}

export interface KarbonRecurringTaskSummary {
  id: string;
  title: string;
  clientId: string | null;
  /** Cadence label — `weekly`, `monthly`, `quarterly`, `yearly`,
   *  `other`. */
  cadence: 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'other';
  /** Next scheduled fire (ISO datetime). null when paused. */
  nextDueAt: string | null;
}

export interface ListRecurringTasksInput {
  clientId?: string;
  count?: number;
}
export interface ListRecurringTasksOutput {
  recurringTasks: KarbonRecurringTaskSummary[];
}

// ── Interface every implementation honors ──────────────────────────────────

export interface KarbonMcpServer extends McpServerBase {
  listClients(input: ListClientsInput): Promise<KarbonMcpResult<ListClientsOutput>>;
  getClient(input: GetClientInput): Promise<KarbonMcpResult<GetClientOutput>>;
  listWorkflows(input: ListWorkflowsInput): Promise<KarbonMcpResult<ListWorkflowsOutput>>;
  getWorkflow(input: GetWorkflowInput): Promise<KarbonMcpResult<GetWorkflowOutput>>;
  listJobs(input: ListJobsInput): Promise<KarbonMcpResult<ListJobsOutput>>;
  listRecurringTasks(
    input: ListRecurringTasksInput,
  ): Promise<KarbonMcpResult<ListRecurringTasksOutput>>;
}

export const KARBON_NAMESPACE = 'karbon';
