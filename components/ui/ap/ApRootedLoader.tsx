import type { ReactNode } from "react";

// Quiet loader — a single hairline-thin clay strip slides left-to-right inside a
// paper-deep band. No spinner. No skeleton cards. No "Loading…". The label
// reports what is actually happening; per design language §1.5 + §3.6:
//
//   reading-queue   → "Reading the queue…"
//   connecting      → "Connecting your inbox…"
//   drafting        → "Drafting…"
//   syncing         → "Catching up with your CRM…"
//   first-load      → "Rooting in…"
//   default         → "One moment."
//
// Pass `label` as a string OR pick a preset via `kind`. If a state takes >800ms
// the caller is expected to render this; under 800ms the strip alone is enough
// — pass `label={null}` to suppress the copy.

export type ApRootedLoaderKind =
  | "reading-queue"
  | "connecting"
  | "drafting"
  | "syncing"
  | "first-load"
  | "default";

interface ApRootedLoaderProps {
  /** Pick a preset copy line. Overridden by an explicit `label`. */
  kind?: ApRootedLoaderKind;
  /** Override the copy line entirely. Pass null to hide copy. */
  label?: ReactNode | null;
  /** ARIA label for the strip when copy is hidden. */
  ariaLabel?: string;
  className?: string;
}

const PRESET: Record<ApRootedLoaderKind, string> = {
  "reading-queue": "Reading the queue…",
  connecting: "Connecting your inbox…",
  drafting: "Drafting…",
  syncing: "Catching up with your CRM…",
  "first-load": "Rooting in…",
  default: "One moment.",
};

/**
 * @example
 * {pending ? <ApRootedLoader kind="drafting" /> : null}
 *
 * @example
 * <ApRootedLoader kind="reading-queue" />
 *
 * @example
 * <ApRootedLoader label="Reconnecting Gmail…" />
 */
export function ApRootedLoader({
  kind = "default",
  label,
  ariaLabel,
  className,
}: ApRootedLoaderProps) {
  const copy = label === null ? null : label ?? PRESET[kind];
  const a11y = ariaLabel ?? (typeof copy === "string" ? copy : PRESET[kind]);

  const wrapperClasses = ["w-full", className].filter(Boolean).join(" ");

  return (
    <div className={wrapperClasses} role="status" aria-live="polite" aria-label={a11y}>
      <div className="relative h-[3px] w-full overflow-hidden bg-paper-deep">
        <div
          aria-hidden
          className="ap-rooted-loader-bar absolute left-0 top-0 h-full w-[45%] bg-clay/40"
        />
      </div>
      {copy ? (
        <p className="mt-3 text-[13px] leading-relaxed text-mute">{copy}</p>
      ) : null}
    </div>
  );
}
