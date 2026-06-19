/**
 * lib/integrations/appfolio-mcp/tools.ts
 *
 * The AppFolio tool registry — zod arg schemas + descriptions + wiring to the
 * `AppfolioMcpServer` interface. Shared by the HTTP route
 * (`app/api/integrations/appfolio-mcp/[workspaceId]/route.ts`) and the smoke
 * test via `lib/integrations/mcp-core/dispatch.ts`.
 *
 * Per `project_no_outbound_architecture.md`: the three create/charge/send tools
 * are MUTATING — the server gates each behind approval before AppFolio is ever
 * called. `list_units` is read-only.
 */

import { z } from 'zod';
import type { ToolRegistration } from '@/lib/integrations/mcp-core';
import { APPFOLIO_NAMESPACE, type AppfolioMcpServer } from './types';

const listUnitsSchema = z.object({
  propertyId: z.string().optional(),
  limit: z.number().int().positive().max(100).optional(),
});

const createWorkOrderSchema = z.object({
  unitId: z.string().min(1),
  description: z.string().min(1),
  priority: z.enum(['low', 'normal', 'high']).optional(),
  pendingApprovalId: z.string().optional(),
});

const chargeTenantSchema = z.object({
  unitId: z.string().min(1),
  amount: z.number().positive(),
  memo: z.string().optional(),
  pendingApprovalId: z.string().optional(),
});

const sendNoticeSchema = z.object({
  unitId: z.string().min(1),
  noticeType: z.string().min(1),
  body: z.string().min(1),
  pendingApprovalId: z.string().optional(),
});

export const APPFOLIO_TOOLS: ReadonlyArray<ToolRegistration<AppfolioMcpServer>> = [
  {
    name: `${APPFOLIO_NAMESPACE}.list_units`,
    description:
      'List units, optionally filtered to a single property. Returns address + occupancy + status. limit is 1..100 (default 25). Read-only.',
    schema: listUnitsSchema,
    invoke: (s, a) => s.listUnits(listUnitsSchema.parse(a)),
  },
  {
    name: `${APPFOLIO_NAMESPACE}.create_work_order`,
    description:
      'Open a maintenance work order against a unit. MUTATING — requires human approval via /approvals before it runs.',
    schema: createWorkOrderSchema,
    invoke: (s, a) => s.createWorkOrder(createWorkOrderSchema.parse(a)),
  },
  {
    name: `${APPFOLIO_NAMESPACE}.charge_tenant`,
    description:
      'Post a charge to a unit/tenant ledger. MUTATING — requires human approval before it runs.',
    schema: chargeTenantSchema,
    invoke: (s, a) => s.chargeTenant(chargeTenantSchema.parse(a)),
  },
  {
    name: `${APPFOLIO_NAMESPACE}.send_notice`,
    description:
      'Serve a notice to a tenant on a unit through AppFolio. MUTATING + outbound — requires human approval before it runs.',
    schema: sendNoticeSchema,
    invoke: (s, a) => s.sendNotice(sendNoticeSchema.parse(a)),
  },
];
