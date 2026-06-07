import type { ComplianceRule } from "../../types";

/**
 * Testimonials & endorsements — Marketing Rule paragraph (b),
 * 17 CFR § 275.206(4)-1(b).
 *
 * The 2020 amended Marketing Rule (compliance date Nov. 4, 2022) was the
 * first time the SEC permitted investment advisers to use client
 * testimonials and third-party endorsements in advertising — but only
 * subject to (b)(1) clear-and-prominent disclosures, (b)(2) adviser
 * oversight and a written agreement for compensated promoters, and (b)(3)
 * a bar on compensating "ineligible persons." This dedicated rule isolates
 * the (b) conditions so a draft that quotes a client, cites a referral, or
 * runs a third-party rating gets checked against them.
 */
export const rule: ComplianceRule = {
  ruleId: "ria-marketing-testimonials-endorsements",
  title: "Marketing Rule — testimonials & endorsements, 17 CFR § 275.206(4)-1(b)",
  summary:
    "An adviser may use, or pay for, a testimonial (from a current client/investor) or an endorsement (from a non-client) only if: (b)(1) it discloses clearly and prominently the giver's client/non-client status, that compensation was provided, and a brief statement of any material conflicts; (b)(2) the adviser has a reasonable basis to believe the testimonial/endorsement complies with the rule and has a written agreement with any promoter compensated above the de minimis amount; and (b)(3) the adviser does not compensate a promoter it knows (or should know) is an 'ineligible person' (subject to disqualifying SEC actions or certain criminal/regulatory events).",
  jurisdiction: "federal-regulation",
  scope: { kind: "federal" },
  citation: {
    source: "17 CFR § 275.206(4)-1(b) (Marketing Rule — testimonials and endorsements; compliance date Nov. 4, 2022)",
    url: "https://www.law.cornell.edu/cfr/text/17/275.206(4)-1",
    accessedAt: "2026-06-06",
  },
  literalText: `17 CFR § 275.206(4)-1(b) — Testimonials and endorsements:

An advertisement may not include any testimonial or endorsement, and an investment adviser may not provide compensation, directly or indirectly, for a testimonial or endorsement, unless the investment adviser complies with paragraphs (b)(1), (2), and (3) of this section.

(1) Disclosure. The investment adviser discloses, or the investment adviser reasonably believes that the person giving the testimonial or endorsement discloses, the following clearly and prominently:
  (i) That the testimonial was given by a current client or investor, and the endorsement was given by a person other than a current client or investor, as applicable;
  (ii) That cash or non-cash compensation was provided for the testimonial or endorsement, if applicable; and
  (iii) A brief statement of any material conflicts of interest on the part of the person giving the testimonial or endorsement resulting from the investment adviser's relationship with such person.

(2) Adviser oversight and compliance. The investment adviser has a reasonable basis for believing that the testimonial or endorsement complies with the requirements of this section, and, for a testimonial or endorsement for which the adviser provides compensation that exceeds the de minimis threshold, has a written agreement with the person giving the testimonial or endorsement that describes the scope of the agreed-upon activities and the terms of the compensation.

(3) Disqualification. The investment adviser does not compensate a person, directly or indirectly, for a testimonial or endorsement if the investment adviser knows, or in the exercise of reasonable care should know, that the person giving the testimonial or endorsement is an ineligible person at the time the testimonial or endorsement is disseminated.`,
  purpose: "counsel-reference",
  severity: "advisory",
  counselReviewStatus: "draft",
  category: "advertising",
  safeRewrite:
    "Treat any client quote, satisfied-customer story, star rating, referral arrangement, or influencer mention in a draft as a testimonial or endorsement. Do not publish it unless the clear-and-prominent disclosures travel with it (client vs. non-client status, that compensation was paid, and a brief statement of material conflicts), the firm has the required written agreement and oversight for any compensated promoter, and the promoter is not a disqualified/ineligible person.",
  drafterNotes:
    "Verified (b)(1)(i)-(iii) and (b)(3) against Cornell LII 2026-06-06. (b)(2)'s de minimis written-agreement threshold is summarized — counsel to confirm the current dollar figure and the full 'ineligible person' definition (which cross-references SEC disqualifying events). Overlaps deliberately with the general Marketing Rule entry (`advisers-act-marketing-rule-206-4-1`), which carries the paragraph (a) prohibitions; this file isolates paragraph (b) so a testimonial/endorsement draft routes to the precise conditions.",
};
