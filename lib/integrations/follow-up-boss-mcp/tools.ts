/**
 * lib/integrations/follow-up-boss-mcp/tools.ts
 *
 * The Follow Up Boss tool registry — zod arg schemas + descriptions + wiring
 * to the `FollowUpBossMcpServer` interface. Shared by the HTTP route
 * (`app/api/integrations/follow-up-boss-mcp/[workspaceId]/route.ts`) and the
 * smoke test via `lib/integrations/mcp-core/dispatch.ts`.
 *
 * Per `project_no_outbound_architecture.md`: `create_note` and `add_tag`
 * MIRROR agentplain's triage decision back into the broker's own CRM — INTERNAL
 * annotations, not customer-facing outbound. No tool here sends mail or SMS.
 */

import { z } from 'zod';
import type { ToolRegistration } from '@/lib/integrations/mcp-core';
import type { FollowUpBossMcpServer } from './types';

/** Namespace prefix for Follow Up Boss MCP tools (e.g. `follow-up-boss.list_leads`). */
export const FOLLOW_UP_BOSS_NAMESPACE = 'follow-up-boss';

const listLeadsSchema = z.object({
  limit: z.number().int().positive().max(100).optional(),
  modifiedSince: z.string().optional(),
});
const leadIdSchema = z.object({ leadId: z.string().min(1) });

const createNoteSchema = z.object({
  leadId: z.string().min(1),
  body: z.string().min(1),
  isPrivate: z.boolean().optional(),
  pendingApprovalId: z.string().min(1).optional(),
});

const addTagSchema = z.object({
  leadId: z.string().min(1),
  tags: z.array(z.string().min(1)).min(1),
  pendingApprovalId: z.string().min(1).optional(),
});

const createLeadSchema = z.object({
  name: z.string().min(1).optional(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().min(1).optional(),
  phone: z.string().min(1).optional(),
  source: z.string().min(1).optional(),
  pendingApprovalId: z.string().min(1).optional(),
});

const sendTextTemplateSchema = z.object({
  personId: z.string().min(1),
  templateId: z.string().min(1),
  message: z.string().min(1).optional(),
  pendingApprovalId: z.string().min(1).optional(),
});

const scheduleActionPlanSchema = z.object({
  personId: z.string().min(1),
  actionPlanId: z.string().min(1),
  pendingApprovalId: z.string().min(1).optional(),
});

const listPipelinesSchema = z.object({
  limit: z.number().int().positive().max(100).optional(),
});

const getPipelineStageSchema = z.object({
  pipelineId: z.string().min(1),
  stageId: z.string().min(1),
});

const listUsersSchema = z.object({
  limit: z.number().int().positive().max(100).optional(),
  activeOnly: z.boolean().optional(),
});

const listLeadListsSchema = z.object({
  limit: z.number().int().positive().max(100).optional(),
});

export const FOLLOW_UP_BOSS_TOOLS: ReadonlyArray<ToolRegistration<FollowUpBossMcpServer>> = [
  {
    name: `${FOLLOW_UP_BOSS_NAMESPACE}.list_leads`,
    description:
      'List leads. limit is 1..100 (default 25). modifiedSince (ISO) returns only leads changed after that time.',
    schema: listLeadsSchema,
    invoke: (s, a) => s.listLeads(listLeadsSchema.parse(a)),
  },
  {
    name: `${FOLLOW_UP_BOSS_NAMESPACE}.get_lead`,
    description: 'Get a single lead by its Follow Up Boss person id.',
    schema: leadIdSchema,
    invoke: (s, a) => s.getLead(leadIdSchema.parse(a)),
  },
  {
    name: `${FOLLOW_UP_BOSS_NAMESPACE}.create_note`,
    description:
      'Add an internal note to a lead (isPrivate defaults true). Internal CRM annotation — not customer-facing.',
    schema: createNoteSchema,
    invoke: (s, a) => s.createNote(createNoteSchema.parse(a)),
  },
  {
    name: `${FOLLOW_UP_BOSS_NAMESPACE}.add_tag`,
    description: 'Add one or more tags to a lead (FUB upserts by name).',
    schema: addTagSchema,
    invoke: (s, a) => s.addTag(addTagSchema.parse(a)),
  },
  {
    name: `${FOLLOW_UP_BOSS_NAMESPACE}.list_pipelines`,
    description: 'List pipelines and their stages. limit is 1..100 (default 25).',
    schema: listPipelinesSchema,
    invoke: (s, a) => s.listPipelines(listPipelinesSchema.parse(a)),
  },
  {
    name: `${FOLLOW_UP_BOSS_NAMESPACE}.get_pipeline_stage`,
    description: 'Get a single pipeline stage by pipelineId + stageId.',
    schema: getPipelineStageSchema,
    invoke: (s, a) => s.getPipelineStage(getPipelineStageSchema.parse(a)),
  },
  {
    name: `${FOLLOW_UP_BOSS_NAMESPACE}.list_users`,
    description:
      'List FUB account users (the brokerage roster). activeOnly defaults true. limit is 1..100 (default 25).',
    schema: listUsersSchema,
    invoke: (s, a) => s.listUsers(listUsersSchema.parse(a)),
  },
  {
    name: `${FOLLOW_UP_BOSS_NAMESPACE}.list_lead_lists`,
    description: 'List FUB lead-lists (drip-campaign equivalents). limit is 1..100 (default 25).',
    schema: listLeadListsSchema,
    invoke: (s, a) => s.listLeadLists(listLeadListsSchema.parse(a)),
  },
  {
    name: `${FOLLOW_UP_BOSS_NAMESPACE}.create_lead`,
    description:
      'Create a new lead (person) in FUB. Provide name or firstName/lastName, plus optional email/phone/source. Approval-gated.',
    schema: createLeadSchema,
    invoke: (s, a) => s.createLead(createLeadSchema.parse(a)),
  },
  {
    name: `${FOLLOW_UP_BOSS_NAMESPACE}.send_text_template`,
    description:
      'Send a templated SMS to a lead (personId + templateId, optional message). OUTBOUND — approval-gated.',
    schema: sendTextTemplateSchema,
    invoke: (s, a) => s.sendTextTemplate(sendTextTemplateSchema.parse(a)),
  },
  {
    name: `${FOLLOW_UP_BOSS_NAMESPACE}.schedule_action_plan`,
    description:
      'Apply / assign an action plan to a person (personId + actionPlanId). Approval-gated.',
    schema: scheduleActionPlanSchema,
    invoke: (s, a) => s.scheduleActionPlan(scheduleActionPlanSchema.parse(a)),
  },
];
