import type { ComplianceRule } from "../../types";

/**
 * AICPA Code — Due Care principle.
 *
 * One of the six principles of the AICPA Code (Article V).
 */
export const rule: ComplianceRule = {
  ruleId: "aicpa-due-care-principle",
  title: "AICPA Code — Due Care Principle (Article V)",
  summary:
    "A member should observe the profession's technical and ethical standards, strive continually to improve competence and the quality of services, and discharge professional responsibility to the best of the member's ability.",
  jurisdiction: "professional-pronouncement",
  scope: { kind: "professional-body", body: "AICPA" },
  citation: {
    source: "AICPA Code of Professional Conduct § 0.300.060 (Due Care Principle, Article V), effective December 15, 2014",
    url: "https://pub.aicpa.org/codeofconduct/ethicsresources/et-cod.pdf",
    accessedAt: "2026-06-06",
  },
  literalText: `[UNVERIFIED — needs counsel] Substance of AICPA Code § 0.300.060 (Due Care):

.01 The quest for excellence is the essence of due care. Due care requires a member to discharge professional responsibilities with competence and diligence. It imposes the obligation to perform professional services to the best of a member's ability with concern for the best interest of those for whom the services are performed and consistent with the profession's responsibility to the public.

.02 Competence is derived from a synthesis of education and experience. It begins with a mastery of the common body of knowledge required for designation as a certified public accountant. The maintenance of competence requires a commitment to learning and professional improvement that must continue throughout a member's professional life. It is a member's individual responsibility. In all engagements and in all responsibilities, each member should undertake to achieve a level of competence that will assure that the quality of the member's services meets the high level of professionalism required by these Principles.

.03 Competence represents the attainment and maintenance of a level of understanding and knowledge that enables a member to render services with facility and acumen. It also establishes the limitations of a member's capabilities by dictating that consultation or referral may be required when a professional engagement exceeds the personal competence of a member or a member's firm. Each member is responsible for assessing his or her own competence—of evaluating whether education, experience, and judgment are adequate for the responsibility to be assumed.

.04 Members should be diligent in discharging responsibilities to clients, employers, and the public. Diligence imposes the responsibility to render services promptly and carefully, to be thorough, and to observe applicable technical and ethical standards.

.05 Due care requires a member to plan and supervise adequately any professional activity for which he or she is responsible.`,
  purpose: "counsel-reference",
  severity: "info",
  counselReviewStatus: "draft",
  unverified: true,
  safeRewrite:
    "When a draft promises services outside the member's demonstrated competence ('we handle every kind of tax matter', 'no engagement too complex') or implies work will be delivered without adequate planning/supervision, surface the Due Care principle: competence has limits, and consultation or referral may be required when an engagement exceeds personal competence. Rewrite to scope the offer to the firm's actual competencies.",
  drafterNotes:
    "Left unverified: 2026-06-06 — the Due Care Principle is published in the AICPA Code (Article V, 0.300.060 in the post-2014 codification; 1.300.060 is the related Due Professional Care interpretation under the General Standards Rule). Verbatim text could not be machine-pulled from a stable authoritative URL (copyrighted pronouncement); citation points at AICPA's et-cod.pdf. Counsel: confirm whether sentinel should anchor to the 0.300.060 Principle or the 1.300.060 interpretation (or both).",
};
