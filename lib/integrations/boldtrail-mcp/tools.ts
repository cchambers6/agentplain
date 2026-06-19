/**
 * lib/integrations/boldtrail-mcp/tools.ts
 *
 * The BoldTrail tool registry — zod arg schemas + descriptions + wiring to the
 * `BoldtrailMcpServer` interface. Shared by the HTTP route
 * (`app/api/integrations/boldtrail-mcp/[workspaceId]/route.ts`) and the smoke
 * test via `lib/integrations/mcp-core/dispatch.ts`.
 *
 * Per `project_no_outbound_architecture.md`: `update_pipeline` and
 * `send_template` are MUTATING — the server gates each behind approval before
 * BoldTrail is ever called. `list_leads` is read-only.
 */

import { z } from 'zod';
import type { ToolRegistration } from '@/lib/integrations/mcp-core';
import { BOLDTRAIL_NAMESPACE, type BoldtrailMcpServer } from './types';

const listLeadsSchema = z.object({
  query: z.string().optional(),
  limit: z.number().int().positive().max(100).optional(),
});

const updatePipelineSchema = z.object({
  leadId: z.string().min(1),
  pipelineId: z.string().min(1),
  stage: z.string().min(1),
  pendingApprovalId: z.string().optional(),
});

const sendTemplateSchema = z.object({
  leadId: z.string().min(1),
  templateId: z.string().min(1),
  pendingApprovalId: z.string().optional(),
});

export const BOLDTRAIL_TOOLS: ReadonlyArray<ToolRegistration<BoldtrailMcpServer>> = [
  {
    name: `${BOLDTRAIL_NAMESPACE}.list_leads`,
    description:
      'List leads, optionally filtered by free-text query (name / email). limit is 1..100 (default 25). Read-only.',
    schema: listLeadsSchema,
    invoke: (s, a) => s.listLeads(listLeadsSchema.parse(a)),
  },
  {
    name: `${BOLDTRAIL_NAMESPACE}.update_pipeline`,
    description:
      'Move a lead to a pipeline stage. MUTATING — requires human approval via /approvals before it runs.',
    schema: updatePipelineSchema,
    invoke: (s, a) => s.updatePipeline(updatePipelineSchema.parse(a)),
  },
  {
    name: `${BOLDTRAIL_NAMESPACE}.send_template`,
    description:
      'Send a templated message to a lead through BoldTrail. MUTATING + outbound — requires human approval before it runs.',
    schema: sendTemplateSchema,
    invoke: (s, a) => s.sendTemplate(sendTemplateSchema.parse(a)),
  },
];
