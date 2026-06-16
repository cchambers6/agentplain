"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ApEyebrow, ApHeritageButton, PlainoAvatar } from "@/components/ui/ap";
import {
  WELCOME_TOUR_STEPS,
  type TourStep,
} from "@/lib/onboarding/tour-steps";

// First-run Plaino walkthrough.
//
// Rendered by the workspace layout ONLY while the member has not yet seen it
// (Membership.welcomeTourSeenAt is null). It is a spotlight tour, deliberately
// NOT a blocking modal:
//
//   - The dim layer is pointer-events:none, so the real workspace stays fully
//     usable underneath — the customer can click any tab or dismiss at will.
//     We never gate the product behind the tour.
//   - Each anchored step frames a real nav element by reading its
//     getBoundingClientRect and cutting a "hole" in the dim (box-shadow
//     spread). The popover explains it in Plaino's voice.
//   - If a step's selector matches nothing (renamed tab, or a future mobile
//     collapsed menu), the step gracefully falls back to a centered card —
//     the copy names the tab by label, so it stays true either way.
//
// Persistence: finishing or skipping POSTs to the complete route, which stamps
// welcomeTourSeenAt server-side, so it never re-triggers (survives device
// changes — no localStorage). We also hide optimistically the moment the
// customer acts, before the request resolves.

const COMPLETE_ENDPOINT = "/api/onboarding/welcome-tour/complete";

// Popover sizing + breathing room from the framed element / viewport edges.
const POPOVER_WIDTH = 360;
const GAP = 14; // px between the spotlight hole and the popover
const EDGE = 16; // min px from any viewport edge
const RING = 6; // px the spotlight hole extends past the element on each side

interface WelcomeTourProps {
  workspaceId: string;
  /** Override the step list (tests). Defaults to the canonical tour. */
  steps?: TourStep[];
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function WelcomeTour({ workspaceId, steps = WELCOME_TOUR_STEPS }: WelcomeTourProps) {
  const [mounted, setMounted] = useState(false);
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState(false);
  const [rect, setRect] = useState<Rect | null>(null);

  const cardRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const bodyId = useId();

  const step = steps[index];
  const isFirst = index === 0;
  const isLast = index === steps.length - 1;

  useEffect(() => {
    setMounted(true);
  }, []);

  // Mark seen, then hide. Fire-and-forget with keepalive so an in-flight POST
  // survives a navigation the click may also trigger. Optimistic: we hide
  // immediately regardless of the response — worst case the layout re-renders
  // the tour on a hard reload if the write failed, which is acceptable.
  const complete = useCallback(() => {
    if (done) return;
    setDone(true);
    try {
      void fetch(COMPLETE_ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workspaceId }),
        keepalive: true,
      }).catch(() => {});
    } catch {
      /* network unavailable — the tour still closes for this session */
    }
  }, [done, workspaceId]);

  const next = useCallback(() => {
    setIndex((i) => {
      if (i >= steps.length - 1) {
        complete();
        return i;
      }
      return i + 1;
    });
  }, [steps.length, complete]);

  const back = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  // Measure the framed element for the current step. Centered steps (or a
  // selector that matches nothing) leave rect null → centered card, no hole.
  useLayoutEffect(() => {
    if (!mounted || done) return;
    if (!step || step.placement === "center" || !step.selector) {
      setRect(null);
      return;
    }
    const selector = step.selector;

    let raf = 0;
    const measure = () => {
      const el = document.querySelector(selector) as HTMLElement | null;
      if (!el) {
        setRect(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };

    // Bring the target into view first (the nav scrolls horizontally on
    // narrow viewports), then measure on the next frame so the rect is final.
    const el = document.querySelector(selector) as HTMLElement | null;
    el?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
    raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(measure);
    });

    const onChange = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };
    window.addEventListener("resize", onChange);
    window.addEventListener("scroll", onChange, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onChange);
      window.removeEventListener("scroll", onChange, true);
    };
  }, [mounted, done, step]);

  // Move focus to the primary action when a step appears; ESC skips the tour.
  useEffect(() => {
    if (!mounted || done) return;
    primaryRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        complete();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mounted, done, index, complete]);

  if (!mounted || done || !step) return null;

  // ── Popover placement ──────────────────────────────────────────────────
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(POPOVER_WIDTH, vw - EDGE * 2);

  let cardStyle: React.CSSProperties;
  let centered = true;

  if (rect) {
    centered = false;
    // Prefer below the framed element; flip above if there isn't room.
    const below = rect.top + rect.height + RING + GAP;
    const spaceBelow = vh - (rect.top + rect.height);
    const placeBelow = spaceBelow > 220 || rect.top < vh * 0.4;
    const top = placeBelow
      ? below
      : Math.max(EDGE, rect.top - RING - GAP); // anchored to bottom edge via translateY below
    // Center horizontally on the element, then clamp into the viewport.
    let left = rect.left + rect.width / 2 - width / 2;
    left = Math.max(EDGE, Math.min(left, vw - width - EDGE));
    cardStyle = placeBelow
      ? { position: "fixed", top, left, width }
      : { position: "fixed", top, left, width, transform: "translateY(-100%)" };
  } else {
    cardStyle = {
      position: "fixed",
      top: "50%",
      left: "50%",
      width,
      transform: "translate(-50%, -50%)",
    };
  }

  // The spotlight "hole": a transparent box at the element's rect with a huge
  // box-shadow spread that dims everything else. pointer-events:none so the
  // workspace stays clickable through the dim.
  const holeStyle: React.CSSProperties | null = rect
    ? {
        position: "fixed",
        top: rect.top - RING,
        left: rect.left - RING,
        width: rect.width + RING * 2,
        height: rect.height + RING * 2,
        boxShadow: "0 0 0 9999px rgba(26, 26, 31, 0.45)",
        outline: "2px solid var(--color-clay)",
        outlineOffset: "0px",
        pointerEvents: "none",
        zIndex: 60,
      }
    : null;

  const total = steps.length;

  return createPortal(
    <div data-testid="welcome-tour" aria-live="polite">
      {/* Dim + spotlight. When no element is framed (centered steps / selector
          miss) we still dim the page with a flat scrim so the card reads. */}
      {holeStyle ? (
        <div style={holeStyle} aria-hidden />
      ) : (
        <div
          aria-hidden
          style={{ position: "fixed", inset: 0, zIndex: 60, pointerEvents: "none" }}
          className="bg-ink/40"
        />
      )}

      {/* Popover card */}
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="false"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        style={{ ...cardStyle, zIndex: 61 }}
        className="border border-rule bg-paper p-6 shadow-[0_8px_40px_rgba(26,26,31,0.18)] md:p-7"
      >
        <div className="flex items-start gap-3">
          <PlainoAvatar size="md" pose={isLast ? "sit" : "herd"} />
          <div className="min-w-0">
            <ApEyebrow>{step.eyebrow}</ApEyebrow>
            <h2
              id={titleId}
              className="mt-2 font-display text-xl leading-snug text-ink"
            >
              {step.title}
            </h2>
          </div>
        </div>

        <p
          id={bodyId}
          className="mt-3 text-[15px] leading-relaxed text-ink-soft"
        >
          {step.body}
        </p>

        {/* Progress dots — only across the anchored/centered tour, hidden on
            the welcome gate where the choice is take-vs-skip. */}
        {!isFirst ? (
          <div className="mt-5 flex items-center gap-1.5" aria-hidden>
            {steps.map((s, i) => (
              <span
                key={s.id}
                className={
                  i === index
                    ? "h-1.5 w-1.5 bg-clay"
                    : i < index
                      ? "h-1.5 w-1.5 bg-ink/40"
                      : "h-1.5 w-1.5 bg-rule"
                }
              />
            ))}
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-rule pt-5">
          {isFirst ? (
            <>
              <ApHeritageButton
                ref={primaryRef as React.Ref<HTMLButtonElement>}
                variant="primary"
                withArrow
                type="button"
                onClick={next}
              >
                take the tour
              </ApHeritageButton>
              <button
                type="button"
                onClick={complete}
                className="text-sm text-mute underline-offset-4 hover:text-ink hover:underline focus:outline-none focus-visible:text-ink focus-visible:underline"
              >
                skip tour
              </button>
            </>
          ) : (
            <>
              <ApHeritageButton
                ref={primaryRef as React.Ref<HTMLButtonElement>}
                variant="primary"
                withArrow={!isLast}
                type="button"
                onClick={next}
              >
                {isLast ? "got it" : "next"}
              </ApHeritageButton>
              <button
                type="button"
                onClick={back}
                className="text-sm text-mute underline-offset-4 hover:text-ink hover:underline focus:outline-none focus-visible:text-ink focus-visible:underline"
              >
                back
              </button>
              {!isLast ? (
                <button
                  type="button"
                  onClick={complete}
                  className="ml-auto text-sm text-mute underline-offset-4 hover:text-ink hover:underline focus:outline-none focus-visible:text-ink focus-visible:underline"
                >
                  skip tour
                </button>
              ) : null}
            </>
          )}
        </div>

        <p className="mt-3 font-mono text-[11px] tracking-eyebrow uppercase text-mute">
          {isFirst ? "first run · agentplain" : `step ${index} of ${total - 1}`}
        </p>
      </div>
    </div>,
    document.body,
  );
}
