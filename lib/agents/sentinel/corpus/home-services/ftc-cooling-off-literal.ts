import type { ComplianceRule } from "../../types";

/**
 * FTC Cooling-Off Rule — three-business-day right to cancel for door-
 * to-door / off-premises sales.
 *
 * Direct match: any home-services draft that proposes a contract signed
 * at the consumer's home for $25+ (or elsewhere for $130+) must give
 * the consumer the right to cancel within 3 business days, with the
 * statement and a cancellation form provided at the time of sale.
 */
export const rule: ComplianceRule = {
  ruleId: "ftc-cooling-off-rule",
  title: "FTC Cooling-Off Rule — three-business-day right to cancel door-to-door sales",
  summary:
    "For consumer-goods or services sales of $25+ made at the buyer's residence (or $130+ at other locations off the seller's main place of business), the seller must give the buyer a three-business-day right to cancel, a contract notice of that right, and two copies of a completed cancellation form.",
  jurisdiction: "federal-regulation",
  scope: { kind: "federal" },
  citation: {
    source: "16 CFR § 429.1 (FTC Cooling-Off Rule); 80 Fed. Reg. 12,756 (Mar. 10, 2015) (raising thresholds to $25/$130)",
    url: "https://www.ecfr.gov/current/title-16/chapter-I/subchapter-D/part-429",
    accessedAt: "2026-05-12",
  },
  literalText: `[UNVERIFIED — needs counsel] Substance of 16 CFR § 429.1: It constitutes an unfair and deceptive act or practice for any seller engaged in the door-to-door sale of consumer goods or services with a purchase price of $25 or more if the sale is made at the buyer's residence, or $130 or more if the sale is made at locations other than the buyer's residence, to:

(a) Fail to furnish the buyer with a fully completed receipt or copy of any contract pertaining to such sale at the time of its execution, which is in the same language (e.g., Spanish) as that principally used in the oral sales presentation and which shows the date of the transaction and contains the name and address of the seller, and in immediate proximity to the space reserved for the buyer's signature or on the front page of the receipt or contract if a contract is used, a statement in a type size no smaller than ten point bold face type, as follows: "You, the buyer, may cancel this transaction at any time prior to midnight of the third business day after the date of this transaction. See the attached notice of cancellation form for an explanation of this right."

(b) Fail to furnish each buyer, at the time the buyer signs the door-to-door sales contract or otherwise agrees to buy consumer goods or services from the seller, a completed form in duplicate, captioned either "NOTICE OF RIGHT TO CANCEL" or "NOTICE OF CANCELLATION," which shall be attached to the contract or receipt and easily detachable, and which shall contain in ten point bold face type the following information and statements in the same language, e.g., Spanish, as that used in the contract.

(c) Fail to inform each buyer orally, at the time the buyer signs the contract or purchases the goods or services, of his or her right to cancel.

(Cancellation period: prior to midnight of the third business day after the date of the transaction.)`,
  unverified: true,
  drafterNotes:
    "Drafter recalls 16 CFR § 429.1 wording with reasonable confidence — flagged unverified pending counsel pulling the canonical eCFR text. The 2015 threshold change ($25 / $130) is the most-likely-stale detail; counsel verifies.",
};
