/**
 * lib/integrations/karbon-mcp/tools.ts
 *
 * The Karbon tool registry — zod arg schemas + descriptions + wiring to
 * the `KarbonMcpServer` interface.
 */

import { z } from 'zod';
import type { ToolRegistration } from '@/lib/integrations/mcp-core';
import { KARBON_NAMESPACE, type KarbonMcpServer } from './types';

const listClientsSchema = z.object({
  count: z.number().int().positive().max(100).optional(),
});
const clientIdSchema = z.object({ clientId: z.string().min(1) });

const listWorkflowsSchema = z.object({
  clientId: z.string().optional(),
  status: z.enum(['active', 'completed', 'archived']).optional(),
  count: z.number().int().positive().max(100).optional(),
});
const workflowIdSchema = z.object({ workflowId: z.string().min(1) });

const listJobsSchema = z.object({
  workflowId: z.string().optional(),
  status: z.enum(['todo', 'in-progress', 'review', 'done', 'blocked']).optional(),
  count: z.number().int().positive().max(100).optional(),
});

const listRecurringSchema = z.object({
  clientId: z.string().optional(),
  count: z.number().int().positive().max(100).optional(),
});

export const KARBON_TOOLS: ReadonlyArray<ToolRegistration<KarbonMcpServer>> = [
  {
    name: `${KARBON_NAMESPACE}.list_clients`,
    description: 'List clients in the firm. count is 1..100 (default 25).',
    schema: listClientsSchema,
    invoke: (s, a) => s.listClients(listClientsSchema.parse(a)),
  },
  {
    name: `${KARBON_NAMESPACE}.get_client`,
    description: 'Get a single client by Karbon contact id.',
    schema: clientIdSchema,
    invoke: (s, a) => s.getClient(clientIdSchema.parse(a)),
  },
  {
    name: `${KARBON_NAMESPACE}.list_workflows`,
    description:
      'List workflows (engagements), optionally filtered by clientId and/or status. count is 1..100 (default 25).',
    schema: listWorkflowsSchema,
    invoke: (s, a) => s.listWorkflows(listWorkflowsSchema.parse(a)),
  },
  {
    name: `${KARBON_NAMESPACE}.get_workflow`,
    description: 'Get a single workflow by Karbon WorkItem id.',
    schema: workflowIdSchema,
    invoke: (s, a) => s.getWorkflow(workflowIdSchema.parse(a)),
  },
  {
    name: `${KARBON_NAMESPACE}.list_jobs`,
    description:
      'List jobs (tasks within a workflow), optionally filtered by workflowId and/or status. count is 1..100 (default 25).',
    schema: listJobsSchema,
    invoke: (s, a) => s.listJobs(listJobsSchema.parse(a)),
  },
  {
    name: `${KARBON_NAMESPACE}.list_recurring_tasks`,
    description:
      'List recurring task templates, optionally filtered by clientId. count is 1..100 (default 25).',
    schema: listRecurringSchema,
    invoke: (s, a) => s.listRecurringTasks(listRecurringSchema.parse(a)),
  },
];
