import type { ComplianceRule } from "../../types";

/**
 * Rule 204A-1 — Investment Adviser Code of Ethics requirement.
 *
 * Every SEC-registered investment adviser must adopt and enforce a written
 * code of ethics meeting five specified content requirements.
 */
export const rule: ComplianceRule = {
  ruleId: "advisers-act-rule-204A-1-code-of-ethics",
  title: "Rule 204A-1 — Investment Adviser Code of Ethics",
  summary:
    "Every SEC-registered investment adviser must establish, maintain, and enforce a written code of ethics that includes (1) a standard of business conduct; (2) personal securities reporting by access persons; (3) preapproval of access-person investments in IPOs and limited offerings; (4) prompt internal reporting of violations; and (5) acknowledgment of receipt of the code.",
  jurisdiction: "federal-regulation",
  scope: { kind: "federal" },
  citation: {
    source: "17 CFR § 275.204A-1",
    url: "https://www.ecfr.gov/current/title-17/chapter-II/part-275/section-275.204A-1",
    accessedAt: "2026-05-12",
  },
  literalText: `[UNVERIFIED — needs counsel] Substance of 17 CFR § 275.204A-1:

(a) Adoption and enforcement of code of ethics. If you are an investment adviser registered or required to be registered under section 203 of the Act (15 U.S.C. 80b-3), you must establish, maintain and enforce a written code of ethics that, at a minimum, includes:

(1) A standard (or standards) of business conduct that you require of your supervised persons, which standard must reflect your fiduciary obligations and those of your supervised persons;

(2) Provisions requiring your supervised persons to comply with applicable Federal securities laws;

(3) Provisions that require all of your access persons to report, and you to review, their personal securities transactions and holdings periodically as provided below;

(4) Provisions requiring supervised persons to report any violations of your code of ethics promptly to your chief compliance officer or, provided your chief compliance officer also receives reports of all violations, to other persons you designate in your code of ethics; and

(5) Provisions requiring you to provide each of your supervised persons with a copy of your code of ethics and any amendments, and requiring your supervised persons to provide you with a written acknowledgment of their receipt of the code and any amendments.

(b) Reporting requirements—
(1) Holdings reports. The code of ethics must require your access persons to submit to your chief compliance officer or other persons you designate in your code of ethics a report of the access person's current securities holdings that meets the following requirements:
(i) Content of holdings reports. Each holdings report must contain, at a minimum:
  (A) The title and type of security, and as applicable the exchange ticker symbol or CUSIP number, number of shares, and principal amount of each reportable security in which the access person has any direct or indirect beneficial ownership;
  (B) The name of any broker, dealer or bank with which the access person maintains an account in which any securities are held for the access person's direct or indirect benefit; and
  (C) The date the access person submits the report.

(ii) Timing of holdings reports. Your access persons must submit a holdings report:
  (A) No later than 10 days after the person becomes an access person, and the information must be current as of a date no more than 45 days prior to the date the person becomes an access person.
  (B) At least once during each 12-month period thereafter on a date you select, and the information must be current as of a date no more than 45 days prior to the date the report was submitted.`,
  unverified: true,
  drafterNotes:
    "Counsel: 17 CFR § 275.204A-1 also has paragraphs (b)(2) (transaction reports — within 30 days of quarter end), (c) (pre-approval of IPOs and limited offerings), (d) (recordkeeping cross-reference to Rule 204-2), and (e) (definitions). Recommend separate literals for those subsections.",
};
