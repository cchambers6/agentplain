/**
 * lib/operator/impersonation.ts
 *
 * The read-only "view as the customer" seam for the operator deep-dive.
 *
 * Design — why this is read-only by construction, not by convention:
 *   The customer workspace surfaces (`/app/workspace/[id]/*`) gate every
 *   read AND every write on `requireWorkspaceMember`, which redirects any
 *   non-member — operators included. We do NOT loosen that gate. Instead,
 *   the impersonation view lives under `/operator/...`, renders the
 *   customer's OWN view component with operator (system) RLS reads, and
 *   wires NO server actions. There is therefore no code path by which an
 *   impersonating operator can mutate customer state: the customer's
 *   actions are unreachable from the operator route, and the operator has
 *   no membership to satisfy `requireWorkspaceMember` even if one were.
 *
 * Every entry into the view writes an `AuditLog` row (`actingAsUserId` is
 * reserved on the schema for a future true act-as; today the operator views
 * the workspace, not a specific user, so we record the workspace target).
 *
 * The guard (`assertOperatorAccess`) and the audit-entry builder are pure so
 * the impersonation contract is unit-testable without a session or a DB.
 */

import type { Prisma } from '@prisma/client';

export class OperatorAccessError extends Error {
  constructor(message = 'Forbidden — operator only.') {
    super(message);
    this.name = 'OperatorAccessError';
  }
}

/** Throw unless the session is an operator. Mirrors the inline
 *  `if (!session.isOperator) throw` pattern in the existing operator
 *  actions, extracted so it can be asserted in a test. */
export function assertOperatorAccess(
  session: { isOperator?: boolean } | null | undefined,
): void {
  if (!session || session.isOperator !== true) {
    throw new OperatorAccessError();
  }
}

export const IMPERSONATION_AUDIT_ACTION = 'operator.workspace_impersonate';
export const EXPORT_AUDIT_ACTION = 'operator.workspace_export';

export interface OperatorWorkspaceAuditInput {
  operatorUserId: string;
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
}

/** Build the AuditLog create payload for an operator entering the read-only
 *  impersonation view. Pure — the route passes the result straight to
 *  `tx.auditLog.create({ data })`. */
export function buildImpersonationAuditEntry(
  input: OperatorWorkspaceAuditInput,
): Prisma.AuditLogUncheckedCreateInput {
  return {
    actorUserId: input.operatorUserId,
    workspaceId: input.workspaceId,
    action: IMPERSONATION_AUDIT_ACTION,
    targetTable: 'Workspace',
    targetId: input.workspaceId,
    payload: {
      mode: 'read-only',
      workspaceName: input.workspaceName,
      workspaceSlug: input.workspaceSlug,
    } satisfies Prisma.InputJsonValue,
  };
}

/** Build the AuditLog create payload for an operator exporting a workspace
 *  state snapshot for support investigation. Pure. */
export function buildExportAuditEntry(
  input: OperatorWorkspaceAuditInput,
): Prisma.AuditLogUncheckedCreateInput {
  return {
    actorUserId: input.operatorUserId,
    workspaceId: input.workspaceId,
    action: EXPORT_AUDIT_ACTION,
    targetTable: 'Workspace',
    targetId: input.workspaceId,
    payload: {
      workspaceName: input.workspaceName,
      workspaceSlug: input.workspaceSlug,
    } satisfies Prisma.InputJsonValue,
  };
}
