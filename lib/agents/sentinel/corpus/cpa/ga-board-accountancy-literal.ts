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
    accessedAt: "2026-05-12",
  },
  literalText: `[UNVERIFIED — needs counsel] Substance: O.C.G.A. Title 43, Chapter 3 establishes the Georgia State Board of Accountancy and vests it with authority to license certified public accountants and registered firms practicing in Georgia. Grounds for disciplinary action enumerated in the chapter include: practice without a valid license; conviction of any felony or crime involving moral turpitude; fraud or deceit in obtaining a license; dishonesty, fraud, or gross negligence in the performance of professional services; violation of any rule of professional conduct promulgated by the Board; failure to comply with continuing professional education requirements; and conduct discreditable to the public accounting profession. Implementing rules at Rules of the Georgia State Board of Accountancy (Chapter 20-X) elaborate on professional standards, peer review, and CPE.`,
  unverified: true,
  drafterNotes:
    "Counsel: please pull canonical text of the grounds-for-discipline section (likely O.C.G.A. § 43-3-19) and replace placeholder. Confirm the current Rules-of-the-Board chapter numbering.",
};
