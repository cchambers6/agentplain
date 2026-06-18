/**
 * lib/integrations/mcp-core/approval.ts
 *
 * The vendor-neutral approval seam shared by every MCP server whose tool
 * surface includes MUTATING actions (create / update / send / charge).
 *
 * Why this exists (per `project_no_outbound_architecture.md`): agents draft;
 * the customer's own system executes. Anything that writes to — or sends out
 * of — a connected provider (a Clio bill, a kvCORE mass message, an AppFolio
 * tenant charge) must not fire from an autonomous agent run without an
 * explicit, recorded human approval. Read methods pass straight through; every
 * mutating method funnels through `approvalRequired(...)` until an approved,
 * fingerprint-bound grant is supplied.
 *
 * This mirrors the bespoke DocuSign gate (`docusign-mcp/with-approval.ts`,
 * PR #280) but stays generic: the DocuSign gate carries a full Prisma-backed
 * `WorkApprovalQueueItem` store because DocuSign is `available` today. The
 * vertical-MCP scaffolds in this wave are `coming-soon` — no credential, no
 * skill consuming them yet — so their mutating tools short-circuit here with a
 * structured `APPROVAL_REQUIRED`. When a connector flips to `available`,
 * Conner swaps this short-circuit for a real gate (the DocuSign gate is the
 * reference implementation) at the connector's factory seam.
 *
 * Per `feedback_no_silent_vendor_lock.md`: this module never imports a vendor
 * SDK — it speaks only the `McpResult` envelope.
 */

import { mcpError, type McpResult } from './types';

/**
 * Build the structured `APPROVAL_REQUIRED` result a gated mutating tool
 * returns. `reference` carries the pendingApprovalId (the
 * `WorkApprovalQueueItem.id`) once an approval flow exists, so the /approvals
 * surface knows which request needs a human decision. Absent on the scaffold
 * path, where no approval row has been created yet.
 */
export function approvalRequired(
  message: string,
  pendingApprovalId?: string,
): McpResult<never> {
  return mcpError('APPROVAL_REQUIRED', message, { reference: pendingApprovalId });
}

/**
 * Convenience builder for a connector's mutating tool. Produces the canonical
 * "needs approval before it can run" message naming the connector + action,
 * so every scaffold returns a consistent, honest signal.
 *
 *   gateMutation('Clio', 'create a bill')
 *     → APPROVAL_REQUIRED "Clio create a bill requires human approval via
 *        /approvals before it can run. The approval gate + credential land
 *        together — see docs/strategic-build-2026-06-17/TODOS-FOR-CONNER.md."
 */
export function gateMutation(
  connectorName: string,
  actionPhrase: string,
): McpResult<never> {
  return approvalRequired(
    `${connectorName} ${actionPhrase} requires human approval via /approvals before it can run. ` +
      `The approval gate + credential land together — see ` +
      `docs/strategic-build-2026-06-17/TODOS-FOR-CONNER.md.`,
  );
}
