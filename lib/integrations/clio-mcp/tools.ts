/**
 * lib/integrations/clio-mcp/tools.ts
 *
 * The Clio tool registry — zod arg schemas + descriptions + wiring to the
 * `ClioMcpServer` interface. Shared by the HTTP route
 * (`app/api/integrations/clio-mcp/[workspaceId]/route.ts`) and the smoke test
 * via `lib/integrations/mcp-core/dispatch.ts`.
 *
 * Per `project_no_outbound_architecture.md`: the four create/log/bill/send
 * tools are MUTATING — the server gates each behind approval before Clio is
 * ever called. `list_matters` is read-only.
 */

import { z } from 'zod';
import type { ToolRegistration } from '@/lib/integrations/mcp-core';
import { CLIO_NAMESPACE, type ClioMcpServer } from './types';

const listMattersSchema = z.object({
  query: z.string().optional(),
  status: z.enum(['open', 'pending', 'closed']).optional(),
  limit: z.number().int().positive().max(100).optional(),
});

const createMatterSchema = z.object({
  clientId: z.string().min(1),
  description: z.string().min(1),
  practiceArea: z.string().optional(),
  pendingApprovalId: z.string().optional(),
});

const logTimeSchema = z.object({
  matterId: z.string().min(1),
  minutes: z.number().int().positive(),
  description: z.string().min(1),
  date: z.string().optional(),
  pendingApprovalId: z.string().optional(),
});

const createBillSchema = z.object({
  matterId: z.string().min(1),
  issueDate: z.string().optional(),
  pendingApprovalId: z.string().optional(),
});

const sendSecureMessageSchema = z.object({
  matterId: z.string().min(1),
  recipientContactId: z.string().min(1),
  subject: z.string().min(1),
  body: z.string().min(1),
  pendingApprovalId: z.string().optional(),
});

export const CLIO_TOOLS: ReadonlyArray<ToolRegistration<ClioMcpServer>> = [
  {
    name: `${CLIO_NAMESPACE}.list_matters`,
    description:
      'List matters (cases), optionally filtered by free-text query and/or status. limit is 1..100 (default 25). Read-only.',
    schema: listMattersSchema,
    invoke: (s, a) => s.listMatters(listMattersSchema.parse(a)),
  },
  {
    name: `${CLIO_NAMESPACE}.create_matter`,
    description:
      'Open a new matter for an existing client. MUTATING — requires human approval via /approvals before it runs.',
    schema: createMatterSchema,
    invoke: (s, a) => s.createMatter(createMatterSchema.parse(a)),
  },
  {
    name: `${CLIO_NAMESPACE}.log_time`,
    description:
      'Log a time entry (minutes) against a matter. MUTATING — requires human approval before it runs.',
    schema: logTimeSchema,
    invoke: (s, a) => s.logTime(logTimeSchema.parse(a)),
  },
  {
    name: `${CLIO_NAMESPACE}.create_bill`,
    description:
      'Raise a bill for a matter. MUTATING — requires human approval before it runs.',
    schema: createBillSchema,
    invoke: (s, a) => s.createBill(createBillSchema.parse(a)),
  },
  {
    name: `${CLIO_NAMESPACE}.send_secure_message`,
    description:
      'Send a secure message to a client on a matter through Clio. MUTATING + outbound — requires human approval before it runs.',
    schema: sendSecureMessageSchema,
    invoke: (s, a) => s.sendSecureMessage(sendSecureMessageSchema.parse(a)),
  },
];
