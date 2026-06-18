"use client";

/**
 * components/guarantee/TimeSavingsCounter.tsx
 *
 * The live time-savings ticker on the workspace overview. Reads the
 * server-computed week + all-time minutes saved (from the TimeSavingsEntry
 * ledger) and renders them with a count-up animation, refreshing in the
 * background so the number ticks as the fleet works.
 *
 * The figures are TRUE — every minute traces to a recorded action valued
 * by lib/guarantee/savings-calibration.ts. The animation is presentation
 * only; it counts up to the real value, never past it. SSR / no-JS renders
 * the real numbers directly (the animation is progressive enhancement), so
 * the counter is honest even with scripting off.
 */

import { useEffect, useRef, useState } from "react";
import { ApPaperCard } from "@/components/ui/ap";
import { formatMinutes } from "@/lib/guarantee/evaluation";

export interface TimeSavingsCounterProps {
  /** Minutes saved in the trailing 7 days. */
  weekMinutes: number;
  /** All-time minutes saved. */
  totalMinutes: number;
  /** Service-partner name (e.g. "Plaino"). */
  partner: string;
}

export function TimeSavingsCounter({
  weekMinutes,
  totalMinutes,
  partner,
}: TimeSavingsCounterProps) {
  const week = useCountUp(weekMinutes);
  const total = useCountUp(totalMinutes);

  if (totalMinutes <= 0) {
    return (
      <ApPaperCard eyebrow="time saved">
        <p className="text-[15px] leading-relaxed text-ink-soft">
          {partner} hasn&rsquo;t logged time saved yet. As the fleet drafts,
          schedules, and chases on your behalf, the minutes it gives you back
          add up here.
        </p>
      </ApPaperCard>
    );
  }

  return (
    <ApPaperCard eyebrow="time saved">
      <p className="text-[15px] leading-relaxed text-ink-soft">
        {partner} saved you{" "}
        <span className="font-display text-2xl text-ink tabular-nums">
          {formatMinutes(week)}
        </span>{" "}
        this week.
      </p>
      <div className="mt-4 flex items-baseline justify-between border-t border-rule pt-3">
        <span className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
          all time
        </span>
        <span className="font-display text-xl text-ink tabular-nums">
          {formatMinutes(total)}
        </span>
      </div>
      <p className="mt-3 text-[12px] leading-relaxed text-mute">
        Every minute is a real action the fleet completed for you — a draft, a
        scheduled meeting, a chased document.
      </p>
    </ApPaperCard>
  );
}

/**
 * Count up to `target` over ~900ms. Initializes AT the target so SSR /
 * first paint shows the real number; the animation only runs client-side
 * after mount (and only when the value is positive and changes).
 */
function useCountUp(target: number): number {
  const [value, setValue] = useState(target);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || target <= 0) {
      setValue(target);
      return;
    }
    const durationMs = 900;
    const start = performance.now();
    const from = 0;
    const tick = (nowTs: number) => {
      const t = Math.min(1, (nowTs - start) / durationMs);
      // easeOutCubic for a settle-in feel.
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(from + (target - from) * eased));
      if (t < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current != null) cancelAnimationFrame(frame.current);
    };
  }, [target]);

  return value;
}
