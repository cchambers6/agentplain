/**
 * GET /operator/workspaces/[workspaceId]/export
 *
 * Operator-only support snapshot. Returns a downloadable JSON artifact of a
 * workspace's full state for investigation. Two layers:
 *
 *   1. The customer data export (`buildWorkspaceExport`) — the same
 *      row-level artifact the customer can pull, run here under the operator
 *      (system) RLS context so an operator who is NOT a member can still
 *      read it. The per-row `where: { workspaceId }` clauses inside the
 *      builder keep it scoped to this one workspace.
 *   2. An `operatorSnapshot` block — the operational read-outs the deep-dive
 *      page renders (budget, approval-age histogram, integration health,
 *      usage by surface) frozen into the file so a support thread carries
 *      the same numbers the operator saw.
 *
 * GET-with-attachment (not a server action) so the browser downloads the
 * file natively — same rationale as the customer export route.
 *
 * Every export writes an `AuditLog` row (operator.workspace_export).
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/server";
import { withSystemContext } from "@/lib/db/rls";
import { buildWorkspaceExport } from "@/lib/customer-data";
import { getWorkspaceUsageReport } from "@/lib/billing/usage/aggregate";
import { deriveBudgetStatus, resolveBudgetCapUsd } from "@/lib/billing/budget";
import { listIntegrations } from "@/lib/integrations/marketplace";
import {
  buildApprovalQueueSummary,
  deriveIntegrationHealth,
  mapUsageSurfaces,
} from "@/lib/operator/workspace-inspector";
import { buildExportAuditEntry } from "@/lib/operator/impersonation";
import { getLogger } from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ParamsSchema = z.object({ workspaceId: z.string().uuid() });

interface RouteContext {
  params: Promise<{ workspaceId: string }>;
}

function nameByProvider(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const e of listIntegrations()) if (e.providerKey) out[e.providerKey] = e.name;
  return out;
}

// JSON.stringify cannot serialize BigInt (LlmUsageRecord costs). Coerce to a
// string so cost figures survive into the artifact losslessly.
function bigintReplacer(_key: string, value: unknown): unknown {
  return typeof value === "bigint" ? value.toString() : value;
}

export async function GET(
  _req: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  const session = await requireUser();
  if (!session.isOperator) {
    return NextResponse.json({ error: "operator only" }, { status: 403 });
  }

  const parsed = ParamsSchema.safeParse(await context.params);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid workspace id" }, { status: 400 });
  }
  const workspaceId = parsed.data.workspaceId;
  const now = new Date();

  const logger = getLogger().child({
    boundary: "operator",
    route: "operator/workspaces/[workspaceId]/export",
    workspace_id: workspaceId,
    user_id: session.userId,
  });

  // Operational snapshot + audit, under operator RLS.
  const snapshot = await withSystemContext(async (tx) => {
    const workspace = await tx.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, name: true, slug: true, settings: true },
    });
    if (!workspace) return null;

    const [credentials, openApprovals, usage] = await Promise.all([
      tx.integrationCredential.findMany({
        where: { workspaceId },
        select: {
          provider: true,
          accountEmail: true,
          status: true,
          scopes: true,
          expiresAt: true,
          lastRefreshedAt: true,
        },
      }),
      tx.workApprovalQueueItem.findMany({
        where: { workspaceId, status: "PENDING" },
        select: { proposedAt: true },
      }),
      getWorkspaceUsageReport(tx, { workspaceId, periodStart: null, now }),
    ]);

    await tx.auditLog.create({
      data: buildExportAuditEntry({
        operatorUserId: session.userId,
        workspaceId,
        workspaceName: workspace.name,
        workspaceSlug: workspace.slug,
      }),
    });

    const period = usage.period;
    return {
      workspace,
      budget: deriveBudgetStatus({
        workspaceId,
        consumedMicroCents: period.costMicroCents,
        capUsdMonthly: resolveBudgetCapUsd(workspace.settings, null),
        tokensThisPeriod:
          period.inputTokens +
          period.outputTokens +
          period.cacheCreationTokens +
          period.cacheReadTokens,
      }),
      approvals: buildApprovalQueueSummary(openApprovals, now),
      integrations: deriveIntegrationHealth(credentials, nameByProvider(), now),
      usageBySurface: mapUsageSurfaces(usage.periodBySurface),
    };
  });

  if (!snapshot) {
    return NextResponse.json({ error: "workspace not found" }, { status: 404 });
  }

  // Core row-level artifact under operator context. requestedByUserId is the
  // operator; the RLS context uses the operator identity with isOperator so
  // the system-context branch of the RLS policies resolves.
  let artifact;
  try {
    artifact = await buildWorkspaceExport({
      workspaceId,
      requestedByUserId: session.userId,
      rls: { userId: session.userId, workspaceId, isOperator: true },
      now,
    });
  } catch (err) {
    logger.error("operator workspace export failed", err, {
      workspace_id: workspaceId,
    });
    return NextResponse.json({ error: "export failed" }, { status: 500 });
  }

  const out = {
    kind: "operator-workspace-state-snapshot",
    generatedAt: now.toISOString(),
    generatedByOperatorUserId: session.userId,
    operatorSnapshot: snapshot,
    export: artifact,
  };

  logger.info("operator workspace export delivered", {
    workspace_id: workspaceId,
    integrations: snapshot.integrations.length,
    open_approvals: snapshot.approvals.total,
  });

  const stamp = now.toISOString().slice(0, 16).replace(/[:T]/g, "-");
  const filename = `agentplain-opstate-${snapshot.workspace.slug}-${stamp}.json`;

  return new NextResponse(JSON.stringify(out, bigintReplacer, 2), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store, no-cache, must-revalidate, private",
    },
  });
}
