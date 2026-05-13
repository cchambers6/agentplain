import type { ComplianceRule } from "../../types";

/**
 * Marketing Rule (Rule 206(4)-1) — modernized advertising and solicitation
 * rule, effective compliance date 2022-11-04.
 *
 * Single rule covers both traditional advertising and solicitation of
 * compensated endorsements/testimonials. Sentinel matches against client
 * acquisition / marketing drafts.
 */
export const rule: ComplianceRule = {
  ruleId: "advisers-act-marketing-rule-206-4-1",
  title: "Marketing Rule — 17 CFR § 275.206(4)-1",
  summary:
    "An adviser may not disseminate any advertisement that contains an untrue statement of material fact, a material omission, a statement that the adviser cannot substantiate upon SEC demand, a reference to specific investment advice that is not presented fairly and impartially, or that is otherwise materially misleading; testimonials, endorsements, and performance presentations are subject to specific conditions including required disclosures and prohibitions on cherry-picked performance.",
  jurisdiction: "federal-regulation",
  scope: { kind: "federal" },
  citation: {
    source: "17 CFR § 275.206(4)-1 (Marketing Rule, amended 86 Fed. Reg. 13024 (Mar. 5, 2021))",
    url: "https://www.ecfr.gov/current/title-17/chapter-II/part-275/section-275.206(4)-1",
    accessedAt: "2026-05-12",
  },
  literalText: `[UNVERIFIED — needs counsel] Substance of 17 CFR § 275.206(4)-1 (Marketing Rule):

(a) General Prohibitions. It is unlawful within the meaning of section 206(4) of the Investment Advisers Act of 1940 for any investment adviser registered or required to be registered under section 203 of the Advisers Act, directly or indirectly, to disseminate any advertisement that:
  (1) Includes any untrue statement of a material fact, or omits to state a material fact necessary in order to make the statement made, in the light of the circumstances under which it was made, not misleading;
  (2) Includes a material statement of fact that the adviser does not have a reasonable basis for believing it will be able to substantiate upon demand by the Commission;
  (3) Includes information that would reasonably be likely to cause an untrue or misleading implication or inference to be drawn concerning a material fact relating to the investment adviser;
  (4) Discusses any potential benefits to clients or investors connected with or resulting from the investment adviser's services or methods of operation without providing fair and balanced treatment of any material risks or material limitations associated with the potential benefits;
  (5) Includes a reference to specific investment advice provided by the investment adviser where such investment advice is not presented in a manner that is fair and balanced;
  (6) Includes or excludes performance results, or presents performance time periods, in a manner that is not fair and balanced; or
  (7) Is otherwise materially misleading.

(b) Testimonials and Endorsements. An advertisement may not include any testimonial or endorsement, and an adviser may not provide compensation, directly or indirectly, for a testimonial or endorsement, unless the adviser complies with paragraphs (b)(1), (2), and (3) of this section — specifically, required disclosures (status as client or non-client, compensation arrangement, material conflicts), adviser oversight and written agreement requirements, and prohibitions on certain disqualified persons.`,
  unverified: true,
  drafterNotes:
    "Counsel: please pull canonical Marketing Rule text — particularly paragraphs (b) (testimonials/endorsements), (c) (third-party ratings), (d) (performance), and (e) (definitions including 'advertisement'). The 'advertisement' definition is a sentinel anchor for whether a draft falls within the rule at all.",
};
