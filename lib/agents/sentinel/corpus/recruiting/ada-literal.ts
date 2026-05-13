import type { ComplianceRule } from "../../types";

/**
 * ADA Title I — disability discrimination prohibition in employment.
 */
export const rule: ComplianceRule = {
  ruleId: "ada-title-i-prohibition",
  title: "ADA Title I — disability discrimination in employment",
  summary:
    "No covered entity shall discriminate against a qualified individual on the basis of disability in regard to job application procedures, hiring, advancement, discharge, compensation, training, and other terms, conditions, and privileges of employment.",
  jurisdiction: "federal-statute",
  scope: { kind: "federal" },
  citation: {
    source: "42 USC § 12112(a)",
    url: "https://www.law.cornell.edu/uscode/text/42/12112",
    accessedAt: "2026-05-12",
  },
  literalText: `(a) General rule
No covered entity shall discriminate against a qualified individual on the basis of disability in regard to job application procedures, the hiring, advancement, or discharge of employees, employee compensation, job training, and other terms, conditions, and privileges of employment.`,
  drafterNotes:
    "Sentinel should pair this with the 'reasonable accommodation' requirement at 42 USC § 12112(b)(5)(A); recommend a companion literal in counsel's next pass.",
};
