# 09 — CPA activation checklist

**Run this the day after RE design partner #2 signs and goes live** (kill-list trigger: 2 Georgia RE partners live — onboarded, workflow firing weekly, ≥1 real saved-time figure each; trials don't count). Until that day, this page is inert. Total effort: ~2 hours of Conner-time on day 1, one S-effort code PR during the week, sends the following Monday.

## Day 1 (the trigger day) — ~2 hours

- [ ] **1. Confirm the trigger honestly.** Both RE partners meet the kill-list's "live" definition, verified against their workspaces — not enthusiasm, the definition. If either is wobbling, CPA waits; a second vertical on a shaky first one is how both die.
- [ ] **2. Season check.** If today is Jan 15–Apr 15: run every item below except the sends, and queue sends for the first Monday after Apr 15 (soft version of the same rule for mid-Sep–Oct 15). Otherwise proceed.
- [ ] **3. Fire the counsel notice (do this first — it's the long pole).** Send counsel the doc 08 ask, items (a)–(e), with the framing: outreach starts now, first CPA workspace onboards in ~2–4 weeks, items (a)–(d) gate that onboarding. This is the "warn counsel we're broadening scope" step — done on day 1 so it runs concurrent with outreach instead of behind it.
- [ ] **4. Truth sweep of the CPA surface (verify, don't build — the S-effort fix already shipped):**
  - TaxDome + Karbon tiles still read `coming-soon` with the honest copy (`lib/integrations/marketplace.ts`; the wave-3 guardrail test pins it — flipping to `available` requires the bespoke connect forms first).
  - `/cpa` page: shipped integrations list still says QuickBooks Online + Outlook/M365 only; TaxDome/Karbon still in planned[] (`tests/vertical-routes.test.ts` pins placement).
  - `/signup?vertical=cpa` walks end-to-end; 14-day trial applies (`lib/billing/facts.ts`).
- [ ] **5. Prospect re-verification** (`02-5-named-cpa-prospects.md`): every cited fact re-checked against the live pages; the two headcount checks (CB Smith, Pereira) resolved; substitution rule applied if either fails (promote Moore CPA Firm — re-confirm its founder attribution first). All five rows into the CRM at FIRST-TOUCH-PLANNED with send dates.
- [ ] **6. Warm-map pass, CPA edition.** Ask both RE partners and the closing-attorney network one question: "who does your firm's taxes?" Any hit upgrades that row to a warm variant with the real referrer named and jumps the queue. Ten minutes; highest-leverage item on this page.
- [ ] **7. Email finalization** (`03-cpa-first-touch-emails.md`): confirm the RE-design-partner proof line reads true today; voice pass in Conner's own read; zero unresolved tokens.

## During the week — one code PR + demo prep

- [ ] **8. Ship `/compare/taxdome` + `/compare/karbon`** per spec 05: two registry entries in `lib/marketing/comparisons.ts`, new claims ledger with build-time-verified vendor facts, tests extended, voice/brand gates green. The §6694 penalty figure goes on-page **only if** counsel item (e) has cleared; otherwise the pages ship without it — they don't need it to work. *(This and the sends are the first legitimately-GTM acts — both are post-trigger by definition of this page.)*
- [ ] **9. Demo readiness call.** The autoplay demo story is RE-only today. Decide: (a) build the S-effort CPA doc-chase synthetic story before the first discovery call, or (b) run first calls on the live-queue demo path per doc 04's honesty notes. Either is fine; deciding on the call is not.
- [ ] **10. Connect-form sequencing (not a gate).** The TaxDome/Karbon bespoke connect forms (portalSubdomain / accessToken+accessKey schemas) are the real unlock behind the coming-soon tiles. Queue as an engineering item informed by discovery-call demand — do **not** block sends or pilots on it; the killer workflow runs email-native.

## The following Monday — the send block

- [ ] **11. Run the Monday block** exactly per the RE pattern (`docs/outreach/2026-07-08-monday-send/06-…`): pre-send checks per prospect (headcounts, titles, hooks), sends in the doc 03 order, CRM logged same sitting, 5/12/21 follow-up chain from actual send dates.
- [ ] **12. Book the calendar honestly.** Discovery calls land ≥3 days out; **no pilot Day 1 may collide with a 15th** (runbook Delta 4). The design-partner slot count quoted on calls is the real remaining count after RE signings — never the original five.

## Standing constraint

Everything above respects the rest of the ratified kill list: no new audit loops (KILL #1), no paid media (KILL #6 until first paid conversion), no portal work (KILL #4), no LLM-dependent feature shipping against a paused key (KILL #5 — pilot onboarding uses the same scoped per-workspace un-pause preflight as RE partner #1, caps staged before the activation call). CPA activation is the *second lane opening*, not a strategy change.
