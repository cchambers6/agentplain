/**
 * lib/integrations/salesforce-mcp/tools.ts
 *
 * The Salesforce tool registry — zod arg schemas + descriptions + wiring to
 * the `SalesforceMcpServer` interface. Shared by the HTTP route
 * (`app/api/integrations/salesforce-mcp/[workspaceId]/route.ts`) and the smoke
 * test via `lib/integrations/mcp-core/dispatch.ts`.
 *
 * Per `project_no_outbound_architecture.md`: every mutating tool is
 * approval-gated at the factory seam. `send_email_template` is genuinely
 * OUTBOUND; the rest annotate the customer's own org. None fire without a
 * recorded human approval.
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
  pendingApprovalId: z.string().optional(),
});

// ── Write-action-depth schemas (all approval-gated) ────────────────────────

const createOpportunitySchema = z.object({
  name: z.string().min(1),
  stageName: z.string().min(1),
  closeDate: z.string().min(1),
  amount: z.number().optional(),
  accountId: z.string().optional(),
  pendingApprovalId: z.string().optional(),
});

const updateRecordSchema = z.object({
  sobjectType: z.string().min(1),
  recordId: z.string().min(1),
  fields: z.record(z.string(), z.string()),
  pendingApprovalId: z.string().optional(),
});

const sendEmailTemplateSchema = z.object({
  recipientEmail: z.string().min(1),
  templateId: z.string().min(1),
  targetObjectId: z.string().optional(),
  pendingApprovalId: z.string().optional(),
});

const logCallSchema = z.object({
  subject: z.string().min(1),
  description: z.string().optional(),
  whoId: z.string().optional(),
  whatId: z.string().optional(),
  pendingApprovalId: z.string().optional(),
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
      'Create an internal task (subject required; whatId/whoId relate it to a record). Internal CRM annotation. Approval-gated.',
    schema: createTaskSchema,
    invoke: (s, a) => s.createTask(createTaskSchema.parse(a)),
  },
  // ── Write-action-depth tools (approval-gated mutations) ──────────────────
  {
    name: `${SALESFORCE_NAMESPACE}.create_opportunity`,
    description:
      'Create a new Opportunity (name + stageName + closeDate required; amount/accountId optional). Approval-gated.',
    schema: createOpportunitySchema,
    invoke: (s, a) => s.createOpportunity(createOpportunitySchema.parse(a)),
  },
  {
    name: `${SALESFORCE_NAMESPACE}.update_record`,
    description:
      'Update fields on an arbitrary sObject (sobjectType + recordId + fields). Approval-gated.',
    schema: updateRecordSchema,
    invoke: (s, a) => s.updateRecord(updateRecordSchema.parse(a)),
  },
  {
    name: `${SALESFORCE_NAMESPACE}.send_email_template`,
    description:
      'Send a Salesforce template email to a recipient (recipientEmail + templateId; targetObjectId optional). OUTBOUND — approval-gated.',
    schema: sendEmailTemplateSchema,
    invoke: (s, a) => s.sendEmailTemplate(sendEmailTemplateSchema.parse(a)),
  },
  {
    name: `${SALESFORCE_NAMESPACE}.log_call`,
    description:
      'Log a completed call as a Task of Type Call (subject required; whoId/whatId relate it to a record). Approval-gated.',
    schema: logCallSchema,
    invoke: (s, a) => s.logCall(logCallSchema.parse(a)),
  },
];
