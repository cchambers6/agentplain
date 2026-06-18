/**
 * lib/integrations/sierra-mcp/tools.ts
 *
 * The Sierra Interactive tool registry — zod arg schemas + descriptions +
 * wiring to the `SierraMcpServer` interface. Shared by the HTTP route
 * (`app/api/integrations/sierra-mcp/[workspaceId]/route.ts`) and the smoke test
 * via `lib/integrations/mcp-core/dispatch.ts`.
 *
 * The read + internal-annotation surface mirrors the Follow Up Boss MCP so the
 * lead-triage-realestate skill consumes both through one provider-neutral port.
 *
 * Per `project_no_outbound_architecture.md`: `create_note` and `add_tag` are
 * INTERNAL annotations on the broker's own CRM. `send_drip` (write-action wave)
 * IS outbound. All mutating tools are approval-gated at the factory seam.
 */

import { z } from 'zod';
import type { ToolRegistration } from '@/lib/integrations/mcp-core';
import type { SierraMcpServer } from './types';

/** Namespace prefix for Sierra MCP tools (e.g. `sierra.list_leads`). */
export const SIERRA_NAMESPACE = 'sierra';

const listLeadsSchema = z.object({
  limit: z.number().int().positive().max(100).optional(),
  modifiedSince: z.string().optional(),
});
const leadIdSchema = z.object({ leadId: z.string().min(1) });

const createNoteSchema = z.object({
  leadId: z.string().min(1),
  body: z.string().min(1),
  isPrivate: z.boolean().optional(),
  pendingApprovalId: z.string().optional(),
});

const addTagSchema = z.object({
  leadId: z.string().min(1),
  tags: z.array(z.string().min(1)).min(1),
  pendingApprovalId: z.string().optional(),
});

const listPipelinesSchema = z.object({
  limit: z.number().int().positive().max(100).optional(),
});

const getPipelineStageSchema = z.object({
  pipelineId: z.string().min(1),
  stageId: z.string().min(1),
});

// ── Write-action-depth schemas (all approval-gated) ────────────────────────

const createContactSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().optional(),
  phone: z.string().optional(),
  source: z.string().optional(),
  pendingApprovalId: z.string().optional(),
});

const sendDripSchema = z.object({
  contactId: z.string().min(1),
  campaignId: z.string().min(1),
  pendingApprovalId: z.string().optional(),
});

const updateStatusSchema = z.object({
  leadId: z.string().min(1),
  status: z.string().min(1),
  pendingApprovalId: z.string().optional(),
});

export const SIERRA_TOOLS: ReadonlyArray<ToolRegistration<SierraMcpServer>> = [
  {
    name: `${SIERRA_NAMESPACE}.list_leads`,
    description:
      'List leads. limit is 1..100 (default 25). modifiedSince (ISO) returns only leads changed after that time.',
    schema: listLeadsSchema,
    invoke: (s, a) => s.listLeads(listLeadsSchema.parse(a)),
  },
  {
    name: `${SIERRA_NAMESPACE}.get_lead`,
    description: 'Get a single lead by its Sierra contact id.',
    schema: leadIdSchema,
    invoke: (s, a) => s.getLead(leadIdSchema.parse(a)),
  },
  {
    name: `${SIERRA_NAMESPACE}.create_note`,
    description:
      'Add an internal note to a lead (isPrivate defaults true). Internal CRM annotation — not customer-facing.',
    schema: createNoteSchema,
    invoke: (s, a) => s.createNote(createNoteSchema.parse(a)),
  },
  {
    name: `${SIERRA_NAMESPACE}.add_tag`,
    description: 'Add one or more tags to a lead.',
    schema: addTagSchema,
    invoke: (s, a) => s.addTag(addTagSchema.parse(a)),
  },
  {
    name: `${SIERRA_NAMESPACE}.list_pipelines`,
    description: 'List pipelines and their stages. limit is 1..100 (default 25).',
    schema: listPipelinesSchema,
    invoke: (s, a) => s.listPipelines(listPipelinesSchema.parse(a)),
  },
  {
    name: `${SIERRA_NAMESPACE}.get_pipeline_stage`,
    description: 'Get a single pipeline stage by pipelineId + stageId.',
    schema: getPipelineStageSchema,
    invoke: (s, a) => s.getPipelineStage(getPipelineStageSchema.parse(a)),
  },
  // ── Write-action-depth tools (approval-gated mutations) ──────────────────
  {
    name: `${SIERRA_NAMESPACE}.create_contact`,
    description:
      'Create a new lead/contact (firstName + lastName required; email/phone/source optional). Approval-gated.',
    schema: createContactSchema,
    invoke: (s, a) => s.createContact(createContactSchema.parse(a)),
  },
  {
    name: `${SIERRA_NAMESPACE}.send_drip`,
    description:
      'Enroll a contact into a drip campaign (contactId + campaignId). OUTBOUND — approval-gated.',
    schema: sendDripSchema,
    invoke: (s, a) => s.sendDrip(sendDripSchema.parse(a)),
  },
  {
    name: `${SIERRA_NAMESPACE}.update_status`,
    description: "Update a lead's status (leadId + status). Approval-gated.",
    schema: updateStatusSchema,
    invoke: (s, a) => s.updateStatus(updateStatusSchema.parse(a)),
  },
];
