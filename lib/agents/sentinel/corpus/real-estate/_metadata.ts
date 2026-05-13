import type { CorpusMetadata } from "../../types";

export const metadata: CorpusMetadata = {
  verticalSlug: "real-estate",
  lastReviewedAt: "2026-05-12",
  counselReviewer: null,
  status: "DRAFT",
  openQuestions: [
    "The canonical Fair Housing HUD-literal trigger list and pattern-matcher already exists in the flatsbo codebase at `lib/agents/sentinel/corpus/fair-housing-hud-literal.ts`. The agentplain version here is a single rule entry that captures the substantive 24 CFR § 100 advertising prohibition; the trigger list itself should be ported (with its `findHudLiteralMatches` helper) as a separate PR — that helper is matching-logic, not corpus content, and shouldn't ship alongside the corpus draft PR.",
    "Counsel red-line of the HUD trigger list (the 40+ literal phrases) should be combined with this corpus before sentinel goes live.",
  ],
};
