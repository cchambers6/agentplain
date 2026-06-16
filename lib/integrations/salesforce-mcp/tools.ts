/**
 * lib/integrations/salesforce-mcp/tools.ts
 *
 * The Salesforce tool registry — zod arg schemas + descriptions + wiring to
 * the `SalesforceMcpServer` interface. Shared by the HTTP route
 * (`app/api/integrations/salesforce-mcp/[workspaceId]/route.ts`) and the smoke
 * test via `lib/integrations/mcp-core/dispatch.ts`.
 *
 * Per `project_no_outbound_architecture.md`: the only write tool is
 * `create_task` — an INTERNAL task on the customer's own org. No tool here
 * sends mail, SMS, or anything customer-facing.
 */

import { z } from 'zod';
import type { ToolRegistration } from '@/lib/integrations/mcp-core';
import type { SalesforceMcpServer } from './types';

/** Namespace prefix for Salesforce MCP tools (e.g. `salesforce.list_leads`). */
export const SALESFORCE_NAMESPACE = 'salesforce';

const listLeadsSchema = z.object({
  limit: z.number().int().positive().max(100).optional(),
  modifiedSince: z.string().optional(),
});
const leadIdSchema = z.object({ leadId: z.string().min(1) });

const listOpportunitiesSchema = z.object({
  limit: z.number().int().positive().max(100).optional(),
  accountId: z.string().optional(),
});
const opportunityIdSchema = z.object({ opportunityId: z.string().min(1) });

const listAccountsSchema = z.object({
  limit: z.number().int().positive().max(100).optional(),
});
const accountIdSchema = z.object({ accountId: z.string().min(1) });

const listContactsSchema = z.object({
  limit: z.number().int().positive().max(100).optional(),
  accountId: z.string().optional(),
});

const createTaskSchema = z.object({
  whatId: z.string().optional(),
  whoId: z.string().optional(),
  subject: z.string().min(1),
  description: z.string().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
});

export const SALESFORCE_TOOLS: ReadonlyArray<ToolRegistration<SalesforceMcpServer>> = [
  {
    name: `${SALESFORCE_NAMESPACE}.list_leads`,
    description:
      'List leads. limit is 1..100 (default 25). modifiedSince (ISO) returns only leads changed after that time.',
    schema: listLeadsSchema,
    invoke: (s, a) => s.listLeads(listLeadsSchema.parse(a)),
  },
  {
    name: `${SALESFORCE_NAMESPACE}.get_lead`,
    description: 'Get a single lead by its Salesforce id.',
    schema: leadIdSchema,
    invoke: (s, a) => s.getLead(leadIdSchema.parse(a)),
  },
  {
    name: `${SALESFORCE_NAMESPACE}.list_opportunities`,
    description: 'List opportunities, optionally filtered by accountId. limit is 1..100 (default 25).',
    schema: listOpportunitiesSchema,
    invoke: (s, a) => s.listOpportunities(listOpportunitiesSchema.parse(a)),
  },
  {
    name: `${SALESFORCE_NAMESPACE}.get_opportunity`,
    description: 'Get a single opportunity by its Salesforce id.',
    schema: opportunityIdSchema,
    invoke: (s, a) => s.getOpportunity(opportunityIdSchema.parse(a)),
  },
  {
    name: `${SALESFORCE_NAMESPACE}.list_accounts`,
    description: 'List accounts. limit is 1..100 (default 25).',
    schema: listAccountsSchema,
    invoke: (s, a) => s.listAccounts(listAccountsSchema.parse(a)),
  },
  {
    name: `${SALESFORCE_NAMESPACE}.get_account`,
    description: 'Get a single account by its Salesforce id.',
    schema: accountIdSchema,
    invoke: (s, a) => s.getAccount(accountIdSchema.parse(a)),
  },
  {
    name: `${SALESFORCE_NAMESPACE}.list_contacts`,
    description: 'List contacts, optionally filtered by accountId. limit is 1..100 (default 25).',
    schema: listContactsSchema,
    invoke: (s, a) => s.listContacts(listContactsSchema.parse(a)),
  },
  {
    name: `${SALESFORCE_NAMESPACE}.create_task`,
    description:
      'Create an internal task (subject required; whatId/whoId relate it to a record). Internal CRM annotation — does not send anything outbound.',
    schema: createTaskSchema,
    invoke: (s, a) => s.createTask(createTaskSchema.parse(a)),
  },
];
