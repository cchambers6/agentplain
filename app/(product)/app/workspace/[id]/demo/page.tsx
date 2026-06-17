import Link from "next/link";
import {
  ApEyebrow,
  ApHeritageButton,
  PlainoStatus,
} from "@/components/ui/ap";
import { requireWorkspaceMember } from "@/lib/auth";
import { withRls } from "@/lib/db";
import { sampleWorkflowFor } from "@/lib/plaino/sample-workflow";
import { servicePartnerForWorkspace } from "@/lib/onboarding/service-partner";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// "Try with sample data" — the killer-workflow DEMO. A brand-new workspace
// in degraded/empty mode otherwise sees a void: nothing connected, nothing
// in. This page lets the owner SEE their vertical's killer workflow run on
// obviously-synthetic data first, then connect the one tool that makes it
// real. Deterministic + LLM-free, so it proves value even while the model
// is paused. Pairs with lib/plaino/sample-workflow.ts (data) +
// lib/plaino/killer-workflow.ts (headline + connect target).
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
  const demo = sampleWorkflowFor(workspaceRow?.vertical ?? null);

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href={`${base}/connections`}
        className="rounded-none font-mono text-[11px] tracking-eyebrow uppercase text-mute underline-offset-4 hover:text-ink hover:underline"
      >
        ← connections
      </Link>

      <header className="mt-4 border-b border-rule pb-6">
        <ApEyebrow className="mb-3">see it run · sample data</ApEyebrow>
        <h1 className="flex items-start gap-3 font-display text-3xl leading-tight text-ink">
          <PlainoStatus state="fetch" size={32} className="mt-1 shrink-0" />
          <span>{demo.headline}.</span>
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
          {demo.scenario} This is {demo.sourceLabel} — made-up names and
          numbers, so you can see the shape before you connect a thing.
        </p>
      </header>

      {/* Sample-data banner — this is never mistaken for the owner's data. */}
      <div
        role="note"
        className="mt-6 border border-clay/40 bg-paper-deep px-4 py-3 font-mono text-[11px] tracking-eyebrow uppercase text-clay"
      >
        sample data · not your real numbers
      </div>

      <ul className="mt-6 divide-y divide-rule border-y border-rule">
        {demo.rows.map((row, i) => (
          <li key={i} className="py-5">
            <p className="text-[13px] leading-relaxed text-mute">
              <span className="font-mono text-[10px] tracking-eyebrow uppercase text-mute">
                Plaino saw
              </span>
              <span className="ml-2 text-ink-soft">{row.trigger}</span>
            </p>
            <p className="mt-2 flex items-start gap-2 text-[15px] leading-relaxed text-ink">
              <span className="mt-1 text-mute" aria-hidden>
                →
              </span>
              <span>{row.drafted}</span>
            </p>
            <p className="mt-1 pl-5 font-mono text-[10px] tracking-eyebrow uppercase text-mute">
              {row.detail}
            </p>
          </li>
        ))}
      </ul>

      <section className="mt-8 border border-ink bg-paper-deep p-5">
        <p className="font-mono text-[11px] tracking-eyebrow uppercase text-clay">
          make it real
        </p>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-ink">
          Connect {demo.connectLabel} and {partner} runs this on your own
          work — every draft lands in your approval queue. Nothing sends until
          you say so.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <ApHeritageButton
            variant="primary"
            withArrow
            href={`${base}/integrations/${demo.connectIntegrationId}`}
          >
            connect {demo.connectLabel}
          </ApHeritageButton>
          <ApHeritageButton variant="secondary" href={`${base}/connections`}>
            see all connections
          </ApHeritageButton>
        </div>
      </section>

      <p className="mt-6 text-[13px] leading-relaxed text-mute">
        Want something else first? Ask {partner} in the Plaino tab — it will
        tell you exactly which tool unlocks the most for your business.
      </p>
    </div>
  );
}
