/**
 * lib/integrations/kvcore-mcp/tools.ts
 *
 * The kvCORE tool registry — zod arg schemas + descriptions + wiring to the
 * `KvcoreMcpServer` interface. Shared by the HTTP route
 * (`app/api/integrations/kvcore-mcp/[workspaceId]/route.ts`) and the smoke test
 * via `lib/integrations/mcp-core/dispatch.ts`.
 *
 * Per `project_no_outbound_architecture.md`: the create/send/log tools are
 * MUTATING — the server gates each behind approval before kvCORE is ever
 * called. `list_leads` is read-only.
 */

import { z } from 'zod';
import type { ToolRegistration } from '@/lib/integrations/mcp-core';
import { KVCORE_NAMESPACE, type KvcoreMcpServer } from './types';

const listLeadsSchema = z.object({
  query: z.string().optional(),
  limit: z.number().int().positive().max(100).optional(),
});

const createLeadSchema = z.object({
  name: z.string().min(1),
  email: z.string().optional(),
  phone: z.string().optional(),
  source: z.string().optional(),
  pendingApprovalId: z.string().optional(),
});

const sendMassMessageSchema = z.object({
  leadIds: z.array(z.string().min(1)).min(1),
  message: z.string().min(1),
  pendingApprovalId: z.string().optional(),
});

const logActivitySchema = z.object({
  leadId: z.string().min(1),
  note: z.string().min(1),
  pendingApprovalId: z.string().optional(),
});

export const KVCORE_TOOLS: ReadonlyArray<ToolRegistration<KvcoreMcpServer>> = [
  {
    name: `${KVCORE_NAMESPACE}.list_leads`,
    description:
      'List leads, optionally filtered by free-text query (name / email). limit is 1..100 (default 25). Read-only.',
    schema: listLeadsSchema,
    invoke: (s, a) => s.listLeads(listLeadsSchema.parse(a)),
  },
  {
    name: `${KVCORE_NAMESPACE}.create_lead`,
    description:
      'Capture a new lead. MUTATING — requires human approval via /approvals before it runs.',
    schema: createLeadSchema,
    invoke: (s, a) => s.createLead(createLeadSchema.parse(a)),
  },
  {
    name: `${KVCORE_NAMESPACE}.send_mass_message`,
    description:
      'Queue a mass message to one or more leads through kvCORE. MUTATING + outbound — requires human approval before it runs.',
    schema: sendMassMessageSchema,
    invoke: (s, a) => s.sendMassMessage(sendMassMessageSchema.parse(a)),
  },
  {
    name: `${KVCORE_NAMESPACE}.log_activity`,
    description:
      'Log an activity (note) against a lead. MUTATING — requires human approval before it runs.',
    schema: logActivitySchema,
    invoke: (s, a) => s.logActivity(logActivitySchema.parse(a)),
  },
];
