import type { ComplianceRule } from "../../types";

/**
 * Wire-fraud / business-email-compromise (BEC) — risky wiring-instruction
 * language in title/escrow communications.
 *
 * Title and settlement agents hold and move closing funds, making them the
 * #1 BEC target in the real-estate transaction. A draft that transmits or
 * "updates" wiring instructions by email, without an independent
 * phone-verification step and the standard anti-fraud warning, is exactly
 * the surface fraudsters spoof. This rule flags that language so the
 * operator confirms verified instructions and a wire-fraud warning are
 * present before anything goes out.
 *
 * DRAFT, UNVERIFIED. Sentinel WILL NOT fire on these — the scanner skips
 * `unverified: true` rules. Candidate list for counsel red-line.
 *
 * Anchor authority is ALTA's published wire-fraud guidance (Rapid Response
 * Plan for Wire Fraud Incidents + sample wire-fraud warnings), verified
 * live on 2026-06-06. Georgia has NO specific wire-fraud-disclosure statute
 * (it is a caveat-emptor state); the GA state-statute mirror is therefore
 * marked [UNVERIFIED — needs counsel] below.
 */
export const rule: ComplianceRule = {
  ruleId: "wire-fraud-instructions",
  title: "Wire-fraud risk — wiring-instruction language in closing comms",
  summary:
    "Candidate literal phrases that signal risky wiring-instruction language (transmitting or 'updating' wire instructions by email) which should route to operator review to confirm the instructions were independently phone-verified to a known number and that the standard wire-fraud warning is present. Sentinel does NOT fire on these until counsel red-lines.",
  jurisdiction: "industry-standard",
  scope: { kind: "professional-body", body: "ALTA" },
  citation: {
    source:
      "ALTA Rapid Response Plan for Wire Fraud Incidents + ALTA Sample Wire Fraud Warnings (verify wiring instructions by phone to a known number before transmitting funds)",
    url: "https://www.alta.org/topics/wire-fraud",
    accessedAt: "2026-06-06",
  },
  literalText:
    "[DRAFT — needs counsel] ALTA wire-fraud guidance (Rapid Response Plan for Wire Fraud Incidents; Sample Wire Fraud Warnings, alta.org, accessed 2026-06-06): wiring instructions should NEVER be sent or changed by email alone. Before transmitting funds, all parties must confirm wiring instructions by phone directly with the settlement office using a known, trusted phone number — never a number contained in the email itself — and every communication touching wiring instructions should carry the standard wire-fraud warning.\n\n[UNVERIFIED — needs counsel] Georgia state mirror: Georgia has no statute specifically mandating a wire-fraud disclosure at closing (GA is a caveat-emptor state). The GA 'good funds' rule (closing attorney may not accept >$5,000 other than by wire) is a related control but is NOT a disclosure mandate. Counsel to confirm whether any GA Department of Insurance bulletin or Bar guidance imposes a wire-fraud-notice obligation, and to supply the citation if so.\n\nCandidate trigger phrases below are nominated from this guidance but have NOT been counsel-verified.",
  purpose: "literal-match",
  severity: "advisory",
  counselReviewStatus: "draft",
  unverified: true,
  category: "wire-fraud",
  triggers: [
    "wire your funds to",
    "updated wiring instructions",
    "change in wiring instructions",
    "new wire instructions",
    "send the wire to",
    "updated wire instructions",
    "revised wiring instructions",
    "please wire the funds to",
  ],
  triggerRegexes: [
    {
      pattern: "(updated|revised|changed|new)\\s+(wire|wiring)\\s+(instructions|details|info)",
      flags: "i",
      description:
        "Catches any 'updated/revised/changed/new wire(ing) instructions/details/info' construction — the classic BEC lure — beyond the fixed phrase list.",
      example: "Per our last call, here are the revised wire details for closing.",
      counterExample: "Here are the revised closing details and the meeting time.",
    },
    {
      pattern: "(wire|send)\\s+(your |the )?(funds|money|payment|balance)\\s+to\\b",
      flags: "i",
      description:
        "Catches a direct instruction to wire/send funds to an account — should never go out without independent phone verification and the wire-fraud warning.",
      example: "Please wire the funds to the account on the attached form today.",
      counterExample: "Please bring the funds to the closing table on Friday.",
    },
  ],
  safeRewrite:
    "Never transmit or change wiring instructions by email. Route any draft touching wire instructions to operator review to confirm (1) the instructions were verified by an outbound phone call to a KNOWN, trusted number for the settlement office — not a number from the email — and (2) the standard ALTA wire-fraud warning is included. Tell recipients to independently call your office to confirm any instructions and to treat any 'updated/changed' instructions as suspicious until verbally verified.",
  drafterNotes:
    "Drafted 2026-06-06. Anchor authority verified live: ALTA Rapid Response Plan + Sample Wire Fraud Warnings (alta.org/topics/wire-fraud) — instruct verbal verification to a known number before transmitting funds. The GA state-statute mirror is intentionally [UNVERIFIED]: a live search found NO Georgia statute mandating a wire-fraud disclosure (GA is caveat-emptor); the related GA 'good funds' >$5,000 wire rule is a control, not a disclosure mandate. Counsel decision: 'wire the funds to' style phrases are advisory (lawful, but condition the phone-verification + warning duty), not blocking — severity is 'advisory' accordingly. Consider tightening the second regex if benign 'bring the funds' / 'send the documents to' copy false-positives in practice.",
};
