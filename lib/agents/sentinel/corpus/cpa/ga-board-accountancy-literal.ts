import type { ComplianceRule } from "../../types";

/**
 * Georgia State Board of Accountancy — licensure, CPE, and grounds for
 * discipline.
 */
export const rule: ComplianceRule = {
  ruleId: "ga-board-accountancy",
  title: "Georgia State Board of Accountancy — licensure and discipline",
  summary:
    "The Georgia State Board of Accountancy regulates CPAs in Georgia under O.C.G.A. Title 43, Chapter 3 — sets exam requirements, continuing professional education, and grounds for disciplinary action including dishonest practice and incompetence.",
  jurisdiction: "state-board-rule",
  scope: { kind: "state", state: "GA" },
  citation: {
    source: "O.C.G.A. Title 43, Chapter 3 (Public Accountancy); Rules of the Georgia State Board of Accountancy, Chapter 20",
    url: "https://gsba.georgia.gov/",
    accessedAt: "2026-06-06",
  },
  literalText: `[UNVERIFIED — needs counsel] Substance: O.C.G.A. Title 43, Chapter 3 establishes the Georgia State Board of Accountancy and vests it with authority to license certified public accountants and registered firms practicing in Georgia. Grounds for disciplinary action enumerated in the chapter include: practice without a valid license; conviction of any felony or crime involving moral turpitude; fraud or deceit in obtaining a license; dishonesty, fraud, or gross negligence in the performance of professional services; violation of any rule of professional conduct promulgated by the Board; failure to comply with continuing professional education requirements; and conduct discreditable to the public accounting profession. Implementing rules at Rules of the Georgia State Board of Accountancy (Chapter 20-X) elaborate on professional standards, peer review, and CPE.`,
  purpose: "counsel-reference",
  severity: "info",
  counselReviewStatus: "draft",
  unverified: true,
  safeRewrite:
    "When a draft implies a person may 'practice as a CPA', 'provide CPA / attest services', or hold themselves out as licensed in Georgia, confirm the workspace holds a current Georgia license and firm registration before the language goes out — unlicensed practice and holding out are grounds for discipline under O.C.G.A. Title 43, Chapter 3. Route licensure/CPE-status questions to the operator rather than asserting them in a draft.",
  drafterNotes:
    "Left unverified 2026-06-06: O.C.G.A. is hosted on LexisNexis/state portals that block automated fetch, so the grounds-for-discipline wording (likely O.C.G.A. § 43-3-19) could not be machine-verified this wave. Per the corpus convention literalText keeps the [UNVERIFIED] placeholder. Counsel: pull the canonical grounds-for-discipline section and confirm the current Rules-of-the-Board (Chapter 20-X) numbering.",
};
