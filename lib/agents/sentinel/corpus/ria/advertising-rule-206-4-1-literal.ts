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
    "The 2020 amended Marketing Rule (compliance date Nov. 4, 2022) governs adviser advertising and replaced the former Advertising Rule and Cash Solicitation Rule. Paragraph (a) sets SEVEN general prohibitions (untrue/omitted material fact; unsubstantiated material claims; misleading implications; benefits without fair-and-balanced treatment of material risks; unfair references to specific advice; unfair performance presentation; otherwise materially misleading). Paragraph (b) newly permits TESTIMONIALS and ENDORSEMENTS only with clear-and-prominent disclosures (client/non-client status, compensation, material conflicts), adviser oversight and written agreement, and disqualification of ineligible persons.",
  jurisdiction: "federal-regulation",
  scope: { kind: "federal" },
  citation: {
    source: "17 CFR § 275.206(4)-1 (Marketing Rule; adopted 86 Fed. Reg. 13024 (Mar. 5, 2021), eff. May 4, 2021, compliance date Nov. 4, 2022)",
    url: "https://www.law.cornell.edu/cfr/text/17/275.206(4)-1",
    accessedAt: "2026-06-06",
  },
  literalText: `17 CFR § 275.206(4)-1 (Marketing Rule):

(a) General Prohibitions. It is unlawful within the meaning of section 206(4) of the Investment Advisers Act of 1940 for any investment adviser registered or required to be registered under section 203 of the Advisers Act, directly or indirectly, to disseminate any advertisement that:
  (1) Includes any untrue statement of a material fact, or omits to state a material fact necessary in order to make the statement made, in the light of the circumstances under which it was made, not misleading;
  (2) Includes a material statement of fact that the adviser does not have a reasonable basis for believing it will be able to substantiate upon demand by the Commission;
  (3) Includes information that would reasonably be likely to cause an untrue or misleading implication or inference to be drawn concerning a material fact relating to the investment adviser;
  (4) Discusses any potential benefits to clients or investors connected with or resulting from the investment adviser's services or methods of operation without providing fair and balanced treatment of any material risks or material limitations associated with the potential benefits;
  (5) Includes a reference to specific investment advice provided by the investment adviser where such investment advice is not presented in a manner that is fair and balanced;
  (6) Includes or excludes performance results, or presents performance time periods, in a manner that is not fair and balanced; or
  (7) Is otherwise materially misleading.

(b) Testimonials and endorsements. An advertisement may not include any testimonial or endorsement, and an adviser may not provide compensation, directly or indirectly, for a testimonial or endorsement, unless the adviser complies with paragraphs (b)(1), (2), and (3) of this section:
  (1) Disclosure. The adviser discloses, or reasonably believes that the person giving the testimonial or endorsement discloses, the following clearly and prominently:
    (i) That the testimonial was given by a current client or investor, and the endorsement was given by a person other than a current client or investor, as applicable;
    (ii) That cash or non-cash compensation was provided for the testimonial or endorsement, if applicable; and
    (iii) A brief statement of any material conflicts of interest on the part of the person giving the testimonial or endorsement resulting from the investment adviser's relationship with such person.
  (2) Adviser oversight and compliance. The adviser has a reasonable basis for believing that the testimonial or endorsement complies with this section, and (for compensated testimonials/endorsements over the de minimis threshold) has a written agreement with the person describing the scope of the agreed-upon activities and the terms of compensation.
  (3) Disqualification. The adviser does not compensate a person, directly or indirectly, for a testimonial or endorsement if the adviser knows, or in the exercise of reasonable care should know, that the person is an ineligible person at the time the testimonial or endorsement is disseminated.`,
  purpose: "counsel-reference",
  severity: "blocking",
  counselReviewStatus: "draft",
  safeRewrite:
    "Treat any client/third-party quote, rating, or referral arrangement in a draft as a testimonial or endorsement. Strike it unless the required clear-and-prominent disclosures (client vs. non-client status, compensation, material conflicts) ride alongside, the firm has the written agreement and oversight in place, and the promoter is not a disqualified/ineligible person. Strip any benefit claim that lacks fair-and-balanced treatment of material risks, and any performance figure that is not presented fair-and-balanced.",
  category: "advertising",
  drafterNotes:
    "Verified paragraph (a) seven prohibitions and paragraph (b)(1)/(b)(3) against Cornell LII 2026-06-06. The (b)(2) written-agreement de minimis threshold and paragraphs (c) (third-party ratings), (d) (performance), and (e) (definitions, including 'advertisement') are summarized, not quoted — counsel to pull the canonical (c)/(d)/(e) text; the 'advertisement' definition is the sentinel anchor for whether a draft falls within the rule at all. A dedicated testimonials/endorsements companion ships at `ria-marketing-testimonials-endorsements`.",
};
