/**
 * lib/integrations/buildium-mcp/tools.ts
 *
 * The Buildium tool registry — zod arg schema + description + wiring to the
 * `BuildiumMcpServer` interface. Shared by the HTTP route
 * (`app/api/integrations/buildium-mcp/[workspaceId]/route.ts`) and the smoke
 * test via `lib/integrations/mcp-core/dispatch.ts`.
 *
 * The server's `healthCheck()` is a connection probe (returns BuildiumHealth,
 * not an McpResult) consumed by the fleet-health cron + the "Test connection"
 * button — it is NOT an MCP tool, so it is intentionally not registered here.
 * The dispatchable surface is `list_delinquent_leases` (read-only).
 */

import { z } from 'zod';
import type { ToolRegistration } from '@/lib/integrations/mcp-core';
import type { BuildiumMcpServer } from './types';

/** Namespace prefix for Buildium MCP tools (e.g. `buildium.list_delinquent_leases`). */
export const BUILDIUM_NAMESPACE = 'buildium';

const listDelinquentLeasesSchema = z.object({
  limit: z.number().int().positive().max(100).optional(),
  asOf: z.string().optional(),
});

// ── Write-action-depth schemas (all approval-gated) ────────────────────────

const createWorkOrderSchema = z.object({
  propertyId: z.string().min(1),
  unitId: z.string().min(1).optional(),
  title: z.string().min(1),
  description: z.string().min(1),
  priority: z.enum(['Low', 'Normal', 'High']).optional(),
  pendingApprovalId: z.string().optional(),
});

const chargeLateFeeSchema = z.object({
  leaseId: z.string().min(1),
  amount: z.number().positive(),
  memo: z.string().optional(),
  pendingApprovalId: z.string().optional(),
});

const postNoticeSchema = z.object({
  leaseId: z.string().min(1),
  subject: z.string().min(1),
  body: z.string().min(1),
  pendingApprovalId: z.string().optional(),
});

const sendTenantMsgSchema = z.object({
  tenantId: z.string().min(1),
  subject: z.string().min(1),
  body: z.string().min(1),
  pendingApprovalId: z.string().optional(),
});

export const BUILDIUM_TOOLS: ReadonlyArray<ToolRegistration<BuildiumMcpServer>> = [
  {
    name: `${BUILDIUM_NAMESPACE}.list_delinquent_leases`,
    description:
      'List delinquent leases (rent roll past-due). limit caps results; asOf (ISO date) sets the as-of date for daysPastDue. Read-only — drafting the tenant chase routes through /approvals.',
    schema: listDelinquentLeasesSchema,
    invoke: (s, a) => s.listDelinquentLeases(listDelinquentLeasesSchema.parse(a)),
  },
  // ── Write-action-depth tools (approval-gated mutations) ──────────────────
  {
    name: `${BUILDIUM_NAMESPACE}.create_work_order`,
    description:
      'Open a maintenance work order on a property (propertyId + title + description; unitId/priority optional). Approval-gated.',
    schema: createWorkOrderSchema,
    invoke: (s, a) => s.createWorkOrder(createWorkOrderSchema.parse(a)),
  },
  {
    name: `${BUILDIUM_NAMESPACE}.charge_late_fee`,
    description:
      'Post a late-fee charge to a lease ledger (leaseId + amount; memo optional). OUTBOUND (money) — approval-gated.',
    schema: chargeLateFeeSchema,
    invoke: (s, a) => s.chargeLateFee(chargeLateFeeSchema.parse(a)),
  },
  {
    name: `${BUILDIUM_NAMESPACE}.post_notice`,
    description:
      'Post a notice against a lease (leaseId + subject + body). Approval-gated.',
    schema: postNoticeSchema,
    invoke: (s, a) => s.postNotice(postNoticeSchema.parse(a)),
  },
  {
    name: `${BUILDIUM_NAMESPACE}.send_tenant_msg`,
    description:
      'Send a message to a tenant (tenantId + subject + body). OUTBOUND — approval-gated.',
    schema: sendTenantMsgSchema,
    invoke: (s, a) => s.sendTenantMsg(sendTenantMsgSchema.parse(a)),
  },
];
