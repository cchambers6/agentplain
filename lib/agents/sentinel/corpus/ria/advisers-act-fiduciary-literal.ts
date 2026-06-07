import type { ComplianceRule } from "../../types";

/**
 * Investment Advisers Act Section 206 — antifraud / fiduciary duty.
 *
 * Section 206 is the statutory source the SEC and federal courts treat
 * as imposing a fiduciary duty on investment advisers. Load-bearing
 * sentinel anchor for any RIA-vertical draft that touches client
 * recommendations, fee arrangements, or conflicts disclosure.
 */
export const rule: ComplianceRule = {
  ruleId: "advisers-act-section-206",
  title: "Investment Advisers Act Section 206 — antifraud provisions / fiduciary duty",
  summary:
    "It is unlawful for any investment adviser to defraud a client or prospective client; to engage in a transaction, practice, or course of business which operates as a fraud or deceit; to engage in principal/agency transactions without written disclosure and client consent; or to engage in any fraudulent, deceptive, or manipulative act, practice, or course of business.",
  jurisdiction: "federal-statute",
  scope: { kind: "federal" },
  citation: {
    source: "15 USC § 80b-6 (Section 206 of the Investment Advisers Act of 1940)",
    url: "https://www.law.cornell.edu/uscode/text/15/80b-6",
    accessedAt: "2026-06-06",
  },
  literalText: `§ 80b-6. Prohibited transactions by investment advisers
It shall be unlawful for any investment adviser, by use of the mails or any means or instrumentality of interstate commerce, directly or indirectly—
(1) to employ any device, scheme, or artifice to defraud any client or prospective client;
(2) to engage in any transaction, practice, or course of business which operates as a fraud or deceit upon any client or prospective client;
(3) acting as principal for his own account, knowingly to sell any security to or purchase any security from a client, or acting as broker for a person other than such client, knowingly to effect any sale or purchase of any security for the account of such client, without disclosing to such client in writing before the completion of such transaction the capacity in which he is acting and obtaining the consent of the client to such transaction. The prohibitions of this paragraph shall not apply to any transaction with a customer of a broker or dealer if such broker or dealer is not acting as an investment adviser in relation to such transaction; or
(4) to engage in any act, practice, or course of business which is fraudulent, deceptive, or manipulative. The Commission shall, for the purposes of this paragraph (4) by rules and regulations define, and prescribe means reasonably designed to prevent, such acts, practices, and courses of business as are fraudulent, deceptive, or manipulative.`,
  purpose: "counsel-reference",
  severity: "blocking",
  counselReviewStatus: "draft",
  safeRewrite:
    "Frame every recommendation, fee description, and conflict in terms of the client's best interest. Strike anything that overstates certainty, hides a conflict, or describes a principal/agency trade without the written, pre-trade capacity disclosure and client consent § 206(3) requires. Disclose material conflicts plainly rather than burying them.",
  drafterNotes:
    "SEC Staff Bulletin on Standards of Conduct for Broker-Dealers and Investment Advisers (2022) and Regulation Best Interest interpretations expand on the fiduciary contour of Section 206. Counsel may want sentinel to load companion interpretive guidance.",
};
