// RLS GUC wrapper.
//
// Postgres RLS policies in prisma/migrations/20260508000000_phase1_init/migration.sql
// gate every workspace-scoped table on three GUCs:
//   * app.user_id      — current user UUID
//   * app.workspace_id — current workspace UUID  ('' for operator queries with no workspace)
//   * app.is_operator  — 'true' or 'false'
//
// We set them per-transaction with set_config(..., true). The `true` flag
// scopes the GUC to the transaction so a leaked connection from the pool
// cannot carry workspace context to the next request.
//
// Per engineering_plan §5.4: Prisma + RLS has known sharp edges. Always wrap
// queries in $transaction with these GUCs set as the first statement.

import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "./prisma";

export interface RlsContext {
  userId: string | null;
  workspaceId: string | null;
  isOperator: boolean;
}

export const SYSTEM_OPERATOR_CONTEXT: RlsContext = {
  userId: null,
  workspaceId: null,
  isOperator: true,
};

const escapeForSetConfig = (raw: string | null): string => raw ?? "";

/**
 * Run a callback within a Postgres transaction whose GUCs are seeded with the
 * caller's RLS context. The callback receives the transactional Prisma client
 * — use it for all queries inside the unit of work.
 *
 * @example
 * const items = await withRls(ctx, (tx) =>
 *   tx.workApprovalQueueItem.findMany({ where: { status: "PENDING" } }),
 * );
 */
export async function withRls<T>(
  ctx: RlsContext,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  options?: { client?: PrismaClient },
): Promise<T> {
  const client = options?.client ?? prisma;
  return client.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SELECT set_config('app.user_id', $1, true), set_config('app.workspace_id', $2, true), set_config('app.is_operator', $3, true)`,
      escapeForSetConfig(ctx.userId),
      escapeForSetConfig(ctx.workspaceId),
      ctx.isOperator ? "true" : "false",
    );
    return fn(tx);
  });
}

/**
 * Convenience helper — run a callback as the operator/system identity. Used by
 * webhook handlers, cron jobs, and the auth flow before a session exists.
 */
export function withSystemContext<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return withRls(SYSTEM_OPERATOR_CONTEXT, fn);
}
