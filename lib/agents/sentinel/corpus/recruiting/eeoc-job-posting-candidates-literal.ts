import type { ComplianceRule } from "../../types";

/**
 * EEOC / ADEA / Title VII / ADA — job-posting advertising candidate
 * triggers.
 *
 * DRAFT, UNVERIFIED. Sentinel WILL NOT fire on these — the scanner skips
 * `unverified: true` rules. Candidate list for counsel red-line.
 *
 * Statutory anchors:
 *   - Age Discrimination in Employment Act § 4(e) (29 USC § 623(e)):
 *     prohibits printing or publishing any "notice or advertisement
 *     relating to employment ... indicating any preference, limitation,
 *     specification, or discrimination, based on age."
 *   - Title VII of the Civil Rights Act § 704(b) (42 USC § 2000e-3(b)):
 *     parallel prohibition for race, color, religion, sex, or national
 *     origin.
 *   - Americans with Disabilities Act § 102 (42 USC § 12112): prohibits
 *     discriminatory advertising and pre-employment inquiries.
 *
 * EEOC sub-regulatory guidance (Compliance Manual; pre-employment inquiry
 * guidance) consistently identifies the phrases below as facially
 * problematic in job postings.
 */
export const rule: ComplianceRule = {
  ruleId: "eeoc-job-posting-candidates",
  title: "EEOC / ADEA / Title VII / ADA — candidate job-posting triggers (DRAFT)",
  summary:
    "Candidate literal phrases drafted from ADEA § 4(e), Title VII § 704(b), ADA § 102, and EEOC sub-regulatory guidance on facially discriminatory job advertising. Sentinel does NOT fire on these until counsel red-lines.",
  jurisdiction: "federal-statute",
  scope: { kind: "federal" },
  citation: {
    source: "29 USC § 623(e) (ADEA); 42 USC § 2000e-3(b) (Title VII); 42 USC § 12112 (ADA); EEOC Compliance Manual",
    url: "https://www.eeoc.gov/laws/guidance/section-12-religious-discrimination",
    accessedAt: "2026-05-25",
  },
  literalText:
    "[DRAFT — needs counsel] 29 USC § 623(e): It shall be unlawful for an employer, labor organization, or employment agency to print or publish, or cause to be printed or published, any notice or advertisement relating to employment by such an employer or membership in or any classification or referral for employment by such a labor organization, or relating to any classification or referral for employment by such an employment agency, indicating any preference, limitation, specification, or discrimination, based on age.\n\n42 USC § 2000e-3(b): It shall be an unlawful employment practice for an employer ... to print or publish or cause to be printed or published any notice or advertisement relating to employment by such an employer ... indicating any preference, limitation, specification, or discrimination, based on race, color, religion, sex, or national origin.\n\n42 USC § 12112(d)(2)(A) (ADA): A covered entity shall not conduct a medical examination or make inquiries of a job applicant as to whether such applicant is an individual with a disability or as to the nature or severity of such disability.\n\nCandidate trigger phrases below are nominated from these prohibitions but have NOT been counsel-verified.",
  purpose: "literal-match",
  unverified: true,
  category: "job-advertising",
  triggers: [
    // Age (ADEA § 4(e)) — common EEOC-cited proxies
    "young",
    "youthful",
    "energetic",
    "recent graduate",
    "recent college graduate",
    "recent grad",
    "digital native",
    "mature applicant",
    // Sex / gender (Title VII § 704(b))
    "salesman",
    "saleswoman",
    "waitress",
    "stewardess",
    "businessman",
    "girl friday",
    "handyman",
    "policeman",
    "fireman",
    "draftsman",
    "manpower",
    // National origin (Title VII § 704(b))
    "native english speaker",
    "must be a u.s. citizen",
    "u.s. citizens only",
    "no foreigners",
    // Disability (ADA § 102)
    "able-bodied",
    "able bodied",
    "must be physically fit",
    "no disabilities",
  ],
  drafterNotes:
    "Drafted 2026-05-25. Age proxies ('young', 'energetic', 'recent grad', 'digital native') are the most commonly cited ADEA § 4(e) phrases in EEOC complaints (see EEOC v. iGate, EEOC v. Texas Roadhouse). Gender-coded job titles ('salesman', 'waitress', etc.) are the canonical Title VII § 704(b) targets — most employers now use the neutral form ('salesperson', 'server'). 'Must be a U.S. citizen' has a narrow legitimate exception under IRCA for positions where citizenship is legally required (federal contracts, some classified work), so counsel should consider scoping. 'Able-bodied' is a near-per-se ADA violation in job postings absent a bona-fide essential-functions justification. Phrases intentionally held back for counsel: 'Christian environment' / 'Christian workplace' (religious-employer exception under Title VII § 702(a) makes this context-sensitive); 'no felons' (state-level ban-the-box laws differ widely — recommend counsel-reference + state-specific overlay).",
};
