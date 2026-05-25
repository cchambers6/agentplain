import type { ComplianceRule } from "../../types";

/**
 * FTC § 5 + 16 CFR § 251.1 ("Use of the Word 'Free'") + Magnuson-Moss
 * § 2303 — candidate advertising triggers for home-services drafts.
 *
 * DRAFT, UNVERIFIED. Sentinel WILL NOT fire on these — the scanner skips
 * `unverified: true` rules. Candidate list for counsel red-line.
 *
 * Authorities anchored:
 *
 *   - FTC Act § 5(a)(1) — 15 USC § 45(a)(1): "unfair or deceptive acts or
 *     practices in or affecting commerce ... are hereby declared unlawful."
 *     This is the federal baseline that home-services advertising
 *     ("guaranteed lowest price", "factory authorized" when not, blanket
 *     "lifetime warranty" claims, unqualified satisfaction guarantees) is
 *     measured against.
 *
 *   - 16 CFR § 251.1 ("Guide Concerning Use of the Word 'Free' and Similar
 *     Representations") — when a seller advertises a "free" item conditioned
 *     on a purchase, the regular price of the purchased article must be the
 *     ordinary price recently and regularly charged, and the conditions of
 *     the offer must be conspicuously disclosed. "Free estimate" /
 *     "free inspection" claims for trade work routinely draw scrutiny under
 *     this guide and state UDAP analogues.
 *
 *   - Magnuson-Moss Warranty Act, 15 USC § 2303(a)(1)-(2) — a written
 *     warranty must be designated "full (statement of duration) warranty"
 *     or "limited warranty"; advertising a "lifetime warranty" without the
 *     statutorily required designation is the most common Magnuson-Moss
 *     advertising trap for home-services providers.
 *
 *   - State UDAP / contractor-board advertising rules — many states (incl.
 *     Georgia) require the contractor license number to appear in print
 *     and online advertising. This rule does NOT include license-number
 *     literals (those vary per state and would false-positive without
 *     workspace context); the open question is logged in `_metadata.ts`.
 *
 * Every candidate phrase below is nominated because, on its face, it
 * (a) makes an unqualified absolute claim that FTC § 5 deceptive-practices
 * case law treats as presumptively deceptive without substantiation, OR
 * (b) directly implicates the "free" / "lifetime warranty" /
 * "factory authorized" categories the FTC and state AGs prosecute most.
 * Counsel: accept / reword / demote to counsel-reference / strike.
 */
export const rule: ComplianceRule = {
  ruleId: "home-services-deceptive-advertising-candidates",
  title:
    "FTC § 5 + 16 CFR § 251.1 + Magnuson-Moss § 2303 — candidate home-services advertising triggers (DRAFT)",
  summary:
    "Candidate literal phrases drafted from FTC Act § 5 deceptive-practices doctrine, the FTC Guide on Use of the Word 'Free' (16 CFR § 251.1), and Magnuson-Moss warranty-designation requirements (15 USC § 2303). Sentinel does NOT fire on these until counsel red-lines for the workspace's state(s).",
  jurisdiction: "federal-regulation",
  scope: { kind: "federal" },
  citation: {
    source:
      "FTC Act § 5(a)(1) (15 USC § 45(a)(1)); 16 CFR § 251.1 (Guide Concerning Use of the Word 'Free' and Similar Representations); 15 USC § 2303(a) (Magnuson-Moss designation of written warranties)",
    url: "https://www.ecfr.gov/current/title-16/chapter-I/subchapter-B/part-251",
    accessedAt: "2026-05-25",
  },
  literalText:
    "[DRAFT — needs counsel] FTC Act § 5(a)(1) (15 USC § 45(a)(1)): Unfair methods of competition in or affecting commerce, and unfair or deceptive acts or practices in or affecting commerce, are hereby declared unlawful.\n\n16 CFR § 251.1(b)(1): The offer of 'Free' merchandise or service is misleading if all the terms, conditions and obligations upon which receipt and retention of the 'Free' item are contingent are not clearly and conspicuously set forth at the outset of the offer ... Disclosure of the terms of the offer ... made in a footnote of an advertisement to which reference is made by an asterisk or other symbol ... is not regarded as making disclosure at the outset.\n\n16 CFR § 251.1(c): A 'Free' offer should not be made in connection with the introduction of a new article or service offered for sale at a specified price unless the seller expects in good faith to discontinue the offer after a limited time and to commence selling the article or service promoted, separately, at the same price at which it was promoted with a 'Free' offer.\n\n15 USC § 2303(a): Any warrantor warranting a consumer product by means of a written warranty shall clearly and conspicuously designate such warranty as either a 'full (statement of duration) warranty' or a 'limited warranty' depending on whether it meets the Federal minimum standards of 15 USC § 2304.\n\nCandidate trigger phrases below are nominated from these prohibitions but have NOT been counsel-verified.",
  purpose: "literal-match",
  unverified: true,
  category: "advertising",
  triggers: [
    "guaranteed lowest price",
    "lowest price guaranteed",
    "lowest price in town",
    "we will beat any price",
    "we beat any competitor",
    "100% satisfaction guaranteed",
    "satisfaction guaranteed or your money back",
    "lifetime warranty",
    "lifetime guarantee",
    "no questions asked refund",
    "free estimate",
    "free inspection",
    "free quote",
    "factory authorized",
    "factory certified",
    "manufacturer endorsed",
    "manufacturer authorized",
    "licensed and bonded in all 50 states",
    "epa approved",
    "epa endorsed",
    "government approved",
    "government endorsed",
  ],
  drafterNotes:
    "Drafted 2026-05-25. Phrases fall into four buckets: (1) absolute price claims ('guaranteed lowest price', 'we beat any competitor') — FTC § 5 treats unqualified superlatives as presumptively deceptive without substantiation; (2) 'free' offers ('free estimate', 'free inspection') — 16 CFR § 251.1 requires conspicuous disclosure of any conditions, and many state AGs treat unconditioned 'free' claims as per-se deceptive when the offer is contingent on purchase; (3) warranty puffery ('lifetime warranty', 'no questions asked refund') — Magnuson-Moss § 2303 requires 'full' or 'limited' designation, so unqualified 'lifetime warranty' advertising is the most common federal warranty-advertising trap; (4) endorsement / authority claims ('factory authorized', 'epa approved', 'government endorsed') — FTC § 5 + 16 CFR Part 255 (Endorsement Guides) treat these as deceptive unless substantiated. Borderline omissions: 'family-owned' / 'locally owned' (factually verifiable, not per-se deceptive); 'A+ BBB rating' (true claims OK but format conventions matter — recommend counsel-reference); 'voted #1' (depends entirely on the underlying poll — counsel-reference); 'no money down' / 'zero down financing' (TILA Reg Z advertising rules govern these — out of scope for home-services corpus, would land in a separate consumer-credit rule). State contractor-board advertising rules (e.g. GA Rule chapter 553 requiring license number in advertising) intentionally not literal-matched here — license number formats vary per state and require workspace context the scanner does not have at corpus-load time; counsel: open question on whether a workspace-scoped rule belongs in a follow-on PR.",
};
