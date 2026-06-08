/**
 * Sentinel agent — public entry point.
 *
 * `loadCorpusFor(verticalSlug)` returns the compliance corpus bundle for
 * a given vertical, or `null` if no corpus is registered. The skill
 * chain (`lib/skills/*`) consumes the corpus to score drafts against
 * regulatory exposure.
 *
 * Per `project_no_outbound_architecture.md`: sentinel advises, it does
 * not block. The customer's own system decides whether a flagged draft
 * gets sent, edited, or discarded — sentinel never reaches outbound.
 *
 * Per `feedback_runner_portability.md`: this loader is the abstraction
 * boundary. Today's implementation is a static registry. A future
 * implementation (per-workspace overrides, CMS-backed corpus, customer-
 * trained additions) plugs in here without touching skill-layer callers.
 */

import type { CorpusBundle } from "./types";
import { env } from "../../env";

import { realEstateCorpus } from "./corpus/real-estate";
import { mortgageCorpus } from "./corpus/mortgage";
import { insuranceCorpus } from "./corpus/insurance";
import { propertyManagementCorpus } from "./corpus/property-management";
import { titleEscrowCorpus } from "./corpus/title-escrow";
import { recruitingCorpus } from "./corpus/recruiting";
import { homeServicesCorpus } from "./corpus/home-services";
import { cpaCorpus } from "./corpus/cpa";
import { lawCorpus } from "./corpus/law";
import { riaCorpus } from "./corpus/ria";

/**
 * Static corpus registry. Order matches `lib/verticals/index.ts` for
 * cross-vertical reading; alphabetization is intentional in tests, not
 * here.
 */
const CORPUS_REGISTRY: Record<string, CorpusBundle> = {
  "real-estate": realEstateCorpus,
  mortgage: mortgageCorpus,
  insurance: insuranceCorpus,
  "property-management": propertyManagementCorpus,
  "title-escrow": titleEscrowCorpus,
  recruiting: recruitingCorpus,
  "home-services": homeServicesCorpus,
  cpa: cpaCorpus,
  law: lawCorpus,
  ria: riaCorpus,
};

/**
 * Load the compliance corpus for a vertical. Returns `null` if no
 * corpus is registered for the slug — callers must handle the null
 * (e.g. by surfacing "no corpus loaded" in the audit log) rather than
 * silently falling through.
 */
export function loadCorpusFor(verticalSlug: string): CorpusBundle | null {
  return CORPUS_REGISTRY[verticalSlug] ?? null;
}

/**
 * List the slugs that have a registered corpus. Used by tests and by
 * the sentinel admin UI to surface coverage.
 */
export function listCorpusVerticals(): string[] {
  return Object.keys(CORPUS_REGISTRY);
}

/**
 * Verticals whose corpus is allowed to fire live WITHOUT the
 * `COMPLIANCE_CORPUS_COUNSEL_REVIEWED` env flag. real-estate is the one
 * vertical whose literal-match corpus (the HUD fair-housing trigger list)
 * predates the go-live gate and is already in production; gating it would
 * be a regression. Per `reference_product_claims_vs_reality_2026_05_22.md`,
 * every OTHER vertical's corpus is DRAFT and must clear both the per-rule
 * `unverified` gate AND this env flag before it can fire.
 */
const BASELINE_LIVE_VERTICALS = new Set<string>(["real-estate"]);

/**
 * Whether a vertical's counsel-reviewed rules may fire live. This is the
 * production go-live gate that sits on TOP of the per-rule `unverified`
 * check in the scanner: a rule fires only when it is both verified AND its
 * vertical is allowed live here. Mortgage and insurance corpora are
 * counsel-handoff drafts — they will not fire until (a) counsel flips their
 * rules to verified and (b) ops adds the slug to
 * COMPLIANCE_CORPUS_COUNSEL_REVIEWED.
 *
 * Per `feedback_runner_portability.md` this is the abstraction boundary —
 * callers ask sentinel "is this vertical live?" instead of reading env
 * directly, so a future per-workspace override plugs in here.
 */
export function isVerticalLiveAllowed(verticalSlug: string): boolean {
  if (BASELINE_LIVE_VERTICALS.has(verticalSlug)) return true;
  return env.complianceCounselReviewedVerticals().includes(verticalSlug);
}

export type {
  CorpusBundle,
  ComplianceRule,
  CorpusMetadata,
  RuleMatchPurpose,
  RuleSeverity,
  CounselReviewStatus,
  RuleRegexTrigger,
} from "./types";
export { scanCorpus } from "./scanner";
export type { ComplianceFlag, ScanInput, ScanResult } from "./scanner";
export { stageRewrites, deterministicFallback } from "./rewrite";
export type {
  StagedRewrite,
  StageRewritesInput,
  RewriteSource,
} from "./rewrite";
export {
  InMemoryRedlineStore,
  normalizeClausePattern,
  reduceLearnedLanguage,
  LEARNED_LANGUAGE_THRESHOLD,
} from "./redline-store";
export type {
  RedlineStore,
  CounselRedline,
  ProposedCounselRedline,
  LearnedClauseLanguage,
} from "./redline-store";
export { PrismaRedlineStore } from "./prisma-redline-store";
export { buildCounselHandoffPacket } from "./counsel-packet";
export type {
  CounselHandoffPacket,
  PacketCandidateLiteralTrigger,
  PacketCandidateRegexTrigger,
  PacketCounselReference,
  PacketLiteralTrigger,
} from "./counsel-packet";
export { renderCounselPacketMarkdown } from "./render-counsel-packet";
