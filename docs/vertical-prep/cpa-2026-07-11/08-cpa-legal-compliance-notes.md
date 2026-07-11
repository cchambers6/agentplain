# 08 — CPA-specific legal + compliance notes

> **Status: COUNSEL-GATED.** This file is internal prep — a map of the CPA-specific legal terrain beyond the standard packet, drafted by the fleet from public statute and regulator materials. **Nothing here is legal advice, and no line here reaches a customer-facing surface, sales call, or contract until counsel has reviewed it.** Statute and rule cites below were assembled in good faith and must be independently verified by counsel — treat every cite as "believed correct, unconfirmed." The existing legal posture holds: the DPA workstream is hard-stopped until portal RLS is enforced in CI (legal head plan, PR #360), and CPA activation *adds* to that counsel queue rather than jumping it.

## 1. IRC §7216 — the one most likely to surprise

**The headline: the moment the fleet reads a client email thread containing tax-return information, agentplain itself very likely becomes a "tax return preparer" under a federal criminal statute.**

- §7216 makes knowing or reckless *disclosure or use* of tax return information by a preparer a **criminal misdemeanor** (fine up to ~$1,000 and up to a year of imprisonment per violation, as enacted), with a parallel civil penalty in §6713 (per-disclosure dollar penalty with an annual cap; amounts periodically adjusted — verify current figures).
- The Treasury regulations under §7216 (the §301.7216 series) permit a preparer to disclose return information to a **contractor performing "auxiliary services" in connection with tax return preparation** — which is plausibly exactly what a drafting service touching season correspondence is. The load-bearing consequence in the regs: **the contractor receiving the information becomes subject to §7216 itself.** The criminal exposure doesn't stay at the firm; it attaches to us.
- Practical implications counsel must resolve **before the first CPA workspace connects an inbox** (not before the first email send — outreach itself touches no client data):
  1. Whether our service fits the auxiliary-services/contractor lane or whether firms need **§7216-compliant written client consents** (which have prescribed formats and timing rules) for any use beyond it.
  2. What contract language the design-partner letter and ToS need so the firm's own §7216 posture is clean when they connect email that inevitably contains return information.
  3. Whether any internal use of workspace data (e.g., the account's own memory/learning loop) needs framing as "use" under §7216 — the two-bucket data positioning likely helps here, but that's counsel's call, not marketing's.
- **Sales-side rule until cleared:** the objection-library C2 answer (doc 04) — honest deferral, no statute analysis on calls, log every written ask as the demand signal.

## 2. Treasury Circular 230 — mostly an asset, one obligation

- **§10.36 (procedures to ensure compliance)** effectively expects firms to have adequate procedures over their practice. The approval queue is a §10.36-shaped artifact: every client-bound draft passes a credentialed reviewer. Once counsel blesses the framing, this is a *selling* point — the architecture matches what the firm's regulator already expects of them.
- **§10.22 (diligence as to accuracy)** and **§10.37 (written advice standards)** define the line the fleet must never cross: drafting routine client correspondence and status/chase communications is one thing; anything that constitutes *tax advice* or a position (penalties under **IRC §6694**: $1,000 unreasonable-position / $5,000 willful-or-reckless, per return, against the preparer — the figures already cited in `lib/verticals/cpa/content.ts` ROI copy) stays entirely human. Product framing already says this ("the fleet drafts; the CPA makes the filing determination and signs") — counsel should confirm the wording on the /cpa page's compliance FAQ survives §10.37 scrutiny.
- **Disciplinary reality:** Circular 230 discipline (censure → suspension → disbarment from practice before the IRS) attaches to individuals. This is why the CPA buyer reads the approval gate as self-protection — and why no marketing sentence may ever imply the fleet "handles compliance."

## 3. GLBA / FTC Safeguards Rule — the vendor-diligence door we'll be walked through

- CPA firms and tax preparers are **"financial institutions" under the Gramm-Leach-Bliley Act**, subject to the FTC Safeguards Rule (16 CFR Part 314, as amended 2021/2023): a written information security plan (WISP), a designated qualified individual, risk assessments, access controls, encryption expectations, **and service-provider oversight** — meaning we land in their vendor inventory and their WISP's service-provider section the day they sign.
- The IRS reinforces this through **Pub 4557 (Safeguarding Taxpayer Data)** and the PTIN-renewal data-security attestation; the FTC's 2023 amendment added **breach reporting to the FTC** (unencrypted incidents at a threshold headcount of consumers, on a fixed clock — verify current numbers).
- **What to prepare (activation checklist feeds counsel this):** a one-page service-provider security summary a firm can staple into its WISP — subprocessor list, the two-bucket data flow, access model, incident-notification commitment. We can't offer SOC 2 and shouldn't pretend to; the RE rule transfers: a firm whose procurement requires formal security certification is an honest not-yet.

## 4. AICPA Code of Professional Conduct

- **Confidential client information (ET §1.700 series):** the Code permits members to use **third-party service providers** on client work without specific client consent *if* the member has a contractual confidentiality arrangement with the provider and exercises due care — otherwise client notice/consent is needed. Counsel should confirm our agreement text satisfies the contractual-arrangement prong, because that single clause is what the C1 objection answer (doc 04) leans on.
- **Independence (ET §1.200 series):** matters only for firms with attest clients (audits, reviews). Our ICP excludes audit-dominant firms, but small firms often carry a handful of reviews/compilations — the honest posture: our service touches firm operations and client communications, not attest engagements, and we make no claims about independence impact. Flag to counsel; do not improvise on calls.
- **Note:** AICPA rules bind members; Georgia's board rules bind licensees. Most Georgia CPAs are both.

## 5. Georgia-specific

- **Georgia State Board of Accountancy** (O.C.G.A. Title 43, Ch. 3 and board rules) governs licensure and conduct; no Georgia-specific rule on AI-assisted client communication was found in prep research — verify at activation, because state boards are starting to issue technology guidance and a fresh check is cheap.
- **Georgia breach-notification law** (O.C.G.A. §10-1-910 et seq.) is narrower than most states' (it primarily reaches "information brokers" and data collectors for state agencies) — but the firm's *federal* obligations (Safeguards Rule) and client expectations dominate anyway; our incident-notification commitment should be written to the stricter standard.
- **No state-specific CPA advertising/disclosure rule** surfaced that would constrain our outreach copy — but the outreach makes no CPA-services claims (we aren't a firm and never imply licensure), which keeps us out of that lane entirely. Counsel confirms.

## 6. What this adds to the standard packet (the ask, in one block)

Before the first CPA workspace onboards (not before the first cold email), counsel reviews: **(a)** §7216/§6713 posture + whether design-partner terms need §7216-aware language or prescribed client consents; **(b)** the ET §1.700 contractual-confidentiality clause; **(c)** the /cpa page's compliance FAQ wording against §10.37; **(d)** the service-provider security one-pager for WISP inclusion; **(e)** use of the §6694 penalty figures on customer-facing compare pages (doc 05). Items (a)–(d) gate onboarding; (e) gates only the compare-page penalty line — the pages can ship without it.

**The sequencing honesty:** RE partner #2 signing triggers CPA *outreach*. CPA *onboarding* has this counsel gate in front of it — realistically counsel review runs during the 2–4 weeks of outreach-to-signature, so it costs nothing if started on activation day. Started later, it becomes the bottleneck. The activation checklist (doc 09) fires the counsel notice on day 1 for exactly this reason.
