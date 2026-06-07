import type { ComplianceRule } from "../../types";

/**
 * Georgia Rules of Professional Conduct — state-specific overlay on the
 * ABA Model Rules.
 *
 * Routing entry: Georgia adopts the Model Rules with state-specific
 * modifications. Sentinel uses the GA-specific text where it diverges
 * from the Model Rules; otherwise it falls back to the Model Rule
 * literals already loaded.
 */
export const rule: ComplianceRule = {
  ruleId: "ga-rules-of-professional-conduct",
  title: "Georgia Rules of Professional Conduct — state adoption of Model Rules",
  summary:
    "Georgia adopts the ABA Model Rules of Professional Conduct as the Georgia Rules of Professional Conduct, codified in Part IV, Chapter 1 of the Rules and Regulations of the State Bar of Georgia, with state-specific modifications.",
  jurisdiction: "state-board-rule",
  scope: { kind: "state", state: "GA" },
  citation: {
    source: "Georgia Rules of Professional Conduct (Rules and Regulations of the State Bar of Georgia, Part IV, Chapter 1)",
    url: "https://www.gabar.org/barrules/handbookdetail.cfm?what=rule",
    accessedAt: "2026-06-06",
  },
  literalText: `[CROSS-REFERENCE + UNVERIFIED] Substance: Georgia has adopted the ABA Model Rules of Professional Conduct as the Georgia Rules of Professional Conduct, codified in Part IV, Chapter 1 of the Rules and Regulations of the State Bar of Georgia. State-specific deviations from the Model Rules include (among others) Georgia-specific advertising provisions and Rule 5.5 multijurisdictional-practice carve-outs. For rules where Georgia has not deviated from the Model Rule, sentinel should use the Model Rule literals loaded elsewhere in this corpus.

Counsel: please pull the canonical Georgia-specific deviations and instantiate them as their own standalone literals in this corpus — the routing entry alone is not sufficient for sentinel matching where the state rule differs.`,
  purpose: "counsel-reference",
  severity: "info",
  counselReviewStatus: "draft",
  category: "state-overlay",
  unverified: true,
  safeRewrite:
    "Where Georgia has not deviated from the Model Rule, rely on the Model Rule literals already loaded in this corpus. Where GA diverges (advertising provisions, 5.5 multijurisdictional-practice carve-outs), do not draft state-specific compliance claims until counsel has instantiated the GA-specific text as standalone literals — flag GA-specific advertising / UPL drafts for human review in the interim.",
  drafterNotes:
    "Routing-only, severity info: the GA State Bar handbook (gabar.org) blocks automated fetch (HTTP 403 on 2026-06-06), so the GA-specific deviations remain [UNVERIFIED — needs counsel]. Per the corpus convention, unverified stays true and the literal is a placeholder; sentinel will not match against it. Counsel needs to either (a) confirm the Model Rule literals are acceptable substitutes, or (b) instantiate GA-specific text as new rule files. accessedAt 2026-06-06 records the date the fetch was attempted and blocked.",
};
