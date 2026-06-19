import Link from "next/link";
import { requireWorkspaceMember } from "@/lib/auth";
import { withRls } from "@/lib/db";
import { servicePartnerForWorkspace } from "@/lib/onboarding/service-partner";
import { killerWorkflowStoryFor } from "@/lib/workflows/verticals";
import { DemoModePanel } from "@/components/workspace/DemoModePanel";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// "Try with sample data" — the killer-workflow DEMO, now VISIBLY RUNNING. A
// brand-new workspace in degraded/empty mode otherwise sees a void: nothing
// connected, nothing in. This page lets the owner WATCH their vertical's killer
// workflow run, step by step, on obviously-synthetic data — with a saved-time
// counter ticking as each step lands — then connect the one tool that makes it
// real. Deterministic + LLM-free, so it proves value even while the model is
// paused. Story built by lib/workflows/verticals/* over lib/demo/synthetic/*.
export default async function WorkflowDemoPage({ params }: PageProps) {
  const { id: workspaceId } = await params;
  const member = await requireWorkspaceMember(workspaceId, ["BROKER_OWNER"]);
  const ctx = { userId: member.userId, workspaceId, isOperator: false };
  const partner = servicePartnerForWorkspace(workspaceId);
  const base = `/app/workspace/${workspaceId}`;

  const workspaceRow = await withRls(ctx, (tx) =>
    tx.workspace.findUnique({
      where: { id: workspaceId },
      select: { vertical: true },
    }),
  );
  const story = killerWorkflowStoryFor(workspaceRow?.vertical ?? null);

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href={`${base}/connections`}
        className="rounded-none font-mono text-[11px] tracking-eyebrow uppercase text-mute underline-offset-4 hover:text-ink hover:underline"
      >
        ← connections
      </Link>

      <div className="mt-4">
        <DemoModePanel
          story={story}
          workspaceId={workspaceId}
          partner={partner}
          variant="page"
        />
      </div>

      <p className="mt-6 text-[13px] leading-relaxed text-mute">
        Want something else first? Ask {partner} in the Plaino tab — it will
        tell you exactly which tool unlocks the most for your business.
      </p>
    </div>
  );
}
