import type { CorpusMetadata } from "../../types";

export const metadata: CorpusMetadata = {
  verticalSlug: "real-estate",
  lastReviewedAt: "2026-05-22",
  counselReviewer: null,
  status: "DRAFT",
  openQuestions: [
    "The HUD-literal trigger list (`fair-housing-hud-literal.ts`) now ships ~46 phrases ported from flatsbo. Counsel should red-line the full list before flipping `status: COUNSEL_REVIEWED`.",
    "Borderline phrases intentionally excluded from the literal-match list (e.g. 'walking distance to church', 'quiet street', 'family-friendly') need a counsel decision on whether to route through a future LLM-classifier path or stay out entirely.",
    "The substantive § 804(c) rule is `purpose: counsel-reference` — counsel should confirm the statutory excerpt is the version the firm wants on customer-facing flags.",
  ],
};
