import type { ComplianceRule } from "../../types";

/**
 * Attorney-client privilege — common law / Restatement-based summary.
 *
 * Privilege is distinct from the Rule 1.6 confidentiality duty — privilege
 * is an evidentiary protection in litigation, governed primarily by common
 * law (federal) or state evidence codes (FRE 501 incorporates common-law
 * privilege; state privilege rules vary).
 *
 * Routing entry: sentinel uses this to flag drafts that risk waiving
 * privilege through inadvertent disclosure, third-party CC, or sharing
 * with the agent acting outside a Kovel-type arrangement.
 */
export const rule: ComplianceRule = {
  ruleId: "attorney-client-privilege",
  title: "Attorney-Client Privilege — common-law elements and waiver",
  summary:
    "The attorney-client privilege protects confidential communications between a client (or prospective client) and the lawyer made for the purpose of obtaining or providing legal advice. Privilege is waived by voluntary disclosure to third parties and may be inadvertently waived; certain agency-like third parties (interpreters, accountants under Kovel) may be brought within privilege.",
  jurisdiction: "federal-statute",
  scope: { kind: "federal" },
  citation: {
    source: "FRE 501 (privilege under federal common law); Restatement (Third) of the Law Governing Lawyers §§ 68–86; Upjohn Co. v. United States, 449 U.S. 383 (1981); United States v. Kovel, 296 F.2d 918 (2d Cir. 1961)",
    url: "https://www.law.cornell.edu/rules/fre/rule_501",
    accessedAt: "2026-05-12",
  },
  literalText: `[ROUTING / SUMMARY — needs counsel for literal] Substance:

Federal Rule of Evidence 501 provides: "The common law — as interpreted by United States courts in the light of reason and experience — governs a claim of privilege unless any of the following provides otherwise: the United States Constitution; a federal statute; or rules prescribed by the Supreme Court. But in a civil case, state law governs privilege regarding a claim or defense for which state law supplies the rule of decision."

The attorney-client privilege requires (per the Restatement (Third) of the Law Governing Lawyers § 68): (a) a communication, (b) made between privileged persons, (c) in confidence, (d) for the purpose of obtaining or providing legal assistance for the client.

Waiver: The privilege is waived by voluntary disclosure of privileged material to non-privileged third parties (Restatement § 79). Inadvertent disclosure may also waive privilege depending on the jurisdiction's adopted test (the majority Hopson/middle-ground test considers the reasonableness of the producing party's precautions). Federal Rule of Evidence 502 provides a federal rule against subject-matter waiver from inadvertent disclosure where reasonable steps to prevent and rectify were taken.

Third-party agents under Kovel: a non-lawyer assistant (interpreter, accountant, sometimes other consultants) may be brought within privilege when the assistant is necessary or highly useful for the effective consultation between the client and the lawyer regarding which the latter has been professionally consulted (United States v. Kovel, 296 F.2d 918 (2d Cir. 1961)).`,
  drafterNotes:
    "Counsel: this is intentionally a routing/summary entry rather than a 'literal' since privilege rests on case law and Restatement, not a single quotable statute. If sentinel needs a true literal anchor, the most natural is FRE 501 itself. Recommend a parallel state-law privilege literal (O.C.G.A. § 24-5-501 — Georgia's attorney-client privilege statute) be added in a follow-up.",
};
