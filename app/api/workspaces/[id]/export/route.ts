/**
 * GET /api/workspaces/[id]/export
 *
 * Customer-initiated data export. Returns the full workspace artifact as a
 * downloadable JSON file. Membership is enforced via
 * `requireWorkspaceMember(BROKER_OWNER)`; row scoping is enforced both at
 * the SQL layer (RLS GUC set by withRls) and at the application layer
 * (per-row `where: { workspaceId }` clauses inside `buildWorkspaceExport`).
 *
 * V1 is synchronous — see `lib/customer-data/export.ts` for the sync-vs-
 * async rationale and the switchover threshold.
 *
 * Why GET-with-attachment instead of a server-action JSON response:
 * server actions can't set `Content-Disposition: attachment` on the
 * response back to the browser, so the file would render in the page
 * instead of downloading. A regular API route delivers the download
 * natively — same pattern Stripe uses for invoice PDFs.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireWorkspaceMember } from '@/lib/auth';
import { buildWorkspaceExport } from '@/lib/customer-data';
import { getLogger } from '@/lib/observability';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ParamsSchema = z.object({
  id: z.string().uuid(),
});

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(
  _req: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  const params = ParamsSchema.safeParse(await context.params);
  if (!params.success) {
    return NextResponse.json(
      { error: 'invalid workspace id' },
      { status: 400 },
    );
  }
  const workspaceId = params.data.id;

  // Membership + role gate. requireWorkspaceMember redirects on miss.
  const member = await requireWorkspaceMember(workspaceId, ['BROKER_OWNER']);

  const logger = getLogger().child({
    boundary: 'api',
    route: 'workspaces/[id]/export',
    workspace_id: workspaceId,
    user_id: member.userId,
  });

  let artifact;
  try {
    artifact = await buildWorkspaceExport({
      workspaceId,
      requestedByUserId: member.userId,
      rls: {
        userId: member.userId,
        workspaceId,
        isOperator: false,
      },
    });
  } catch (err) {
    logger.error('workspace export failed', err, { workspace_id: workspaceId });
    return NextResponse.json({ error: 'export failed' }, { status: 500 });
  }

  logger.info('workspace export delivered', {
    workspace_id: workspaceId,
    knowledge_documents: artifact.knowledgeDocuments.length,
    work_approvals: artifact.workApprovals.length,
    handoffs: artifact.handoffs.length,
    integrations: artifact.integrations.length,
    audit_log: artifact.auditLog.length,
    truncated: artifact.metadata.truncated.length,
  });

  const body = JSON.stringify(artifact, null, 2);
  const filename = `agentplain-workspace-${artifact.workspace.slug}-${stampForFilename(artifact.metadata.generatedAt)}.json`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'no-store, no-cache, must-revalidate, private',
    },
  });
}

function stampForFilename(iso: string): string {
  // 2026-05-27T14:31:09.123Z → 2026-05-27-1431
  return iso.slice(0, 16).replace(/[:T]/g, '-');
}
