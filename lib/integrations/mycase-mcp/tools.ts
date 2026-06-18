/**
 * lib/integrations/mycase-mcp/tools.ts
 *
 * The MyCase tool registry — zod arg schemas + descriptions + wiring to the
 * `MyCaseMcpServer` interface. Shared by the HTTP route
 * (`app/api/integrations/mycase-mcp/[workspaceId]/route.ts`) and the smoke test
 * via `lib/integrations/mcp-core/dispatch.ts`.
 *
 * Per `project_no_outbound_architecture.md`: the create/invoice/status tools
 * are MUTATING — the server gates each behind approval before MyCase is ever
 * called. `list_cases` is read-only.
 */

import { z } from 'zod';
import type { ToolRegistration } from '@/lib/integrations/mcp-core';
import { MYCASE_NAMESPACE, type MyCaseMcpServer } from './types';

const listCasesSchema = z.object({
  query: z.string().optional(),
  status: z.enum(['open', 'pending', 'closed']).optional(),
  limit: z.number().int().positive().max(100).optional(),
});

const createCaseSchema = z.object({
  clientId: z.string().min(1),
  name: z.string().min(1),
  practiceArea: z.string().optional(),
  pendingApprovalId: z.string().optional(),
});

const sendInvoiceSchema = z.object({
  caseId: z.string().min(1),
  amount: z.number().optional(),
  pendingApprovalId: z.string().optional(),
});

const updateStatusSchema = z.object({
  caseId: z.string().min(1),
  status: z.enum(['open', 'pending', 'closed']),
  pendingApprovalId: z.string().optional(),
});

export const MYCASE_TOOLS: ReadonlyArray<ToolRegistration<MyCaseMcpServer>> = [
  {
    name: `${MYCASE_NAMESPACE}.list_cases`,
    description:
      'List cases, optionally filtered by free-text query and/or status. limit is 1..100 (default 25). Read-only.',
    schema: listCasesSchema,
    invoke: (s, a) => s.listCases(listCasesSchema.parse(a)),
  },
  {
    name: `${MYCASE_NAMESPACE}.create_case`,
    description:
      'Open a new case for an existing client. MUTATING — requires human approval via /approvals before it runs.',
    schema: createCaseSchema,
    invoke: (s, a) => s.createCase(createCaseSchema.parse(a)),
  },
  {
    name: `${MYCASE_NAMESPACE}.send_invoice`,
    description:
      'Send an invoice for a case to the client. MUTATING — requires human approval before it runs.',
    schema: sendInvoiceSchema,
    invoke: (s, a) => s.sendInvoice(sendInvoiceSchema.parse(a)),
  },
  {
    name: `${MYCASE_NAMESPACE}.update_status`,
    description:
      "Update a case's status (open / pending / closed). MUTATING — requires human approval before it runs.",
    schema: updateStatusSchema,
    invoke: (s, a) => s.updateStatus(updateStatusSchema.parse(a)),
  },
];
