// lib/creative-handoff — the structured human-creator handoff for
// brand-defining creative.
//
// The fleet does NOT improvise brand assets in raw SVG/PNG when a real design
// tool exists OR when the work is brand-defining
// (feedback_creative_assets_use_tools_or_humans). When the creative router
// decides a job needs a human, it assembles a portable CreatorBriefPacket
// (./packet), lands a DRAFT (./store), and an operator runs it through the
// status machine (./lifecycle) at /operator/creative-briefs.
//
// See docs/strategy/creative-asset-capability-2026-06-06/ARCHITECTURE.md.

export {
  buildBriefPacket,
  brandSnapshot,
  acceptanceCriteriaFor,
  BRAND_GUARDRAILS,
  type CreatorBriefPacket,
  type BrandSnapshot,
  type BriefReference,
  type DeliverySpec,
  type BuildPacketInput,
} from "./packet";

export {
  canTransition,
  nextStatuses,
  isTerminal,
  isAcceptanceDecision,
} from "./lifecycle";

export {
  createDraftBrief,
  listBriefs,
  transitionBrief,
  InvalidBriefTransitionError,
  type CreateBriefInput,
  type ListBriefsArgs,
  type TransitionInput,
  type CreatorDelivery,
} from "./store";
