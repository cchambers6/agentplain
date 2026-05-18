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
  /** Sheet width in pixels; defaults to 480. */
  widthPx?: number;
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

  return (
    <div className="fixed inset-0 z-50" role="presentation" onClick={onClose}>
      <div className="absolute inset-0 bg-ink/40" aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: `${widthPx}px` }}
        className="ap-paper-sheet-in absolute right-0 top-0 flex h-full flex-col border-l border-rule bg-paper"
      >
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
            className="rounded-none border border-transparent p-2 font-mono text-[18px] leading-none text-mute transition hover:border-rule hover:text-ink"
          >
            ×
          </button>
        </div>
        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6 md:space-y-8">
          {children}
        </div>
      </div>
    </div>
  );
}
