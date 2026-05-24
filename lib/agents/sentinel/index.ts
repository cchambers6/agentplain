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

export type { CorpusBundle, ComplianceRule, CorpusMetadata, RuleMatchPurpose } from "./types";
export { scanCorpus } from "./scanner";
export type { ComplianceFlag, ScanInput, ScanResult } from "./scanner";
export { buildCounselHandoffPacket } from "./counsel-packet";
export type {
  CounselHandoffPacket,
  PacketCounselReference,
  PacketLiteralTrigger,
} from "./counsel-packet";
