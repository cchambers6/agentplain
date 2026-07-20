"use client";

/**
 * components/vertical/KillerWorkflowPlayer.tsx
 *
 * Marketing-page wrapper around the in-product `KillerWorkflowRuntime`. The
 * runtime starts playing on mount; on a long vertical landing page that would
 * fire while the demo is still below the fold, so this wrapper holds it idle
 * (every step readable as static text) and remounts it with autoplay the
 * first time it scrolls into view. One-shot: once started it never resets on
 * further scrolling; the runtime's own replay button handles re-runs.
 *
 * No new demo logic lives here — story data, saved-minute math, and the
 * player all come from the same modules the product surface uses, so the
 * marketing demo can never drift from what a trial workspace actually plays.
 */

import { useEffect, useRef, useState } from "react";
import { KillerWorkflowRuntime } from "@/components/workspace/KillerWorkflowRuntime";
import type { WorkflowStory } from "@/lib/workflows/runtime";

export default function KillerWorkflowPlayer({
  story,
}: {
  story: WorkflowStory;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Environments without IntersectionObserver (old browsers, some crawlers)
    // just start immediately — the sequence is readable as text either way.
    if (typeof IntersectionObserver === "undefined") {
      setStarted(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setStarted(true);
          observer.disconnect();
        }
      },
      // Low threshold on purpose: the demo box can be taller than a phone
      // viewport, and an element taller than 1/threshold viewports can never
      // reach its threshold — 0.1 keeps autoplay reachable on small screens.
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref}>
      {/* Remount on start so the runtime's mount-time autoplay kicks in the
          moment the section is actually on screen. */}
      <KillerWorkflowRuntime
        key={started ? "playing" : "idle"}
        story={story}
        autoPlay={started}
      />
    </div>
  );
}
