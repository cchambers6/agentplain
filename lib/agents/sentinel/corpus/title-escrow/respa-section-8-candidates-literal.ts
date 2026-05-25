import type { ComplianceRule } from "../../types";

/**
 * RESPA § 8 (12 USC § 2607) + 12 CFR § 1024.14 — title/escrow candidate
 * triggers focused on referral-fee / kickback / thing-of-value language.
 *
 * DRAFT, UNVERIFIED. Sentinel WILL NOT fire on these — the scanner skips
 * `unverified: true` rules. Candidate list for counsel red-line.
 *
 * RESPA § 8(a) (12 USC § 2607(a)): "No person shall give and no person
 * shall accept any fee, kickback, or thing of value pursuant to any
 * agreement or understanding, oral or otherwise, that business incident
 * to or a part of a real estate settlement service involving a federally
 * related mortgage loan shall be referred to any person."
 *
 * § 8(c) carves out (1) bona-fide compensation for services actually
 * rendered, and (4) affiliated business arrangements that comply with the
 * disclosure / sole-source / pricing requirements of § 8(c)(4) and 12 CFR
 * § 1024.15.
 *
 * Title/escrow advertising and producer outreach is the high-risk surface
 * for RESPA § 8 violations — phrases that on their face describe a
 * compensation-for-referral arrangement are the canonical literal triggers.
 */
export const rule: ComplianceRule = {
  ruleId: "respa-section-8-title-escrow-candidates",
  title: "RESPA § 8 — candidate title/escrow referral-fee triggers (DRAFT)",
  summary:
    "Candidate literal phrases drafted from RESPA § 8(a)'s anti-kickback prohibition and § 8(c)(4)/12 CFR § 1024.15's affiliated-business-arrangement disclosure regime. Sentinel does NOT fire on these until counsel red-lines.",
  jurisdiction: "federal-statute",
  scope: { kind: "federal" },
  citation: {
    source: "12 USC § 2607 (RESPA § 8); 12 CFR § 1024.14 and § 1024.15",
    url: "https://www.ecfr.gov/current/title-12/chapter-X/part-1024/subpart-B/section-1024.14",
    accessedAt: "2026-05-25",
  },
  literalText:
    "[DRAFT — needs counsel] 12 USC § 2607(a): No person shall give and no person shall accept any fee, kickback, or thing of value pursuant to any agreement or understanding, oral or otherwise, that business incident to or a part of a real estate settlement service involving a federally related mortgage loan shall be referred to any person.\n\n12 USC § 2607(b): No person shall give and no person shall accept any portion, split, or percentage of any charge made or received for the rendering of a real estate settlement service in connection with a transaction involving a federally related mortgage loan other than for services actually performed.\n\n12 USC § 2607(c)(4) (affiliated business arrangement carve-out): Nothing in this section shall be construed as prohibiting ... affiliated business arrangements so long as (A) a disclosure is made of the existence of such an arrangement ... (B) such person is not required to use any particular provider ... (C) the only thing of value that is received from the arrangement ... is a return on the ownership interest or franchise relationship.\n\nCandidate trigger phrases below are nominated from these prohibitions but have NOT been counsel-verified.",
  purpose: "literal-match",
  unverified: true,
  category: "referral-arrangements",
  triggers: [
    "referral fee",
    "referral bonus",
    "kickback",
    "thing of value",
    "we'll pay you for the referral",
    "we will pay you for referrals",
    "pay you per closing",
    "pay per closing",
    "split the fee",
    "fee split",
    "marketing services agreement",
    "co-marketing agreement",
    "desk rental",
    "lead purchase agreement",
  ],
  drafterNotes:
    "Drafted 2026-05-25. 'Referral fee', 'kickback', and 'thing of value' are direct § 8(a) statutory-text triggers — any literal use of these phrases in title/escrow outreach is a flag. 'Marketing services agreement' (MSA) and 'co-marketing agreement' are NOT per-se illegal but are the CFPB's primary RESPA-§ 8 enforcement vehicle (see PHH Corp. and Wells Fargo MSA actions, 2014–2015) — flagging them prompts the operator to confirm the arrangement meets the § 8(c)(2) bona-fide-services and fair-market-value standards. 'Desk rental' similarly: legitimate per CFPB FAQ if rent is at FMV for actual desk usage; literal-match flag prompts confirmation. Phrases intentionally held back for counsel: 'affiliated business arrangement' (legitimate term of art with required disclosure form — recommend counsel-reference rule to verify Form RESPA-1 is attached, not a literal-match alarm); specific dollar amounts (require structured parsing).",
};
