import type { ReactNode } from "react";
import { ApRootedLoader, type ApRootedLoaderKind } from "./ApRootedLoader";
import { PlainoStatus, type PlainoStatusState } from "./PlainoStatus";

// Plaino loading persona moment — the hairline ApRootedLoader strip with a working
// Plaino pose beside it. The design-mirror (docs/brand/design-mirror-2026-06-19.md
// §7, Boston Dynamics / Aibo) found warmth comes from a character's *posture* in a
// real working moment, not from a face or an orb. A loading slot is exactly the
// dead spinner-space generic SaaS fills with a pulsing gradient; we fill it with
// Plaino actually at work. Still no spinner — the quiet strip is unchanged; this
// only adds the persona beat.
//
// The loader's `kind` maps to the live-state pose so the dog's posture matches the
// copy ("Drafting…" → Plaino fetching; "Rooting in…" → Plaino standing watch).
// Honors prefers-reduced-motion through the underlying strip; the pose is a static
// PNG, so there's nothing extra to suppress.

const KIND_TO_POSE: Record<ApRootedLoaderKind, PlainoStatusState> = {
  "reading-queue": "herd",
  connecting: "scout",
  drafting: "fetch",
  syncing: "herd",
  "first-load": "watch",
  default: "watch",
};

interface ApPlainoLoaderProps {
  /** Pick a preset — drives both the copy line and the matching Plaino pose. */
  kind?: ApRootedLoaderKind;
  /** Override the copy line entirely. Pass null to hide copy (pose + strip only). */
  label?: ReactNode | null;
  /** Plaino pose box size in px. Defaults to 40 — a calm inline presence. */
  poseSize?: number;
  className?: string;
}

/**
 * @example
 * {pending ? <ApPlainoLoader kind="drafting" /> : null}
 *
 * @example
 * <ApPlainoLoader kind="first-load" label="Rooting in…" />
 */
export function ApPlainoLoader({
  kind = "default",
  label,
  poseSize = 40,
  className,
}: ApPlainoLoaderProps) {
  const wrapper = ["flex items-center gap-4", className]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={wrapper}>
      {/* Decorative — the strip's role="status" + copy already announce state. */}
      <PlainoStatus state={KIND_TO_POSE[kind]} size={poseSize} />
      <ApRootedLoader kind={kind} label={label} className="flex-1" />
    </div>
  );
}

export default ApPlainoLoader;
