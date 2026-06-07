// agentplain product-surface primitives.
// Rulebook: docs/product-design-language-2026-05-17.md
// All `Ap*` components live here so the product surface has a single,
// auditable import surface. New primitives MUST be added to this barrel and
// to the reference table in §6 of the design language doc in the same PR.

export { ApAppShell, ApWorkspaceStrip } from "./ApAppShell";
export { ApEyebrow } from "./ApEyebrow";
export {
  ApHairlineList,
  ApHairlineRow,
} from "./ApHairlineList";
export { ApHeritageButton } from "./ApHeritageButton";
export type {
  ApHeritageButtonProps,
  ApHeritageButtonVariant,
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
export type { ApPaperCardDensity } from "./ApPaperCard";
export { ApPaperSheet } from "./ApPaperSheet";
export { ApRootedEmptyState } from "./ApRootedEmptyState";
export { ApRootedLoader } from "./ApRootedLoader";
export type { ApRootedLoaderKind } from "./ApRootedLoader";
export { Plaino } from "./Plaino";
export type { PlainoState } from "./Plaino";
export { PlainoAvatar } from "./PlainoAvatar";
export type {
  PlainoAvatarPose,
  PlainoAvatarSize,
  PlainoAvatarTone,
} from "./PlainoAvatar";
