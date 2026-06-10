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
import {
  envPermitsVertical,
  evaluateCounselGate,
} from "./counsel-signoff";

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
 * Verticals whose corpus may SCAN/FLAG live WITHOUT the
 * `COMPLIANCE_CORPUS_COUNSEL_REVIEWED` env flag. real-estate's literal-match
 * corpus (the HUD fair-housing trigger list) is already in production; gating
 * SCANNING would be a regression that silently REDUCES customer protection —
 * the opposite of the pfd-5 bar. Every OTHER vertical's corpus is DRAFT and
 * must clear the env flag before it scans live.
 *
 * ⚠️ pfd-5 SCOPE: this baseline governs SCANNING (the safe, advise-only path —
 * flag a problem, generate NO legal text). It does NOT govern rewrite-and-stage
 * REWRITE GENERATION, which is the dangerous path (it can emit replacement
 * legal text). Rewrites use the strict `evaluateCounselGate` (env kill-switch
 * AND a durable per-vertical sign-off row, fail-closed, NO baseline exemption).
 * Keeping scanning on the looser gate while rewriting is on the stricter one is
 * deliberate: flagging issues protects the customer; drafting unreviewed legal
 * text endangers them.
 */
const BASELINE_LIVE_VERTICALS = new Set<string>(["real-estate"]);

/**
 * Whether a vertical's counsel-reviewed rules may SCAN/FLAG live. This is the
 * SCAN go-live gate (unchanged by pfd-5): real-estate is baseline-live; others
 * require the env flag. It is NOT the rewrite gate — see `evaluateCounselGate`
 * for the stricter, DB-backed gate that governs replacement-legal-text
 * generation.
 *
 * Per `feedback_runner_portability.md` this is the abstraction boundary —
 * callers ask sentinel "is this vertical live to scan?" instead of reading env
 * directly.
 */
export function isVerticalLiveAllowed(verticalSlug: string): boolean {
  if (BASELINE_LIVE_VERTICALS.has(verticalSlug)) return true;
  return envPermitsVertical(verticalSlug);
}

/** Is a vertical slug registered with a corpus? Used by the gate to fail
 *  closed on unknown verticals. */
export function isKnownCorpusVertical(verticalSlug: string): boolean {
  return Object.prototype.hasOwnProperty.call(CORPUS_REGISTRY, verticalSlug);
}

/**
 * The production counsel-gate resolver: the FULL gate (env kill-switch AND a
 * current durable sign-off row), reading the Prisma sign-off store fresh on
 * every call. Fail-closed — never throws, returns `false` on any ambiguity.
 * This is the default `stageRewrites` uses in production; tests inject an
 * in-memory store via `makeCounselGate`.
 */
export async function defaultCounselGate(
  verticalSlug: string,
): Promise<boolean> {
  const { PrismaCounselSignoffStore } = await import(
    "./prisma-counsel-signoff-store"
  );
  return makeCounselGate(new PrismaCounselSignoffStore())(verticalSlug);
}

/**
 * Build a counsel-gate resolver bound to a specific sign-off store. The
 * resolver answers "may this vertical's rewrites fire live?" combining the
 * env kill-switch + the store-backed sign-off, fail-closed on unknown
 * verticals and store errors.
 */
export function makeCounselGate(
  store: import("./counsel-signoff").CounselSignoffStore,
  now?: () => Date,
): import("./counsel-signoff").CounselGateResolver {
  return async (verticalSlug: string) => {
    const result = await evaluateCounselGate({
      verticalSlug,
      store,
      isKnownVertical: isKnownCorpusVertical,
      now: now?.(),
    });
    return result.live;
  };
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
export {
  envPermitsVertical,
  evaluateCounselGate,
  isSignoffCurrentlyValid,
  shouldShowCounselGatedBanner,
  COUNSEL_GATED_BANNER_TEXT,
} from "./counsel-signoff";
export type {
  CounselSignoff,
  CounselSignoffStore,
  RecordSignoffInput,
  CounselGateResult,
  CounselGateResolver,
} from "./counsel-signoff";
export { InMemoryCounselSignoffStore } from "./counsel-signoff-store";
export { PrismaCounselSignoffStore } from "./prisma-counsel-signoff-store";
