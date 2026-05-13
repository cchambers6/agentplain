import type { ComplianceRule } from "../../types";

/**
 * ADEA — Age Discrimination in Employment Act. Protects workers 40+.
 */
export const rule: ComplianceRule = {
  ruleId: "adea-prohibition",
  title: "ADEA — prohibition on age discrimination (40 and over)",
  summary:
    "It is unlawful for a covered employer to refuse to hire or discriminate against any individual with respect to compensation, terms, conditions, or privileges of employment because of such individual's age, where the individual is at least 40 years of age.",
  jurisdiction: "federal-statute",
  scope: { kind: "federal" },
  citation: {
    source: "29 USC § 623(a); 29 USC § 631(a) (age 40+ coverage)",
    url: "https://www.law.cornell.edu/uscode/text/29/623",
    accessedAt: "2026-05-12",
  },
  literalText: `(a) Employer practices
It shall be unlawful for an employer—
(1) to fail or refuse to hire or to discharge any individual or otherwise discriminate against any individual with respect to his compensation, terms, conditions, or privileges of employment, because of such individual's age;
(2) to limit, segregate, or classify his employees in any way which would deprive or tend to deprive any individual of employment opportunities or otherwise adversely affect his status as an employee, because of such individual's age; or
(3) to reduce the wage rate of any employee in order to comply with this chapter.

(See also 29 USC § 631(a) limiting coverage to individuals who are at least 40 years of age.)`,
};
