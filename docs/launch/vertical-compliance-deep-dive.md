# Vertical Compliance Deep-Dive

> Draft for outside counsel review. 2026-06-14. Companion to `legal-risk-prelaunch-review.md`.
> Covers the 5 launch verticals + property management + a note on "general."
> **All disclaimer text below is DRAFT — counsel must ratify exact wording before it ships.** Nothing here is legal advice.
> Product grounding: the compliance engine is `lib/agents/sentinel/` (one `loadCorpusFor` + scanner + per-vertical counsel sign-off gate). Today only real-estate's *flag* rules are verified-live; auto-rewrite is gated for every vertical behind env + a durable counsel sign-off row (`counsel-signoff.ts`, fail-closed).

**The cross-vertical golden rule:** agentplain **drafts; it does not send, and it does not give professional advice.** Every disclaimer below reinforces human-in-the-loop, licensed-professional supervision, and the draft-only autonomy boundary. That boundary is the legal spine of the whole product.

---

## 1. Real estate

**Regulatory landscape.** State real-estate licensing law (brokers/agents); **Fair Housing Act (FHA)** + HUD + state fair-housing analogs; **MLS rules + data-licensing (IDX/RETS/RESO)**; TCPA/CAN-SPAM for any outreach (we draft, customer sends); state advertising rules (license # on ads). The agent operates **under the broker's license and supervision** — agentplain is a tool, the broker holds liability.

**Compliance requirements.** (a) No discrimination — listing copy, lead routing, and tenant/buyer comms must not steer or signal protected-class preference. (b) MLS content used only within license terms; no scraping/redistribution beyond the data agreement. (c) Truthful advertising; broker identification where required. (d) Human broker reviews before anything sends.

**AI disclosure (federal + state).** No single federal AI-disclosure mandate yet, but FTC deception rules apply to AI claims. State "bot"/AI-transparency laws (CA and the 2025–26 wave) require disclosing automated interaction. Fair-housing enforcement increasingly scrutinizes **algorithmic** decisions — AI-generated listing/marketing copy is squarely in scope.

**Customer-facing disclaimers (DRAFT — paste-ready, counsel to ratify):**
> *"Plaino drafts listing copy, replies, and marketing for your review. You and your broker are responsible for reviewing every item for Fair Housing compliance and accuracy before it is sent or published. Plaino does not make housing decisions and will not include protected-class preferences. MLS data is used only as permitted by your MLS agreement."*

> *(On AI-generated content):* "AI-assisted draft — review before sending."*

**Risk hotspots.** 🔴 **Fair Housing in AI listing copy** (steering language, "exclusive/perfect for [demographic]," proximity-to-X framing that proxies protected class). 🔴 **Lead routing** that could correlate with protected class. 🟠 MLS data licensing overreach. 🟠 missing broker license # on advertising.

**Counsel sign-off checklist.** [ ] Approve the real-estate rewrite corpus (HUD literals) to enable auto-rewrite (record sign-off row). [ ] Approve broker-supervision/liability language in ToS. [ ] Confirm MLS data-use representations. [ ] Approve fair-housing disclaimer wording.

**Do NOT promise in marketing.** ❌ "Fair-housing-compliant copy guaranteed" / ❌ "fully automated listings" / ❌ "we handle MLS for you." ✅ "drafts fair-housing-aware copy for your review," ✅ "flags fair-housing risks before you publish."

---

## 2. CPA / accounting

**Regulatory landscape.** **IRS Circular 230** (practice before the IRS); **IRC §7216** (criminal restriction on use/disclosure of tax-return information) + §6713; **AICPA Code of Professional Conduct** (confidentiality, due care); state board of accountancy rules; GLBA Safeguards (FTC) for financial data. The agent works **under the CPA's professional responsibility** — it does not "prepare returns" as a preparer.

**Compliance requirements.** (a) Tax-return information may not be used or disclosed beyond preparing the return without specific **§7216 consent**. (b) Confidentiality of client data. (c) The CPA exercises professional judgment on everything — no unreviewed advice. (d) Records/workpaper integrity.

**AI disclosure.** FTC deception rules; state AI-transparency laws. No CPA-specific federal AI-disclosure mandate, but AICPA guidance pushes transparency about AI use in engagements; the **client should know AI assisted** and that a CPA reviewed.

**Customer-facing disclaimers (DRAFT):**
> *"Plaino assists with bookkeeping, month-end close, and document organization, and drafts items for your review. It is not a CPA and does not provide tax or accounting advice. A licensed CPA must review all work before it is relied upon or filed. Client tax-return information is processed only to perform the engagement and is not used or disclosed except as permitted by law (IRC §7216) and your consent."*

**Risk hotspots.** 🔴 **AI-prepared returns** framing — never imply the agent files or signs returns. 🔴 **§7216** — any use of return data beyond the engagement (e.g. cross-sell, model training) needs explicit consent; confirm we don't. 🟠 confidentiality of connected QuickBooks/financial data. 🟠 "advice" language that crosses into professional opinion.

**Counsel sign-off checklist.** [ ] Confirm §7216 posture (no out-of-engagement use; consent text if any). [ ] Approve "not a CPA / CPA-review-required" disclaimer. [ ] Approve confidentiality + data-handling representations. [ ] Sign CPA rewrite corpus before enabling auto-rewrite (else flag-only).

**Do NOT promise in marketing.** ❌ "AI-prepared/AI-filed tax returns," ❌ "replaces your bookkeeper/CPA," ❌ "tax advice." ✅ "prepares your month-end close for CPA review," ✅ "drafts, your CPA approves."

---

## 3. Law

**Regulatory landscape.** **Unauthorized Practice of Law (UPL)** — state-by-state; **ABA Model Rules / state RPC** (esp. 1.1 competence, 1.6 confidentiality, 5.3 supervision of non-lawyer assistance, 5.5 UPL, 7.x advertising); attorney-client privilege; conflicts of interest. The agent is **non-lawyer assistance supervised by the attorney** — it must never practice law.

**Compliance requirements.** (a) **No legal advice** to end-clients — intake/conflict-screening output is attorney-reviewed. (b) Attorney supervises all AI work (Rule 5.3). (c) Strict confidentiality + privilege preservation. (d) No conflict created/missed by automated intake. (e) Advertising rules if any client-facing copy.

**AI disclosure.** Many state bars now issue AI ethics opinions requiring **disclosure of AI use** and competence/supervision. Client-facing AI interactions should disclose they're automated and not legal advice. Some jurisdictions require client consent for AI processing of confidential matter info.

**Customer-facing disclaimers (DRAFT):**
> *"Plaino assists your firm with client intake, conflict screening, and document drafting for attorney review. Plaino is not a lawyer, does not provide legal advice, and does not create an attorney-client relationship. A licensed attorney at your firm must review and approve all output before it is acted on or sent. Information you provide is handled confidentially and is reviewed by your attorney."*

> *(Intake chat, client-facing):* "You're chatting with an automated assistant, not an attorney. This is not legal advice and does not create an attorney-client relationship."*

**Risk hotspots.** 🔴 **UPL line** — the single highest-severity exposure across all verticals; any client-facing output that reads as legal advice is a serious problem. 🔴 **confidentiality/privilege** of matter data through OAuth-connected systems. 🟠 conflict-screen false-negatives. 🟠 attorney-advertising rules in client copy.

**Counsel sign-off checklist.** [ ] Approve UPL-safe / "not legal advice / no attorney-client relationship" disclaimers (both internal + client-facing intake). [ ] Confirm attorney-supervision model satisfies RPC 5.3. [ ] Approve confidentiality + privilege handling representations. [ ] **Recommend launch law in flag-only / no-rewrite mode** until corpus signed. [ ] State-by-state UPL review for any client-facing surface.

**Do NOT promise in marketing.** ❌ "legal advice," ❌ "replaces a paralegal/attorney," ❌ "automated legal answers," ❌ "handles your cases." ✅ "drafts intake + conflict screens for attorney review," ✅ "your attorney approves everything."

---

## 4. Home services

**Regulatory landscape.** State/local **contractor & trade licensing** (HVAC/plumbing/electrical/GC/roofing); home-improvement consumer-protection statutes (contracts, cancellation rights, deposits); lien/notice rules; TCPA/CAN-SPAM for outreach (we draft, customer sends); estimate/warranty representations. Lower regulatory density than the licensed-professional verticals, but **consumer-protection and licensing-claim risk is real**.

**Compliance requirements.** (a) Don't make or imply **trade-license claims** the business doesn't hold. (b) Estimates/quotes are drafts, not binding offers, unless the business approves. (c) Truthful pricing; comply with home-improvement contract rules (right to cancel, deposit limits) where applicable. (d) Permit/insurance representations must be the business's own.

**AI disclosure.** General FTC + state AI-transparency. Lower bar than regulated verticals, but AI-drafted estimates/quotes to consumers should be reviewed and not presented as professional certification.

**Customer-facing disclaimers (DRAFT):**
> *"Plaino drafts estimates, follow-ups, and scheduling messages for your review. Estimates are drafts only and are not binding until you approve and send them. Plaino does not perform licensed trade work and makes no licensing, permit, or warranty representations on your behalf — those are yours to confirm."*

**Risk hotspots.** 🟠 **local licensing** representations (implying a license/permit the business lacks). 🟠 binding-quote ambiguity (an AI "estimate" treated as a contract). 🟠 deposit/cancellation-rights compliance in consumer contracts. 🟡 outreach consent (customer-sent).

**Counsel sign-off checklist.** [ ] Approve licensing/permit disclaimer. [ ] Approve "estimate is a draft, not a binding offer" language. [ ] Confirm consumer-contract representations are the business's, not ours.

**Do NOT promise in marketing.** ❌ "licensed estimates," ❌ "guaranteed pricing," ❌ "we handle permits/licensing." ✅ "drafts estimates and follow-ups for your review," ✅ "books jobs into your system on your approval."

---

## 5. Finance / RIA (wealth)

**Regulatory landscape.** **Investment Advisers Act of 1940** (SEC-registered RIAs) + state adviser rules; **fiduciary duty**; SEC **Marketing Rule (206(4)-1)** (testimonials, performance claims, no misleading advertising); Reg S-P / GLBA (client data privacy); books-and-records (204-2). The **investment-advice trigger** is the bright line: the moment output constitutes individualized investment advice, the full adviser regime attaches.

**Compliance requirements.** (a) **Never give individualized investment advice** — the agent drafts client communications/updates, the adviser owns all advice. (b) Marketing Rule compliance on any performance/testimonial content (the weekly-report ROI framing intersects here for the *adviser's own* clients). (c) Fiduciary care; conflicts disclosed. (d) Client-data privacy (Reg S-P). (e) Recordkeeping.

**AI disclosure.** SEC has signaled scrutiny of "AI-washing" (overstating AI capability is itself a violation) and conflicts in AI use. Client-facing AI comms should disclose automation and that an adviser reviews; never imply AI provides advice.

**Customer-facing disclaimers (DRAFT):**
> *"Plaino drafts client updates, scheduling, and administrative communications for your review. Plaino is not an investment adviser and does not provide investment advice or recommendations. A licensed adviser at your firm must review and approve all client communications. Nothing Plaino produces should be construed as individualized investment advice."*

**Risk hotspots.** 🔴 **investment-advice trigger** — any output that reads as a recommendation pulls in the full adviser regime; the corpus must hard-stop this. 🔴 **Marketing Rule** on testimonials/performance in adviser-client content. 🟠 Reg S-P client-data handling. 🟠 "AI-washing" — don't overstate what the agent does.

**Counsel sign-off checklist.** [ ] Approve "not investment advice / adviser-review-required" disclaimer. [ ] Define + encode the investment-advice hard-stop in the corpus. [ ] Review any performance/testimonial content for Marketing Rule. [ ] Confirm Reg S-P data handling. [ ] **Launch RIA gated** until corpus signed (recommend not in the first GA wave).

**Do NOT promise in marketing.** ❌ "investment advice/recommendations," ❌ "AI portfolio management," ❌ "replaces your adviser," ❌ overstated autonomy ("AI-washing"). ✅ "drafts client updates for adviser review," ✅ "handles RIA admin so you advise."

---

## 6. Property management

**Regulatory landscape.** State/local **landlord-tenant law** (notices, deposits, entry, eviction process — highly state-specific); **Fair Housing Act** + state analogs (applies to *tenant* communications, screening, advertising); FCRA if tenant screening touches consumer reports; security-deposit accounting rules. **Buildium is BYO** (customer connects their own) — we read/draft, the PM acts. The agent operates under the PM's authority.

**Compliance requirements.** (a) **Fair Housing in tenant comms** — no discriminatory language in listings, screening messages, or replies. (b) Landlord-tenant procedural compliance (notice periods, deposit handling) is the PM's responsibility; our drafts must not misstate legal requirements. (c) FCRA adverse-action rules if screening output is used. (d) State-specific notice/eviction wording is jurisdictional — never assert it as settled.

**AI disclosure.** FTC + state AI-transparency; Fair Housing enforcement of algorithmic tenant decisions is active. AI-drafted tenant comms should be reviewed; AI must not make housing decisions.

**Customer-facing disclaimers (DRAFT):**
> *"Plaino drafts tenant communications, rent reminders, and listings for your review. You are responsible for reviewing every item for Fair Housing compliance and for the landlord-tenant laws of your jurisdiction before it is sent. Plaino does not make tenant-screening or housing decisions and does not provide legal advice on notices, deposits, or evictions."*

**Risk hotspots.** 🔴 **Fair Housing in tenant comms** (screening/steering language). 🔴 **jurisdiction-specific landlord-tenant** missteps (wrong notice period/deposit rule stated as fact). 🟠 FCRA adverse-action if screening. 🟠 deposit-accounting representations.

**Counsel sign-off checklist.** [ ] Approve Fair Housing + landlord-tenant disclaimer. [ ] Confirm no housing/screening decision is automated. [ ] Flag state-specific legal text as `unverified` until counsel supplies per `feedback_no_guesses_no_estimates`. [ ] **Launch PM gated** until corpus signed.

**Do NOT promise in marketing.** ❌ "handles evictions/notices," ❌ "tenant screening decisions," ❌ "fair-housing guaranteed," ❌ "legal notice templates." ✅ "drafts tenant comms for your review," ✅ "flags fair-housing risks."

---

## 7. "General" (cross-vertical) — note

The `general` vertical (invoice chase + office admin) fires live but has **no industry-specific regulatory corpus** — it's horizontal admin. Risks are the cross-vertical baseline: truthful claims, AI disclosure, draft-only autonomy, data privacy, and **don't let a "general" customer in a regulated profession bypass the per-vertical guardrails** (a lawyer signing up as "general" still triggers UPL concerns). The signup vertical-gate + readiness resolver should route regulated-profession signups to the vertical with its corpus, not let them sit in unguarded "general." Counsel: confirm the general AUP + AI-disclosure covers the baseline, and that vertical mis-selection can't strip a regulated user of their corpus.

---

## Summary: launch-readiness by vertical

| Vertical | Live caller? | Corpus | Recommended GA posture |
|---|---|---|---|
| Real estate | ✅ | flag-live; rewrite gated | GA — enable rewrite once corpus signed |
| General | ✅ | n/a (horizontal) | GA — baseline AUP/AI-disclosure |
| CPA | ✅ | DRAFT | GA in **flag-only / no-rewrite**; sign corpus to unlock |
| Law | ✅ | DRAFT | GA in **flag-only / no-rewrite**, UPL disclaimers hard-required; highest-risk |
| Home services | ⚠️ no live caller | DRAFT | hold until caller + licensing disclaimers |
| Finance / RIA | ⚠️ no live caller | DRAFT | **gate** — investment-advice trigger; not first wave |
| Property mgmt | ⚠️ no live caller | DRAFT | **gate** — Fair Housing + landlord-tenant; not first wave |

**Highest-risk vertical pre-launch: Law (UPL).** An un-disclosed or unsupervised AI draft mistaken for legal advice is the most severe single exposure in the portfolio — UPL is criminal/sanctionable in many states and the harm is concentrated. Launch law only with the hard "not legal advice / no attorney-client relationship / attorney-review-required" disclaimers wired on every internal *and* client-facing surface, in flag-only mode, until counsel signs the corpus.
