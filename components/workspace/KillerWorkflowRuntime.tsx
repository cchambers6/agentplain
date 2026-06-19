"use client";

/**
 * components/workspace/KillerWorkflowRuntime.tsx
 *
 * The VISIBLE killer-workflow runtime. Given a `WorkflowStory` (built
 * server-side from synthetic data), it plays the story step by step on the
 * workspace: each step moves pending → working → done on its own timer, and the
 * `SavedTimeCounter` ticks up as each step lands. This is the surface that
 * turns a trial into a paying customer — they WATCH Plaino do the one thing
 * their vertical cares about, on obviously-fake data, before connecting a thing.
 *
 * Deterministic + LLM-free by design (the model key has been paused before; the
 * demo must prove value without it). All math is in `lib/workflows/*` (pure,
 * tested); this component only owns timing + presentation.
 *
 * The whole sequence is always readable as static text (every step's label +
 * detail render immediately, statuses are labeled in words) so the value is
 * never animation-dependent — it just animates when it can.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { ApHeritageButton } from "@/components/ui/ap";
import {
  projectStory,
  type WorkflowStory,
  type WorkflowStepStatus,
} from "@/lib/workflows/runtime";
import { SavedTimeCounter } from "./SavedTimeCounter";

export interface KillerWorkflowRuntimeProps {
  story: WorkflowStory;
  /** Start running on mount. Default true. */
  autoPlay?: boolean;
}

export function KillerWorkflowRuntime({
  story,
  autoPlay = true,
}: KillerWorkflowRuntimeProps) {
  const total = story.steps.length;
  const [completed, setCompleted] = useState(0);
  const [playing, setPlaying] = useState(autoPlay);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Advance one step at a time, each on its own runMs, while playing.
  useEffect(() => {
    if (!playing) return;
    if (completed >= total) {
      setPlaying(false);
      return;
    }
    const step = story.steps[completed]!;
    timerRef.current = setTimeout(() => {
      setCompleted((c) => c + 1);
    }, step.runMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [playing, completed, total, story.steps]);

  const replay = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setCompleted(0);
    setPlaying(true);
  }, []);

  const projection = projectStory(story, completed);
  const isComplete = projection.complete;

  return (
    <div className="space-y-6">
      {/* Sample-data banner — never mistaken for the owner's real numbers. */}
      <div
        role="note"
        className="border border-clay/40 bg-paper-deep px-4 py-2 font-mono text-[11px] tracking-eyebrow uppercase text-clay"
      >
        sample data · {story.sourceLabel} · not your real numbers
      </div>

      <p className="text-[15px] leading-relaxed text-ink-soft">{story.trigger}</p>

      <SavedTimeCounter
        actions={projection.actions}
        savedMinutes={projection.savedMinutes}
        verb={story.counterVerb}
        noun={story.counterNoun}
        running={playing && !isComplete}
      />

      <ol className="divide-y divide-rule border-y border-rule">
        {projection.steps.map((step) => (
          <li key={step.id} className="flex gap-4 py-4">
            <StepMarker status={step.status} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p
                  className={`font-display text-base leading-tight ${
                    step.status === "pending" ? "text-mute" : "text-ink"
                  }`}
                >
                  {step.label}
                </p>
                <StatusChip status={step.status} savedMinutes={step.savedMinutes} />
              </div>
              <p
                className={`mt-1 text-[13px] leading-relaxed ${
                  step.status === "pending" ? "text-mute" : "text-ink-soft"
                }`}
              >
                {step.detail}
              </p>
            </div>
          </li>
        ))}
      </ol>

      {isComplete ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-[13px] leading-relaxed text-mute">
            That's the whole run — on sample data, in seconds. Nothing was sent;
            every draft would wait for your approve.
          </p>
          <ApHeritageButton variant="secondary" onClick={replay}>
            run it again
          </ApHeritageButton>
        </div>
      ) : null}
    </div>
  );
}

function StepMarker({ status }: { status: WorkflowStepStatus }) {
  if (status === "done") {
    return (
      <span
        aria-hidden
        className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center border border-ink bg-ink text-[11px] text-paper"
      >
        ✓
      </span>
    );
  }
  if (status === "running") {
    return (
      <span
        aria-hidden
        className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center border border-clay"
      >
        <span className="h-2 w-2 animate-pulse rounded-full bg-clay" />
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className="mt-1 h-5 w-5 shrink-0 border border-rule"
    />
  );
}

function StatusChip({
  status,
  savedMinutes,
}: {
  status: WorkflowStepStatus;
  savedMinutes: number;
}) {
  if (status === "done") {
    return (
      <span className="font-mono text-[10px] tracking-eyebrow uppercase text-mute">
        +{savedMinutes} min saved
      </span>
    );
  }
  if (status === "running") {
    return (
      <span className="font-mono text-[10px] tracking-eyebrow uppercase text-clay">
        working
      </span>
    );
  }
  return (
    <span className="font-mono text-[10px] tracking-eyebrow uppercase text-mute/60">
      queued
    </span>
  );
}
