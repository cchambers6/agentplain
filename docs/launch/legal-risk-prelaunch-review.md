# Pre-Launch Legal & Risk Review

> Draft for Conner + outside counsel. 2026-06-14. agentplain GA-readiness.
> Scope: every customer-facing surface, the legal documents we must publish, per-vertical compliance status, and a sign-off checklist.
> Grounding: product facts cite code/memory at the ref shown. **This is not legal advice** — it is an engineering+product risk map *for* counsel to act on.

---

## How to read this

Three risk tiers are used throughout:

- **🔴 BLOCKER** — must be resolved (or the surface gated off) before taking a dollar at GA.
- **🟠 REVIEW** — counsel must review and approve specific language before GA; ships once signed.
- **🟡 HARDEN** — not a launch blocker, but a known exposure to close in the first 30–60 days.

A standing fact that touches several surfaces: **the production `ANTHROPIC_API_KEY` is paused today**, so customer-facing LLM output is degraded/mocked. Any surface that implies live AI output is, right now, making a claim the system can't honor. That is a 🔴 truth-in-advertising issue until the key is restored or the surfaces are honestly badged as limited.

---

## Section A — Customer-facing surfaces, by what counsel must sign off

### A1. Homepage & marketing claims — 🔴 / 🟠
**What's there:** outcome claims ("does the work," "get your time back"), ROI framing (the positioning memo cites a $2,900–$10,600/mo per-seat value range), and capability language.
**Counsel needs to sign off on:**
- Substantiation of every quantified ROI/value claim — FTC endorsement & "results not typical" exposure. No average-results number without a documented basis.
- "Does the work" / autonomy language vs. the reality that **every action is drafted, not sent** — the copy must not imply unattended execution.
- Any comparative claim referencing Anthropic/Claude must match the locked positioning ("built on Claude, configured by us"; **never** "alternative to / replaces Claude") — also a trademark-use question.
- **Degraded-key truth:** while the key is paused, "AI drafts your replies" must be honestly qualified or the surface gated.

### A2. Vertical landing pages — 🔴
**What's there:** per-vertical pages promising a killer workflow.
**Counsel + product must sign off on:** that a page only promises what **fires live for that vertical**. Today only **real-estate, general, CPA, law** have a live production caller (`lib/verticals/readiness.ts`). A vertical page promising an outcome we can't fire is both a consumer-protection claim problem and a refund magnet. **Rule:** no vertical page sells a workflow whose readiness resolver returns unsupported.

### A3. Pricing page — 🟠
**What's there:** three tiers (Solo/Regular, Partner, Max) + /custom; per-seat ladder; "first month free."
**Counsel needs to sign off on:**
- Auto-renewal / negative-option compliance (FTC "click-to-cancel," CA ARL, and similar): card-on-file at signup + auto-converting trial requires **clear and conspicuous** disclosure of price, renewal cadence, and a frictionless cancel path *before* charge.
- Trial terms exactly as built: **7-day default, 14-day CPA+Law, 14-day money-back, card at signup.** The disclosed terms must match the billing code, per-vertical.
- "First month free" must state what happens at day 8/15 in plain language. Banned: "pilot pricing/fees."

### A4. Signup / Terms of Service acceptance — 🔴
**Counsel needs to sign off on:** the ToS itself (see Section B), the **clickwrap** mechanism (affirmative checkbox, dated, versioned, logged — not browsewrap), and that the consent record is durable and reproducible for a given user+version. Enforceability of every downstream limitation depends on this being done right.

### A5. OAuth / data-connection disclosure — 🔴
**What's there:** the fleet connects to Gmail/M365/QuickBooks/CRM/DocuSign etc. via OAuth.
**Counsel needs to sign off on:**
- The just-in-time consent screen language: exactly what scopes we request, what we read, what we store, and what we do **not** do (no outbound send from our side).
- **Google API Services User Data Policy / "Limited Use"** compliance and the **Microsoft 365 / Graph** equivalents — restricted/sensitive scopes (Gmail) may require a **CASA security assessment**; this is a hard gate for go-live on those scopes.
- Token handling representations (encrypted at rest, revocation path) must match the implementation before we represent them to the user.

### A6. Demo / seeded-data disclaimer — 🟠 (🔴 while key paused)
**What's there:** seeded test workspaces and (today) degraded LLM output.
**Counsel needs to sign off on:** a clear "sample/illustrative data — not real output" disclaimer wherever demo or mocked content appears, so no prospect mistakes seeded drafts for a guarantee of their own results. Elevated to 🔴 today because the paused key means even "live" surfaces may render non-representative output.

### A7. AI disclosure on the approval queue + chat — 🔴
**What's there:** Plaino drafts in the approval queue; marketing + in-app support chat (`/api/chat`).
**Counsel needs to sign off on:**
- A persistent, clear **"AI-generated — review before sending"** disclosure on every drafted artifact and chat surface. Several states (e.g. **CA "Bot" disclosure" law, and 2025–26 state AI-transparency statutes**) and sector rules require disclosure that the user is interacting with AI.
- The disclosure must be load-bearing in regulated verticals (legal/CPA/RIA) where an un-disclosed AI draft could be mistaken for professional advice.

### A8. Weekly report / ROI substantiation — 🟠
**What's there:** weekly value/ROI reporting to the customer.
**Counsel needs to sign off on:** the methodology behind any "we saved you $X / Y hours" figure. If it's modeled, label it modeled; if measured, show the basis. An unsubstantiated savings number in a recurring report is a per-customer deception claim, repeated weekly.

### A9. Support SLA honesty — 🟠
**What's there:** support expectations; the Conner-time constraint means **standing human service is gated to Max/Custom**.
**Counsel needs to sign off on:** that Solo/Partner support promises match what's actually staffed. Don't promise human support hours on a tier that is fleet-only. The SLA doc (Section B) must reflect the tiered reality.

### A10. Billing / refund clarity — 🟠
**Counsel needs to sign off on:** refund mechanics (14-day money-back) stated unambiguously, proration on cancel, and that the **auto-refund leak-path** (paying-but-unserved workspaces get refunded, `readiness.ts`) is described accurately — it's a consumer-favorable control worth disclosing.

### A11. Account deletion / data rights (GDPR/CCPA) — 🔴
**Counsel needs to sign off on:** a working **delete-my-account + delete-my-data** path and the privacy-rights request flow (access, deletion, opt-out of sale/share — we don't sell, but must say so). CCPA/CPRA applies to CA residents; GDPR if any EU data. The published right must match a real, tested deletion path, including revoking OAuth tokens and purging connected-system caches.

---

## Section B — Required legal documents

| Doc | Status need | Notes for counsel |
|---|---|---|
| **Terms of Service** | 🔴 publish + clickwrap | Limitation of liability, disclaimer of warranties, **"not professional/legal/tax/financial advice"** carve-out, acceptable autonomy scope (draft-only), arbitration/venue, termination. |
| **Privacy Policy** | 🔴 publish | What we read via OAuth, what we store, retention, subprocessors, CCPA/CPRA + GDPR rights, no-sale statement, contact for requests. |
| **Acceptable Use Policy (AUP)** | 🔴 publish | Prohibited uses; mirrors Anthropic's usage policy (we're downstream of it); per-vertical prohibited automations (e.g. no unsupervised legal/tax advice). |
| **SLA** | 🟠 publish (tiered) | Uptime target, support response by tier — **human support only where actually staffed (Max/Custom)**; honest about fleet-only tiers. |
| **DPA (Data Processing Addendum)** | 🔴 available | We are a **processor** of customer + their clients' data. Standard Contractual Clauses if EU; sub-processor flow-down; breach-notification terms. |
| **Subprocessor list** | 🔴 publish | At minimum: **Anthropic** (model), **Vercel** (hosting), **Neon** (database), **Stripe** (billing), **Resend** (email), plus any OAuth-connected providers acting as our subprocessors. Keep current; notify on change. |
| **AI Use Disclosure** | 🔴 publish | Plain-language: what the AI does, that output is drafted not sent, human-in-the-loop, limitations, no professional-advice guarantee. Referenced from each A7 surface. |
| **Cookie/tracking notice** | 🟡 | If analytics/marketing cookies are used. |
| **Trademark/brand use note** re: Anthropic | 🟡 | Confirm permitted use of "Claude"/"Anthropic" marks under the locked "built on Claude" positioning. |

**Cross-cutting:** the **subprocessor list and the DPA must name the same vendors the code actually calls.** A subprocessor list that omits a live vendor (or names one we dropped) is a misrepresentation. Reconcile against `lib/integrations/` + `lib/llm/` + `lib/billing/` before publishing.

---

## Section C — Per-vertical compliance corpora status

Ground truth from `lib/agents/sentinel/`: **all 10 vertical corpora exist**, but only **real-estate's literal rules are verified/live** for *flagging*; the other nine are DRAFT (`unverified`) and fire nothing. Separately, **auto-rewrite (drafting replacement legal text) is gated for *every* vertical including real-estate** behind a two-layer gate — env allow-list (`COMPLIANCE_CORPUS_COUNSEL_REVIEWED`) **plus** a durable per-vertical DB counsel sign-off row (`counsel-signoff.ts`, pfd-5, fail-closed). **Note:** pfd-5 removed the old "real-estate is baseline-exempt" carve-out; the compliance memory still describes that exemption and is **stale on this point** — the code (no exemption) is authoritative. Reconcile the memo.

| Vertical | Corpus state | What counsel must sign off | Tier |
|---|---|---|---|
| **Real estate** | Flag rules live (HUD fair-housing literals); rewrite gated | Broker partnership/liability model; **Fair Housing in AI-generated listing copy**; **MLS data licensing** for any MLS-sourced content; sign the rewrite corpus to enable auto-rewrite | 🔴 |
| **CPA / accounting** | DRAFT (fires nothing) | **Circular 230** duties; client **confidentiality / §7216** on tax-return info; "not a substitute for a CPA's professional judgment" | 🔴 before CPA sells rewrite |
| **Law** | DRAFT (fires nothing) | **UPL (unauthorized practice of law)** line — agent must not give legal advice; **attorney supervision** model; intake/conflict-screen output is attorney-reviewed | 🔴 before law sells rewrite |
| **Home services** | DRAFT (fires nothing) | **Local licensing** representations; no implied trade-license claims; estimate/quote language disclaimers | 🟠 |
| **Finance / RIA** | DRAFT (fires nothing) | **RIA / fiduciary** duties; the **investment-advice trigger** — agent must never cross into individualized investment advice; Reg-compliant disclosures | 🔴 before RIA sells |
| **Property management** | DRAFT (fires nothing) | **Landlord-tenant** law (state-specific); **Fair Housing in tenant communications**; security-deposit/notice handling | 🔴 before PM sells |
| Mortgage / Insurance / Title-Escrow | DRAFT (corpora exist) | Out of the 5-vertical launch scope; keep gated. Mortgage = TILA/RESPA/LO licensing; Insurance = producer licensing; Title = state escrow rules | gated |

**The pattern counsel must internalize:** the system is **fail-closed**. A vertical cannot draft replacement legal language until counsel both (a) verifies its corpus rules and (b) records a durable sign-off row. Launch can proceed with verticals in "flag-only / no-rewrite" mode and an honest in-product banner (`COUNSEL_GATED_BANNER_TEXT`) — but the **marketing must not promise compliance rewriting for a gated vertical** (ties to A2).

---

## Section D — Pre-launch checklist (Conner + counsel)

**🔴 Blockers — clear before charging at GA:**
- [ ] ToS, Privacy Policy, AUP, AI Use Disclosure **published**; clickwrap wired with versioned, logged consent (A4/B).
- [ ] DPA available + Subprocessor list published and **reconciled to the vendors in code** (B).
- [ ] OAuth consent screens + Google "Limited Use" / Microsoft Graph compliance reviewed; CASA assessment scoped if sensitive scopes used (A5).
- [ ] AI disclosure persistent on approval queue + chat (A7); demo/seed disclaimer live (A6).
- [ ] Account-deletion + data-rights flow **tested end-to-end**, incl. OAuth-token revocation + cache purge (A11).
- [ ] Vertical pages gated to live-readiness verticals only (A2); no page sells a gated rewrite (C).
- [ ] Auto-renew/trial disclosures (per-vertical 7/14-day, card-at-signup, 14-day money-back) match billing code and click-to-cancel rules (A3).
- [ ] **Anthropic key restored** OR all "live AI" surfaces honestly badged as limited (truth-in-advertising).
- [ ] Counsel sign-off rows recorded for any vertical marketed as compliance-rewriting (real estate first).

**🟠 Review — counsel-approved language before GA:**
- [ ] Homepage ROI/value claims substantiated (A1); weekly-report savings methodology labeled (A8).
- [ ] SLA tiered to actual staffing; no human-support promise on fleet-only tiers (A9/B).
- [ ] Refund/proration language unambiguous (A10).
- [ ] Anthropic trademark-use review for "built on Claude" copy (A1/B).

**🟡 Harden — first 30–60 days:**
- [ ] Audit-log immutability (per the production-growth plan hardening gap).
- [ ] Key-rotation / restore drill (un-drilled today).
- [ ] Cookie notice if tracking added.
- [ ] State-by-state AI-transparency statute monitoring (the 2025–26 wave).

**Decision items only Conner can resolve:**
- [ ] Confirm counsel of record for broker + GA corpus, and name advisors honestly on Slide 9.
- [ ] Confirm the Conner-time service boundary in the SLA (Max/Custom only) is contractually stated.
- [ ] Pick launch verticals: recommended GA set = the four with live callers (**real-estate, general, CPA, law**), with CPA/Law in flag-only/no-rewrite mode until their corpus is signed.

---

### Biggest legal/compliance gap blocking GA (builder's read)

**The single largest gap is the consent-and-claims spine, not any one vertical rule:** there is sophisticated fail-closed compliance *machinery* (`sentinel`, counsel-signoff gate, readiness resolver) but the **outward-facing legal layer — published ToS/Privacy/DPA/AI-disclosure, clickwrap consent capture, OAuth "Limited Use" review, and a tested data-deletion path — is what's missing**, and every one of those is a hard gate for taking money. Close that spine and the verticals can launch in honest flag-only mode behind it. The highest-risk *vertical* is **law (UPL + attorney-supervision)**, where an un-disclosed or unsupervised AI draft mistaken for legal advice is the most severe single exposure — see the deep-dive.
