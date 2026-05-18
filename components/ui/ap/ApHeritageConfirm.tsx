"use client";

import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";
import { ApEyebrow } from "./ApEyebrow";
import { ApHeritageButton } from "./ApHeritageButton";

// Confirmation dialog primitive. Two paragraphs max — first what's about to
// happen, second what becomes true/false after. Buttons: verb-led, lowercase.
// Per design language §3.4 / §1.6.
//
// Variants:
//   - "calm" (default) — primary action uses clay; for affirmative commits
//   - "destructive"    — primary action uses flag outline; for disconnect /
//                        cancel-subscription / reject-all
//
// Backdrop click + ESC dismisses unless `dismissible={false}`.

export type ApHeritageConfirmVariant = "calm" | "destructive";

interface ApHeritageConfirmProps {
  open: boolean;
  onClose: () => void;
  /** Mono eyebrow above the title — typically "confirm" or the noun being acted on. */
  eyebrow?: ReactNode;
  /** Display title — a single short question or statement ("Disconnect Gmail?"). */
  title: ReactNode;
  /** Body — two short paragraphs max. */
  children: ReactNode;
  /** Primary verb-led label ("disconnect gmail", "cancel subscription"). */
  confirmLabel: ReactNode;
  /** Secondary verb-led label ("keep connected", "go back"). */
  cancelLabel?: ReactNode;
  onConfirm: () => void;
  variant?: ApHeritageConfirmVariant;
  dismissible?: boolean;
}

/**
 * @example
 * const [open, setOpen] = useState(false);
 * <ApHeritageConfirm
 *   open={open}
 *   onClose={() => setOpen(false)}
 *   eyebrow="confirm"
 *   title="Disconnect Gmail?"
 *   confirmLabel="disconnect gmail"
 *   cancelLabel="keep connected"
 *   variant="destructive"
 *   onConfirm={handleDisconnect}
 * >
 *   <p>Your fleet stops reading new mail immediately.</p>
 *   <p>Drafts already in your review queue stay there. Reconnect anytime.</p>
 * </ApHeritageConfirm>
 */
export function ApHeritageConfirm({
  open,
  onClose,
  eyebrow,
  title,
  children,
  confirmLabel,
  cancelLabel = "go back",
  onConfirm,
  variant = "calm",
  dismissible = true,
}: ApHeritageConfirmProps) {
  const titleId = useId();
  const descId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prevActive = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dismissible) {
        e.stopPropagation();
        onClose();
      }
      if (e.key === "Tab") {
        // Simple focus trap — keep tab inside the dialog.
        const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
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
  }, [open, onClose, dismissible]);

  if (!open) return null;

  const destructive = variant === "destructive";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="presentation"
      onClick={dismissible ? onClose : undefined}
    >
      <div className="absolute inset-0 bg-ink/40" aria-hidden />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md border border-rule bg-paper p-6 md:p-8"
      >
        {eyebrow ? <ApEyebrow className="mb-3">{eyebrow}</ApEyebrow> : null}
        <h2
          id={titleId}
          className="font-display text-2xl leading-snug text-ink md:text-[1.6rem]"
        >
          {title}
        </h2>
        <div
          id={descId}
          className="mt-4 space-y-3 text-[15px] leading-relaxed text-ink-soft"
        >
          {children}
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-rule pt-5">
          <ApHeritageButton
            ref={cancelRef as React.Ref<HTMLButtonElement>}
            variant="secondary"
            type="button"
            onClick={onClose}
          >
            {cancelLabel}
          </ApHeritageButton>
          {destructive ? (
            <button
              type="button"
              onClick={onConfirm}
              className="inline-flex items-center justify-center gap-2 rounded-none border border-flag bg-transparent px-6 py-3 font-sans text-sm font-medium text-flag transition hover:bg-flag/5"
            >
              {confirmLabel}
            </button>
          ) : (
            <ApHeritageButton
              variant="primary"
              type="button"
              onClick={onConfirm}
            >
              {confirmLabel}
            </ApHeritageButton>
          )}
        </div>
      </div>
    </div>
  );
}
