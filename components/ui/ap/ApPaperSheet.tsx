"use client";

import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";
import { ApEyebrow } from "./ApEyebrow";

// Right-side slide-over for inspecting a single draft, integration, agent
// profile. 480px wide on desktop, full-width on mobile. Paper background,
// hairline border-left, no shadow. Animation: 180ms ease-out translate-x.
// Per design language §3.4.

interface ApPaperSheetProps {
  open: boolean;
  onClose: () => void;
  /** Mono eyebrow ("draft reply", "integration"). */
  eyebrow?: ReactNode;
  /** Display title — the subject of the inspection. */
  title: ReactNode;
  children: ReactNode;
  /** Sheet width in pixels; defaults to 480. Applies to the `right` anchor. */
  widthPx?: number;
  /**
   * Where the sheet docks.
   *   "right"         — desktop-style slide-over from the right (default).
   *   "bottom-mobile" — docks to the BOTTOM on phones (the native bottom-sheet
   *                     pattern) and to the right on `md+`. Use for surfaces
   *                     an owner reaches one-handed on a phone (the approval
   *                     detail). One thumb, big targets, no reach to the top.
   */
  anchor?: "right" | "bottom-mobile";
  /** Optional sticky action footer pinned to the bottom of the sheet — stays
   *  in reach as the body scrolls (e.g. the big approve button). */
  footer?: ReactNode;
}

/**
 * @example
 * const [openId, setOpenId] = useState<string | null>(null);
 * <ApPaperSheet
 *   open={openId === draft.id}
 *   onClose={() => setOpenId(null)}
 *   eyebrow="draft reply"
 *   title="Re: Showing at 142 Peachtree"
 * >
 *   <p>Hi Sarah — Tuesday 10:30 works on our side. I'll confirm…</p>
 * </ApPaperSheet>
 */
export function ApPaperSheet({
  open,
  onClose,
  eyebrow,
  title,
  children,
  widthPx = 480,
  anchor = "right",
  footer,
}: ApPaperSheetProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prevActive = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
      if (e.key === "Tab") {
        const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (!focusable || focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("keydown", handleKey);
      document.body.style.overflow = prevOverflow;
      prevActive?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  const bottom = anchor === "bottom-mobile";

  // Right anchor: full-height slide-over capped at widthPx.
  // Bottom-mobile: docks to the bottom on phones (max 88vh, slides up), then
  // becomes the right slide-over from md up.
  const panelClass = bottom
    ? "ap-sheet-bottom absolute inset-x-0 bottom-0 flex max-h-[88vh] w-full flex-col border-t border-rule bg-paper md:inset-x-auto md:bottom-auto md:right-0 md:top-0 md:h-full md:max-h-none md:w-full md:max-w-[480px] md:border-l md:border-t-0"
    : "ap-paper-sheet-in absolute right-0 top-0 flex h-full flex-col border-l border-rule bg-paper";
  const panelStyle = bottom
    ? undefined
    : { width: "100%", maxWidth: `${widthPx}px` };

  return (
    <div className="fixed inset-0 z-50" role="presentation" onClick={onClose}>
      <div className="absolute inset-0 bg-ink/40" aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        style={panelStyle}
        className={panelClass}
      >
        {bottom ? (
          // Grab-handle affordance — phones only. Signals "drag/swipe me".
          <div className="flex justify-center pt-2 md:hidden" aria-hidden>
            <span className="h-1 w-10 rounded-full bg-rule" />
          </div>
        ) : null}
        <div className="flex items-start justify-between gap-4 border-b border-rule px-6 py-5">
          <div className="min-w-0">
            {eyebrow ? <ApEyebrow className="mb-1">{eyebrow}</ApEyebrow> : null}
            <h2
              id={titleId}
              className="font-display text-xl leading-snug text-ink md:text-2xl"
            >
              {title}
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="close panel"
            className="-mr-2 -mt-1 rounded-none border border-transparent p-3 font-mono text-[18px] leading-none text-mute transition hover:border-rule hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
          >
            ×
          </button>
        </div>
        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6 md:space-y-8">
          {children}
        </div>
        {footer ? (
          <div className="border-t border-rule bg-paper px-6 py-4">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}
