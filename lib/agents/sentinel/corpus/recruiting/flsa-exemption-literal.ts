import type { ComplianceRule } from "../../types";

/**
 * FLSA white-collar exemption framework.
 *
 * 29 USC § 213(a)(1) names the categories; 29 CFR Part 541 defines
 * the duties tests. Sentinel matches on offer letters and JD drafts
 * that classify a role as exempt — flagging requires duties-test review.
 */
export const rule: ComplianceRule = {
  ruleId: "flsa-white-collar-exemptions",
  title: "FLSA — executive, administrative, professional, outside-sales, computer exemptions",
  summary:
    "The FLSA minimum wage and overtime requirements do not apply to employees who satisfy the white-collar (executive, administrative, professional), outside-sales, or computer-employee exemptions; eligibility is determined by salary basis, salary level, and duties tests at 29 CFR Part 541.",
  jurisdiction: "federal-statute",
  scope: { kind: "federal" },
  citation: {
    source: "29 USC § 213(a)(1); implementing regulations 29 CFR Part 541",
    url: "https://www.law.cornell.edu/uscode/text/29/213",
    accessedAt: "2026-05-12",
  },
  literalText: `(a) Minimum wage and maximum hour requirements
The provisions of sections 206 (except subsection (d) in the case of paragraph (1) of this subsection) and 207 of this title shall not apply with respect to—
(1) any employee employed in a bona fide executive, administrative, or professional capacity (including any employee employed in the capacity of academic administrative personnel or teacher in elementary or secondary schools), or in the capacity of outside salesman (as such terms are defined and delimited from time to time by regulations of the Secretary, subject to the provisions of subchapter II of chapter 5 of title 5, except that an employee of a retail or service establishment shall not be excluded from the definition of employee employed in a bona fide executive or administrative capacity because of the number of hours in his workweek which he devotes to activities not directly or closely related to the performance of executive or administrative activities, if less than 50 per centum of such employee's hours worked in the workweek are devoted to such activities)…`,
  drafterNotes:
    "29 CFR Part 541 carries the operative duties tests + the salary-level threshold (currently $684/week and subject to DOL rulemaking — counsel: check the current threshold at time of review).",
};
