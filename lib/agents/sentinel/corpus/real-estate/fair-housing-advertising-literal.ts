import type { ComplianceRule } from "../../types";

/**
 * Fair Housing Act § 804(c) — discriminatory advertising prohibition.
 *
 * This is the substantive Fair Housing statute the HUD-literal trigger
 * list (originating in the flatsbo codebase as `fair-housing-hud-literal.ts`)
 * was built against. The trigger-list / pattern-matcher pair will be
 * ported to agentplain in a separate PR — this entry captures the
 * statutory anchor.
 */
export const rule: ComplianceRule = {
  ruleId: "fha-section-804-c-advertising",
  title: "Fair Housing Act § 804(c) — prohibition on discriminatory advertising",
  summary:
    "It is unlawful to make, print, or publish (or cause to be made, printed, or published) any notice, statement, or advertisement, with respect to the sale or rental of a dwelling, that indicates any preference, limitation, or discrimination based on race, color, religion, sex, handicap, familial status, or national origin, or an intention to make any such preference, limitation, or discrimination.",
  jurisdiction: "federal-statute",
  scope: { kind: "federal" },
  citation: {
    source: "42 USC § 3604(c); implementing regulation 24 CFR § 100.75",
    url: "https://www.law.cornell.edu/uscode/text/42/3604",
    accessedAt: "2026-05-12",
  },
  literalText: `42 USC § 3604(c):
[As made applicable by section 3603 of this title and except as exempted by sections 3603(b) and 3607 of this title, it shall be unlawful—]
(c) To make, print, or publish, or cause to be made, printed, or published any notice, statement, or advertisement, with respect to the sale or rental of a dwelling that indicates any preference, limitation, or discrimination based on race, color, religion, sex, handicap, familial status, or national origin, or an intention to make any such preference, limitation, or discrimination.

24 CFR § 100.75(c) (examples; non-exhaustive):
The prohibitions of this section shall apply to:
(1) Using words, phrases, photographs, illustrations, symbols or forms which convey that dwellings are available or not available to a particular group of persons because of race, color, religion, sex, handicap, familial status, or national origin.
(2) Expressing to agents, brokers, employees, prospective sellers or renters or any other persons a preference for or limitation on any purchaser or renter because of race, color, religion, sex, handicap, familial status, or national origin of such persons.
(3) Selecting media or locations for advertising the sale or rental of dwellings which deny particular segments of the housing market information about housing opportunities because of race, color, religion, sex, handicap, familial status, or national origin.
(4) Refusing to publish advertising for the sale or rental of dwellings or requiring different charges or terms for such advertising because of race, color, religion, sex, handicap, familial status, or national origin.`,
  drafterNotes:
    "Sentinel pattern-matching against the HUD-literal trigger list (40+ literal phrases like 'no children', 'Christian home', etc.) lives in flatsbo at `lib/agents/sentinel/corpus/fair-housing-hud-literal.ts` along with the `findHudLiteralMatches` helper. That trigger list should be ported to agentplain in a follow-up PR; this rule is the statutory anchor it matches against.",
};
