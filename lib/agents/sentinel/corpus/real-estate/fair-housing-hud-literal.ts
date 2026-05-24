/**
 * Fair Housing Act § 804(c) — HUD-literal advertising trigger phrases.
 *
 * Ports the 40+ literal phrases originally drafted in flatsbo (at
 * `lib/agents/sentinel/corpus/fair-housing-hud-literal.ts`) into the
 * agentplain corpus shape. Each phrase is one HUD has called out by name
 * in advertising-compliance guidance under 24 CFR § 100 Subpart H — they
 * are deterministic triggers, NOT generative-judgment calls.
 *
 * Sentinel flags every literal occurrence; the operator routes from there
 * (rewrite / keep with rationale / block). Per the project memo
 * (vertical-depth wave, 2026-05-22): LITERAL MATCH ONLY ships live.
 * Borderline phrasing that requires context (e.g. "walking distance to
 * church" in a benign neighborhood-description context) belongs in the
 * counsel-handoff packet, not here.
 *
 * Citation: 24 CFR § 100.75 — discriminatory advertising prohibition.
 * The substantive statutory anchor is `fair-housing-advertising-literal.ts`
 * which keeps the long-form 42 USC § 3604(c) excerpt; this rule carries
 * the matcher's trigger list.
 */

import type { ComplianceRule } from "../../types";

export const rule: ComplianceRule = {
  ruleId: "fha-hud-literal-triggers",
  title: "Fair Housing Act — HUD-literal advertising trigger phrases",
  summary:
    "HUD-enumerated literal phrases that on their face indicate preference or limitation based on a protected class. Sentinel flags every occurrence in a customer-facing draft and routes to operator review.",
  jurisdiction: "federal-regulation",
  scope: { kind: "federal" },
  citation: {
    source: "24 CFR § 100.75 (implementing 42 USC § 3604(c))",
    url: "https://www.ecfr.gov/current/title-24/subtitle-B/chapter-I/subchapter-A/part-100/subpart-B/section-100.75",
    accessedAt: "2026-05-22",
  },
  literalText:
    "24 CFR § 100.75(c) (examples; non-exhaustive):\nThe prohibitions of this section shall apply to using words, phrases, photographs, illustrations, symbols or forms which convey that dwellings are available or not available to a particular group of persons because of race, color, religion, sex, handicap, familial status, or national origin.\n\nThe phrases enumerated below are the HUD-literal advertising triggers — sentinel flags every literal occurrence in a draft regardless of surrounding context. Borderline phrases that depend on context (e.g. 'walking distance to church' when used as a neighborhood landmark) flow through the counsel-handoff packet, not this rule.",
  purpose: "literal-match",
  category: "fair-housing",
  triggers: [
    // Familial status
    "no children",
    "no kids",
    "adults only",
    "adult building",
    "adult community",
    "mature persons",
    "mature adults",
    "mature couple",
    "empty nesters",
    "singles only",
    "one child",
    "great for families",
    "perfect for families",
    "family-oriented",
    "family neighborhood",
    "bachelor",
    "bachelorette",
    "bachelor pad",
    // Religion
    "christian home",
    "christian community",
    "christian family",
    "jewish home",
    "muslim home",
    "catholic family",
    // Race / color / national origin
    "no blacks",
    "whites only",
    "white only",
    "caucasian preferred",
    "caucasian only",
    "no hispanics",
    "no latinos",
    "no asians",
    "no foreigners",
    "english speaking",
    "english speaking only",
    // Sex
    "no women",
    "no men",
    "female only",
    "male only",
    "ladies only",
    "gentlemen only",
    // Disability
    "no wheelchairs",
    "able-bodied",
    "must be able-bodied",
    "no mentally ill",
    "no handicapped",
    "no disabled",
  ],
  drafterNotes:
    "Ported from flatsbo `lib/agents/sentinel/corpus/fair-housing-hud-literal.ts` (read 2026-05-22). Counsel-handoff packet should record the borderline phrases intentionally excluded (e.g. 'walking distance to church', 'quiet street', 'family-friendly') so counsel can route them through the LLM classifier path in a follow-up PR.",
};
