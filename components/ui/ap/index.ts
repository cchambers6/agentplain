// agentplain product-surface primitives.
// Rulebook: docs/product-design-language-2026-05-17.md
// All `Ap*` components live here so the product surface has a single,
// auditable import surface. New primitives MUST be added to this barrel and
// to the reference table in §6 of the design language doc in the same PR.

export { ApAppShell, ApWorkspaceStrip } from "./ApAppShell";
export { ApBadge } from "./ApBadge";
export type { ApBadgeTone } from "./ApBadge";
export { ApCallout } from "./ApCallout";
export type { ApCalloutTone } from "./ApCallout";
export { ApClosingBand, ApClosingBandAction } from "./ApClosingBand";
export { ApEyebrow } from "./ApEyebrow";
export {
  ApHairlineList,
  ApHairlineRow,
} from "./ApHairlineList";
export { ApHeritageButton } from "./ApHeritageButton";
export type {
  ApHeritageButtonProps,
  ApHeritageButtonVariant,
  ApHeritageButtonSize,
} from "./ApHeritageButton";
export { ApHeritageConfirm } from "./ApHeritageConfirm";
export type { ApHeritageConfirmVariant } from "./ApHeritageConfirm";
export { ApHeritageField } from "./ApHeritageField";
export {
  ApHeritageGrid,
  ApHeritageGridCell,
  ApHeritageTable,
  ApHeritageTd,
  ApHeritageTh,
} from "./ApHeritageTable";
export { ApMotif } from "./ApMotif";
export type { ApMotifName } from "./ApMotif";
export { ApPaperCard } from "./ApPaperCard";
export type { ApPaperCardDensity, ApPaperCardVariant } from "./ApPaperCard";
export { ApPlainoLoader } from "./ApPlainoLoader";
export { ApPullQuote } from "./ApPullQuote";
export { ApPaperSheet } from "./ApPaperSheet";
export { ApRootedEmptyState } from "./ApRootedEmptyState";
export { ApRootedLoader } from "./ApRootedLoader";
export type { ApRootedLoaderKind } from "./ApRootedLoader";
export { Plaino } from "./Plaino";
export type { PlainoState } from "./Plaino";
// Two-family Plaino icon system (Conner 2026-06-10; docs/brand/icon-families.md):
//   PlainoMark   — 8-bit BRAND mark (identity surfaces).
//   PlainoStatus — live-STATE pose icon (dashboard / queue / health).
// Product/marketing surfaces import these, never `Plaino` directly.
export { PlainoMark } from "./PlainoMark";
export { PlainoStatus } from "./PlainoStatus";
export type { PlainoStatusState } from "./PlainoStatus";
export {
  PlainoScene,
  isMotifScene,
  verticalSceneName,
} from "./PlainoScene";
export type { PlainoSceneName } from "./PlainoScene";
export { PlainoAvatar } from "./PlainoAvatar";
export type {
  PlainoAvatarPose,
  PlainoAvatarSize,
  PlainoAvatarTone,
} from "./PlainoAvatar";
