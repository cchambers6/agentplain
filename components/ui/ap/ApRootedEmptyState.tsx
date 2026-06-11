import type { ReactNode } from "react";
import { ApMotif, type ApMotifName } from "./ApMotif";
import { PlainoScene, type PlainoSceneName } from "./PlainoScene";

// Empty-state card. Per design language §1.2 + §3.5:
//   - one image cue (optional, off-center left, 64-96px)
//   - one sentence reporting reality
//   - one sentence telling the user what changes that
//   - one CTA
// No exclamation points. No "All clear!" No emoji. No "Looks like…"
//
// Banned framings: "All caught up!", "You're all set!", "Inbox zero — nice work!",
// "Looks like there's nothing here yet."

interface ApRootedEmptyStateProps {
  /** Eyebrow above the card (e.g. section name). Optional. */
  eyebrow?: ReactNode;
  /** One sentence reporting what's currently true. */
  reality: ReactNode;
  /** One sentence telling the user what changes that. Optional. */
  change?: ReactNode;
  /** Single CTA (typically an <ApHeritageButton variant="secondary">). Optional. */
  cta?: ReactNode;
  /** Plains line-art motif. Omit to render without imagery. */
  motif?: ApMotifName;
  /**
   * Heritage Plaino scene illustration — the partner-grade upgrade over the
   * line-art `motif`. When set, this renders instead of `motif` so the empty
   * state shows the named service partner, not a generic landscape. Wired to a
   * motif or pose art (see PlainoScene); an asset swap is one-line.
   */
  scene?: PlainoSceneName;
}

/**
 * @example
 * <ApRootedEmptyState
 *   eyebrow="approvals"
 *   motif="lone-tree"
 *   reality="No drafts in the queue."
 *   change="Your fleet is reading inbox traffic; the first batch usually lands by 9:14am ET."
 *   cta={
 *     <ApHeritageButton variant="secondary" withArrow href="/app/workspace/123/integrations">
 *       connect another tool
 *     </ApHeritageButton>
 *   }
 * />
 */
export function ApRootedEmptyState({
  eyebrow,
  reality,
  change,
  cta,
  motif,
  scene,
}: ApRootedEmptyStateProps) {
  return (
    <section className="border border-rule bg-paper p-6 md:p-8">
      {eyebrow ? (
        <p className="mb-4 font-mono text-[11px] tracking-eyebrow uppercase text-mute">
          {eyebrow}
        </p>
      ) : null}
      {scene ? (
        // Scene takes precedence over the line-art motif: the named partner
        // beats a generic landscape in the emotional empty-state moment.
        <div className="mb-5">
          <PlainoScene name={scene} className="h-auto w-40 max-w-full" />
        </div>
      ) : motif ? (
        <div className="mb-5 text-ink">
          <ApMotif name={motif} size={96} />
        </div>
      ) : null}
      <p className="max-w-prose text-[15px] leading-relaxed text-ink">
        {reality}
      </p>
      {change ? (
        <p className="mt-2 max-w-prose text-[13px] leading-relaxed text-mute">
          {change}
        </p>
      ) : null}
      {cta ? <div className="mt-5">{cta}</div> : null}
    </section>
  );
}
