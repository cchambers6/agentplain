import type { ComplianceRule } from "../../types";

/**
 * Title VII — core prohibition on race / color / religion / sex /
 * national origin discrimination.
 *
 * Sentinel matches on hiring drafts (job postings, screening notes,
 * interview summaries) that imply protected-class consideration.
 */
export const rule: ComplianceRule = {
  ruleId: "title-vii-prohibition",
  title: "Title VII — unlawful employment practices",
  summary:
    "It is unlawful for a covered employer to refuse to hire, discharge, or otherwise discriminate against any individual with respect to compensation, terms, conditions, or privileges of employment because of race, color, religion, sex, or national origin.",
  jurisdiction: "federal-statute",
  scope: { kind: "federal" },
  citation: {
    source: "42 USC § 2000e-2(a)",
    url: "https://www.law.cornell.edu/uscode/text/42/2000e-2",
    accessedAt: "2026-05-12",
  },
  literalText: `(a) Employer practices
It shall be an unlawful employment practice for an employer—
(1) to fail or refuse to hire or to discharge any individual, or otherwise to discriminate against any individual with respect to his compensation, terms, conditions, or privileges of employment, because of such individual's race, color, religion, sex, or national origin; or
(2) to limit, segregate, or classify his employees or applicants for employment in any way which would deprive or tend to deprive any individual of employment opportunities or otherwise adversely affect his status as an employee, because of such individual's race, color, religion, sex, or national origin.`,
  drafterNotes:
    "Bostock v. Clayton County (2020) clarified that 'sex' in Title VII covers sexual orientation and gender identity. Counsel: confirm whether sentinel should surface a Bostock-anchored companion entry explicitly.",
};
