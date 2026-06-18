"use client";

/**
 * components/workspace/SavedTimeCounter.tsx
 *
 * The saved-time counter — "Plaino drafted 3 first touches · saved 27 minutes
 * today". It ticks up as the killer-workflow runtime completes each step: the
 * parent feeds new `actions` / `savedMinutes` values and the counter tweens to
 * them, so the owner WATCHES the value accrue rather than seeing a static
 * number.
 *
 * All the math + copy lives in `lib/workflows/counter.ts` (pure, unit-tested);
 * this is a thin animated shell. The animated number tween respects
 * `prefers-reduced-motion` — it snaps to the value when motion is reduced, and
 * the full text is always present, so the figure is never animation-dependent
 * (the locked additive/accessible rule).
 */

import { useEffect, useRef, useState } from "react";
import { PlainoStatus } from "@/components/ui/ap";
import { formatSavedTime } from "@/lib/workflows/counter";

export interface SavedTimeCounterProps {
  /** Actions completed so far (batch steps count each item). */
  actions: number;
  /** Saved minutes accrued so far. */
  savedMinutes: number;
  /** Dominant verb for the line ("drafted", "chased"). */
  verb: string;
  /** Object of that verb ("replies", "requests"). */
  noun: string;
  /** Live pose: working while the run is in flight, sitting when done/idle. */
  running?: boolean;
  className?: string;
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);
  return reduced;
}

/** Tween a number toward `target` over ~500ms; snaps when motion is reduced. */
function useTweenedNumber(target: number, reduced: boolean): number {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (reduced) {
      setValue(target);
      fromRef.current = target;
      return;
    }
    const from = fromRef.current;
    if (from === target) return;
    const start = performance.now();
    const duration = 480;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(from + (target - from) * eased);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      fromRef.current = target;
    };
  }, [target, reduced]);

  return value;
}

export function SavedTimeCounter({
  actions,
  savedMinutes,
  verb,
  noun,
  running = false,
  className = "",
}: SavedTimeCounterProps) {
  const reduced = usePrefersReducedMotion();
  const shownActions = Math.round(useTweenedNumber(actions, reduced));
  const shownMinutes = Math.round(useTweenedNumber(savedMinutes, reduced));
  const nounLabel = shownActions === 1 ? singular(noun) : noun;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-center gap-3 border border-ink bg-paper-deep px-4 py-3 ${className}`}
    >
      <PlainoStatus
        state={running ? "fetch" : "sit"}
        size={28}
        className="shrink-0"
      />
      <p className="text-[15px] leading-tight text-ink">
        <span className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
          today
        </span>{" "}
        Plaino {verb}{" "}
        <span className="font-display text-ink tabular-nums">
          {shownActions}
        </span>{" "}
        {nounLabel}
        <span className="mx-1 text-mute" aria-hidden>
          ·
        </span>
        saved{" "}
        <span className="font-display text-ink tabular-nums">
          {formatSavedTime(shownMinutes)}
        </span>
      </p>
    </div>
  );
}

function singular(noun: string): string {
  if (noun === "replies") return "reply";
  if (noun === "first touches") return "first touch";
  if (noun.endsWith("s")) return noun.slice(0, -1);
  return noun;
}
