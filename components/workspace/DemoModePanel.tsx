"use client";

/**
 * components/workspace/DemoModePanel.tsx
 *
 * The host that wraps the visible killer-workflow runtime with everything
 * around it: the headline promise, the live run, the trial-value projection
 * (the "day 7" evaluation moment), and the single connect CTA that makes it
 * real. This is what a brand-new trial workspace sees in DEMO MODE — on the
 * Today view and on the standalone /demo page.
 *
 * The arc is deliberate (everything tells a story): promise → watch it run →
 * here's what this adds up to over your trial → connect the one tool. The
 * projection is conservative and always labeled an estimate on sample data
 * (the no-fabricated-hours rule).
 */

import {
  ApEyebrow,
  ApHeritageButton,
  PlainoStatus,
} from "@/components/ui/ap";
import {
  formatSavedTime,
  projectTrialValue,
  storyCounter,
} from "@/lib/workflows/counter";
import type { WorkflowStory } from "@/lib/workflows/runtime";
import { KillerWorkflowRuntime } from "./KillerWorkflowRuntime";

export interface DemoModePanelProps {
  story: WorkflowStory;
  workspaceId: string;
  /** Service-partner name ("Plaino" or the assigned partner). */
  partner: string;
  /** "today" = compact, embedded in the overview. "page" = full standalone. */
  variant?: "today" | "page";
}

export function DemoModePanel({
  story,
  workspaceId,
  partner,
  variant = "today",
}: DemoModePanelProps) {
  const base = `/app/workspace/${workspaceId}`;
  const { savedMinutes } = storyCounter(story);
  const projection = projectTrialValue({
    perRunMinutes: savedMinutes,
    runsPerTrial: story.runsPerTrial,
  });

  return (
    <section className="border border-ink bg-paper p-5 md:p-6">
      <header className="border-b border-rule pb-5">
        <ApEyebrow className="mb-3">see it run · sample data</ApEyebrow>
        <h2 className="flex items-start gap-3 font-display text-2xl leading-tight text-ink md:text-3xl">
          <PlainoStatus state="herd" size={30} className="mt-1 shrink-0" />
          <span>{story.headline}.</span>
        </h2>
        <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-ink-soft">
          Nothing's connected yet, so {partner} is running this on made-up names
          and numbers — watch it work, then connect the one tool that makes it
          your work.
        </p>
      </header>

      <div className="mt-6">
        <KillerWorkflowRuntime story={story} autoPlay />
      </div>

      {/* Trial-value projection — the "day 7" evaluation moment. */}
      <div className="mt-6 border border-rule bg-paper-deep p-5">
        <p className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
          what this adds up to
        </p>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-ink">
          One run like this saves about{" "}
          {formatSavedTime(projection.perRunMinutes)}. At a steady pace that's{" "}
          {projection.label} — and on day 7 we'll show you the real tally from
          your own work.
        </p>
        <p className="mt-2 text-[12px] leading-relaxed text-mute">
          An estimate on sample data, from calibrated per-task minutes — not a
          promise. Your real numbers replace it the moment you connect a tool.
        </p>
      </div>

      {/* Make it real — the single connect CTA. */}
      <div className="mt-6 border border-ink bg-paper-deep p-5">
        <p className="font-mono text-[11px] tracking-eyebrow uppercase text-clay">
          make it real
        </p>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-ink">
          {story.connectWhy
            ? `Connect ${story.connectLabel} — ${story.connectWhy}.`
            : `Connect ${story.connectLabel} and ${partner} runs this on your own work.`}{" "}
          Every draft lands in your approval queue. Nothing sends until you say
          so.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <ApHeritageButton
            variant="primary"
            withArrow
            href={`${base}/integrations/${story.connectIntegrationId}`}
          >
            connect {story.connectLabel}
          </ApHeritageButton>
          {variant === "today" ? (
            <ApHeritageButton variant="secondary" withArrow href={`${base}/demo`}>
              see the full run
            </ApHeritageButton>
          ) : (
            <ApHeritageButton variant="secondary" href={`${base}/connections`}>
              see all connections
            </ApHeritageButton>
          )}
        </div>
      </div>
    </section>
  );
}
