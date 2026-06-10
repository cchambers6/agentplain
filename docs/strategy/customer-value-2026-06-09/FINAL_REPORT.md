# Master build — final report: what's perfect, what's still rough

**Build window:** 2026-06-09 night → 2026-06-10. **Output: 13 PRs (#201–#213), all CI-green, all mergeable.** 11 build waves fired; 11 shipped at the 4+/5 customer bar; 0 shipped below it; 4 below-bar gaps were caught by coordinator verification and fixed before opening PRs.

## The honest question: how many verticals hit "I'd pay $500/mo for just this"?

**5 of 10 are code-complete on their killer workflow — with one shared caveat.**

| Vertical | Killer workflow | Where it honestly stands |
|---|---|---|
| general | Wake up to chased invoices | **Code-perfect.** Live QuickBooks REST → tiered drafts → auto-exec-ready → $ in payload → Monday digest. Rough edge: needs `BOUNDED_AUTO_EXECUTE_MASTER=on` to be literal "wake up to" rather than "wake up to approve." |
| realty | First touch in 5 minutes | **Code-perfect, smallest diff of the night** (the hole was one `persister: null` × 3 sweeps). FUB is live. Rough edge: Gmail-Drafts staging needs `LIVE_INBOX_FETCH` + consent. |
| home-services | No estimate dies unanswered | **Code-complete incl. cron.** Rough edge: QB Estimates path is test-server-verified; first live workspace fire is the remaining proof. |
| cpa | Close assembles itself | **Code-complete over the real TaxDome/Karbon read contracts**, honestly narrower than the ideal (no contact-roles/sign-off fields in the contracts). The magical version (email-attachment detection) is one Gmail consent away. |
| law | Never take a conflicted client | **Code-complete and defensible** (cited matches, UNSCREENED can never read as clear). Rough edge: ledger derives from ingested files until a Clio-class MCP lands — value starts when files land. |
| property-mgmt / title-escrow / ria / insurance / mortgage | (specs in #201) | **Not built — deliberately.** Each is credential-gated; building them tonight would have been unverifiable scaffolding, the exact failure mode the pride audit named. READY ON UNLOCK. |

**The shared caveat — and the build's most honest sentence:** every "code-complete" above is *test-and-contract-verified, not live-customer-verified*. That gap is now closable on demand: #211 (seeded-login harness) makes every auth-gated surface verifiable against a real deployment, and #213 (post-key registry) makes the LLM layer's restoration a checklist. The fleet built the product AND the instruments to prove the product.

## What's genuinely perfect
- **The trust chain is whole:** per-workspace autonomy controls (#204) → bounded execution under owner-set ceilings → immutable audit ("what Plaino did autonomously") → Monday proof digest with real dollars (#208) → activation card that shows a new customer the one thing that matters (#209 + #212, deterministic, works with the LLM off). That loop — set autonomy, watch it work, see the dollars — is the product thesis, and it is now continuous code with 400+ new tests across it.
- **Zero schema migrations across 13 PRs.** Every wave found a no-migration design (scoped flag names, existing kinds, existing surfaces). The failure mode that killed prior runs never appeared.
- **The bar held.** Three waves came back "done except the last visible mile" (unwired cron, unmounted renderer, clear-on-empty-ledger). All three were caught and finished before PR. One wave's 5/5 was held to 4 by the coordinator. No PR ledger-padding.

## What's still rough
1. **Live verification** — nothing has been watched working on a deployed preview with a real session. Run: merge #211, then `tests/e2e/smoke-authenticated.ts` against a preview (env vars in the script header). This is the single highest-value hour available.
2. **Auto-execute is still globally OFF** — correct until you decide, but "wake up to chased invoices" reads as "wake up to approve chased invoices" until `BOUNDED_AUTO_EXECUTE_MASTER=on` (+ per-class enables; per-workspace safe after #204).
3. **The merge queue is yours** — 13 PRs; #203→#207→#208 sequentially (one-line `app/api/inngest/route.ts` conflicts), #212 after #209, rest any order.
4. **Five verticals wait on five credentials** — Buildium remains the 15-minute unlock that ships a vertical same-day.
5. **LLM polish layers everywhere are dark** — by design (flag-gated, template fallbacks), verified restorable via #213's 27-surface checklist the moment the key returns.

## The decision queue (unchanged, ranked by value-per-minute)
1. Buildium key (~15 min) → property-mgmt same-day
2. `BOUNDED_AUTO_EXECUTE_MASTER=on` + `AUTO_EXEC_FOLLOW_UP_NUDGE` → the autonomy thesis goes live
3. `ANTHROPIC_API_KEY` restore → run #213's checklist → RIA + every LLM path
4. Gmail/M365 consent → CPA attachments + realty live drafts
5. Qualia; EZLynx/Encompass partner applications (slow-burn)

## Dropped → FUTURE (below the bar, on purpose)
Media/Insights org-chart activation · new verticals · visual-slot wiring (awaiting your ChatGPT P0 sheet) · live smoke runs (need deployment env the fleet doesn't hold).
