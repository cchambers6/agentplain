import type { ComplianceRule } from "../../types";

/**
 * Circular 230 § 10.27 — contingent-fee restrictions.
 */
export const rule: ComplianceRule = {
  ruleId: "circular-230-fees-10-27",
  title: "Circular 230 § 10.27 — fees (contingent-fee restriction)",
  summary:
    "A practitioner may not charge an unconscionable fee, and may not charge a contingent fee for services rendered in connection with any matter before the IRS except in three narrow situations (representation in connection with an examination of an original return, claims for refund filed solely in connection with the determination of statutory interest or penalties, or judicial proceedings under the Internal Revenue Code).",
  jurisdiction: "federal-regulation",
  scope: { kind: "federal" },
  citation: {
    source: "31 CFR § 10.27",
    url: "https://www.law.cornell.edu/cfr/text/31/10.27",
    accessedAt: "2026-06-06",
  },
  literalText: `31 CFR § 10.27 — Fees.

(a) In general. A practitioner may not charge an unconscionable fee in connection with any matter before the Internal Revenue Service.
(b) Contingent fees—
  (1) Except as provided in paragraphs (b)(2), (3), and (4) of this section, a practitioner may not charge a contingent fee for services rendered in connection with any matter before the Internal Revenue Service.
  (2) A practitioner may charge a contingent fee for services rendered in connection with the Service's examination of, or challenge to—
    (i) An original tax return; or
    (ii) An amended return or claim for refund or credit where the amended return or claim for refund or credit was filed within 120 days of the taxpayer receiving a written notice of the examination of, or a written challenge to, the original tax return.
  (3) A practitioner may charge a contingent fee for services rendered in connection with a claim for credit or refund filed solely in connection with the determination of statutory interest or penalties assessed by the Internal Revenue Service.
  (4) A practitioner may charge a contingent fee for services rendered in connection with any judicial proceeding arising under the Internal Revenue Code.

(c) Definitions. For purposes of this section—
  (1) Contingent fee is any fee that is based, in whole or in part, on whether or not a position taken on a tax return or other filing avoids challenge by the Internal Revenue Service or is sustained either by the Internal Revenue Service or in litigation. A contingent fee includes a fee that is based on a percentage of the refund reported on a return, that is based on a percentage of the taxes saved, or that otherwise depends on the specific result attained.`,
  purpose: "counsel-reference",
  severity: "advisory",
  counselReviewStatus: "draft",
  safeRewrite:
    "When a fee-arrangement draft offers to bill 'a percentage of your refund', 'a cut of the taxes we save you', or 'no fee unless we win', flag it: a contingent fee tied to a return position is barred under § 10.27(b)(1) outside the three narrow exceptions (original-return exam/challenge, statutory interest/penalty refund claims, judicial proceedings). Rewrite to a flat or hourly fee disclosed up front, or confirm the matter falls within a § 10.27(b)(2)-(4) exception before proposing a contingent fee.",
  drafterNotes:
    "Verified 2026-06-06 against Cornell LII mirror of 31 CFR § 10.27 — the unconscionable-fee bar in (a), the contingent-fee prohibition and (b)(2)-(4) exceptions, and the (c)(1) contingent-fee definition all match the published text. Counsel-reference: deciding whether a fee is 'contingent' or 'unconscionable' requires judgment, so sentinel does not auto-match; the candidate advertising rule carries the literal triggers.",
};
