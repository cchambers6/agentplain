/* eslint-disable @next/next/no-img-element -- PlainoStatus renders a local
   /public pose raster with a plain <img>, not next/image, on purpose: the
   product surface is unit-tested with react-dom/server `renderToStaticMarkup`
   in bare node:test (see tests/customer-approvals.test.tsx), where next/image's
   loader config is absent and would throw. A plain <img> renders identically
   server-side, in tests, and in email/OG contexts. Matches the `Plaino`
   primitive precedent in the same barrel. */
import { Plaino, type PlainoState } from "./Plaino";

// ─── LIVE-STATUS ICON ──────────────────────────────────────────────────
// PlainoStatus maps live product state to a Plaino persona pose. Conner
// ratified the two-family split 2026-06-10 (see docs/brand/icon-families.md):
//
//   PlainoMark   = identity ("this is agentplain"). STATIC brand mark.
//   PlainoStatus = live product state → persona behaviour. THIS component.
//
// State → meaning (the product contract):
//   sit   — idle / waiting / quiet
//   fetch — working / delivering a draft
//   herd  — organizing / queueing / running a chain
//   alert — needs attention / blocked
//   sleep — paused
//
// Extended idle-monitoring / research states (kept so callers that already
// know a richer posture don't have to collapse it):
//   watch — idle monitoring (no active work, eyes open)
//   scout — search / research in progress
//
// NEVER MIX THE FAMILIES. A status surface never renders the 8-bit brand
// mark; a brand surface never renders a pose. Use PlainoMark for identity.
//
// Accessibility: decorative by default (a paired label usually names the
// state in text). When the icon carries the state on its own, pass
// `alt` (or rely on the announced default) so assistive tech hears
// "Plaino is fetching".

export type PlainoStatusState =
  | "sit"
  | "fetch"
  | "herd"
  | "alert"
  | "sleep"
  | "watch"
  | "scout";

// Maps the live-state vocabulary to the underlying pose asset (Plaino primitive).
const STATE_TO_POSE: Record<PlainoStatusState, PlainoState> = {
  sit: "sitting-alert",
  fetch: "fetching",
  herd: "herding",
  alert: "guarding",
  sleep: "resting",
  watch: "standing-watch",
  scout: "scouting",
};

// Default spoken label per state, used when the icon is non-decorative and
// the caller didn't pass an explicit `alt`.
const STATE_LABEL: Record<PlainoStatusState, string> = {
  sit: "Plaino is waiting",
  fetch: "Plaino is fetching",
  herd: "Plaino is organizing",
  alert: "Plaino needs your attention",
  sleep: "Plaino is paused",
  watch: "Plaino is monitoring",
  scout: "Plaino is researching",
};

type PlainoStatusProps = {
  /** Live product state. See file header for the contract. */
  state: PlainoStatusState;
  /** Rendered box size in px (square). Defaults to 24. */
  size?: number;
  className?: string;
  /** Accessible label override. When omitted *and* `decorative` is false,
   *  the state's default spoken label is announced ("Plaino is fetching"). */
  alt?: string;
  /** When true (default) the icon is hidden from assistive tech because the
   *  surface already names the state in adjacent text. Pass false to announce
   *  the state through the icon itself. */
  decorative?: boolean;
};

export function PlainoStatus({
  state,
  size = 24,
  className,
  alt,
  decorative = true,
}: PlainoStatusProps) {
  const pose = STATE_TO_POSE[state];
  // When non-decorative, announce the state. Default to the per-state label
  // ("Plaino is fetching") so assistive tech hears the live status even if the
  // caller didn't pass an explicit alt.
  const label = decorative ? undefined : (alt ?? STATE_LABEL[state]);

  // Delegate the raster render to the Plaino primitive so there's one source
  // of truth for asset paths and the plain-<img> a11y pattern. The label (when
  // present) becomes the <img> alt + exposes the icon to assistive tech.
  return <Plaino state={pose} size={size} className={className} alt={label} />;
}

export default PlainoStatus;
