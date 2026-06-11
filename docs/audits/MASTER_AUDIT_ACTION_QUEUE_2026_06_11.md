# Master Audit Action Queue — 9-Lens Site Audit — 2026-06-11

**Method:** 9 expert-lens extractions (Sales / Marketing / Design+Creative / Product Delivery / Operations / Accounting / Legal / Customer Support / Compliance-Risk) over live agentplain.com + app surfaces + `origin/main`, run in 3 waves, then **every load-bearing finding re-verified end-of-day against `main@47237e0` / prod `cabf36f`** (PRs #219–#236 landed mid-audit — statuses below are post-merge truth, not the wave-time snapshot).
**Companion reports:** `docs/audits/audit_<lens>_2026_06_11.md` (9 files, each with its own drift-check + effort section).

## TL;DR

1. **The site warms buyers up well, then contradicts itself exactly where trust is decided** — the money moment (3 surfaces tell 3 different card/trial stories; vertical pages quote $299/quote-walls against /pricing's $199), the promise (compliance scanners described in present tense that fire nothing for 9/10 verticals; the home-services flagship still silently never fires), and the help path (live chat is key-paused on every surface; every help route 404s). Only Compliance/Risk cleared the 4/5 bar (4/5); the rest sit 2.5–3.6.
2. **Customer-existential count: 6 open P0s + 1 half-cleared** — and 5 of the 7 are copy or one-line fixes that fit in ONE "Truth Wave" PR; the other two are Conner gate-flips (Anthropic key, trial-truth/Stripe-env decision).
3. **Total effort to clear P0+P1: ~5 PRs / ~5 eng-days + ~1 hour of Conner decisions + 2 external engagements** (counsel packet, testimonial asks). The brand wave (#227–#234) and fleet-runs-fleet merges (#219/#224) already cleared a third of the original findings mid-audit.

---

## Lens scoreboard (vs the 4+/5 bar)

| Lens | Score | Lens | Score |
|---|---|---|---|
| Sales | 2.5 | Accounting | 2.5 |
| Marketing | 3.6 | Legal | 2.5 |
| Design+Creative | 3 (→ ~4 post-#227–#234) | Customer Support | 2.5 |
| Product Delivery | 2 of 14 claims NOT delivered (was 3) | Compliance/Risk | **4 ✓** |
| Operations | 3 | | |

---

## P0 — Ship-blocking (customer cannot trust the product until fixed)

| # | Item | Status @ EOD | Fix | Effort | Lenses |
|---|------|--------------|-----|--------|--------|
| P0-1 | **One truth for the money moment.** "First month free / no commitment" CTAs vs /terms "card captured at signup" vs in-app "no card required" vs prod silently running the add-card-later fallback (Vercel Stripe env). | **OPEN** | CONNER DECISION: ratify add-card-later (recommended — it's what prod does and makes every "no commitment" line true) OR fix the Stripe env. Then align /terms, /pricing, sign-up hero, in-app billing header. | Decision + ~2h copy | Sales#1 · PD#5 · Acct#2/5 · Legal#5 |
| P0-2 | **Kill vertical→tier pricing.** /cpa + /home-services render $299 Partner, /law + /ria render a Max quote-wall — contradicting /pricing AND wired into billing (`flows.ts:101`). The banned mapping, live, reaching Stripe. | **OPEN** (verified live on /cpa today) | 4 `content.ts` tier fields → `"regular"`; delete the `flows.ts:101` content-tier→billing flow. | ~1h | Sales#3 · Mkt#1 · PD#4 · Acct#3 · Legal#5 — **5 lenses, the top dedup item** |
| P0-3 | **Registry truth — flagship skills must fire.** | **HALF-CLEARED:** `invoice-chase-general` now `runtime:'live'` (`registry.ts:687`) ✓. `home-services-estimate-followup` (`registry.ts:1019`) **still has no runtime field → still silently never fires** (it's also the readiness flagship, so home-services signups now waitlist — honest, but the page still sells it). #223's CI guard still unmerged. | One line (`runtime:'live'`) + land the #223 registry-truth guard so the class (3 occurrences now) can't recur. | ~1h + merge | PD#1/2 · Ops#1 |
| P0-4 | **Restore the Anthropic key.** 🔑 `POST /api/chat` → `degraded:true` "Plaino's resting" — re-verified live at EOD. Marketing chat, in-app support chat, L1 auto-answer, onboarding first-fire: all dead. | **OPEN — CONNER ONLY** | Restore/fund key + budget alarm so the next pause is caught before customers see it. | Minutes | PD#3 · Support#1 · Ops |
| P0-5 | **Legal accuracy trio.** (a) OpenAI is an active subprocessor (embeds customer document text) missing from /privacy's named list — the homepage FAQ admits it, the policy omits it; (b) /security + /privacy claim knowledge-substrate docs are AES-256-GCM at rest — `KnowledgeDocument.body` is plaintext; (c) /security claims "read-and-draft" email scopes (actual `gmail.readonly`) and "never write scopes" (Drive MCP has `files.create`). Per-se FTC §5/UDAP exposure; (c) also sits in Google's OAuth-review packet. | **OPEN — all three re-verified live/on-main at EOD** | Three copy corrections (OpenAI line; scope the AES claim; fix scope wording). Real `KnowledgeDocument.body` encryption = P1-9. | ~1h | Legal#1/2/4 |
| P0-6 | **Present-tense compliance-scanner claims on 9 verticals.** `ria/content.ts:281` "the SEC Marketing Rule corpus flags them… never becomes a filed advertisement", law "privilege-aware compliance pass", cpa "Circular 230 slip is corrected at the draft stage", property-management "the fair-housing scanner flags it" — controls that fire NOTHING (`isVerticalLiveAllowed()` true only for real-estate). The honesty gradient is inverted: homepage tells the truth, purchase pages overstate. | **OPEN** (ria:281 + law:128 re-verified verbatim at EOD) | Port the homepage's "loaded as drafts — they don't fire until counsel red-lines them" qualifier to all 9 pages; present→future tense; soften the absolutes; cut the 6 sentences enumerated in the compliance report §7. | ~2h | Compliance#1/4 · Legal |
| P0-7 | **Metered-billing disclosure policy.** A live env-gated pipeline posts billable per-token Stripe meter events when `STRIPE_USAGE_METER_ENABLED=true`; zero public surface discloses any usage component; the documented token-vs-subscription margin gap is the standing incentive to flip it. | **OPEN** | CONNER DECISION: commit publicly to "no usage charges" (gate the meter behind a contract change) OR add fair-use/metered language to /pricing + /terms now. The in-app MeteringNotice already has the honest language — promote it public. | Decision + ~1h | Acct#1 |

**Cleared mid-audit (was P0, now done):** invoice-chase registry entry (P0-3a) · main-undeployable ApprovalCard block (#224) · integration self-heal absent from prod (#224) · stale "agentic/independent brokerage" OG copy (brand wave).

## P1 — High-impact (the 4+/5 bar stays broken until these land)

| # | Item | Fix | Effort | Lenses |
|---|------|-----|--------|--------|
| P1-1 | **Zero social proof.** No logo, testimonial, named customer, or count anywhere; only proof is the founder's own brokerage. | Start testimonial asks now (external); interim "see the product" screenshot strip (~2h, assets exist). | Days–weeks external | Sales#2 · Mkt |
| P1-2 | **Support front door.** No header Help link; `/help /docs /faq /contact /status` all 404 (re-verified EOD); 3 different response windows across 5 surfaces; in-app degraded chat lead-captures a paying customer; `/help` gated to BROKER_OWNER. | One PR: Help link, one window ("1 business day"), support-mode degraded branch → working /help form, role-gate drop, upset-customer FAQ entries. | ~1 day, 1 PR | Support#1–5 |
| P1-3 | **Status page + external monitor.** `/api/health` green on both hosts and nothing probes it; status.agentplain.com refused. | CONNER 15 min: Better Stack/Instatus + CNAME + footer link. Cheapest high-trust win in the audit. | 15 min + 1-line PR | Ops#3 · Support |
| P1-4 | **Customer-visible failure surface.** Activity feed renders successes only — a failed/never-firing skill is indistinguishable from a quiet day. (Integration self-heal half is now SHIPPED via #224.) | Render `failed`/`skipped` states (~1d); then point the heartbeat's per-workspace signal at the customer (2–3d). | 1d + 2–3d | Ops#1/2 |
| P1-5 | **Buying-motion coherence.** Partner/Max CTAs are raw `mailto:` (pricing:154/189/200); /about says "not a self-serve platform" vs self-serve checkout; 4-button closing CTA. | Route Partner/Max into the /custom form; reconcile the /about line; 1 primary + 1 secondary CTA. | ~3h | Sales#4 |
| P1-6 | **Brand remainder.** Two-Plainos / crop artifact / favicon: **FIXED** (#231/#232). Remaining: vertical-page hero art (10 highest-intent pages still open imageless — verified EOD) + homepage monotony. | Creative wave via creative-router (no improvised SVG). | 2–3d | Design#3 |
| P1-7 | **ROI consistency + site-wide disclaimer.** One reconciled range + the /cpa "illustrative" line applied to /pricing + homepage. (Re-grep first — copy churned in the brand waves.) | In Truth Wave. | ~1h | Mkt#4 · Legal#5 |
| P1-8 | **Tax posture.** No `automatic_tax`, no `tax_id_collection`, no disclosure — while selling to CPAs. | Stripe Tax + one-line disclosure; nexus decision (CONNER + accountant). | ~1d + decision | Acct#4 |
| P1-9 | **Encrypt `KnowledgeDocument.body`** (the real fix behind P0-5b) — the most sensitive payload is the one not app-encrypted. | Extend `payload-crypto` + migration. | 2–3d | Legal#2 |
| P1-10 | **Counsel pack** 🔴 (one engagement, 6 items): policy review; DPA + subprocessor exhibit; US-state privacy rights; AS-IS/no-warranty/no-reliance + indemnification; §7216 + privilege language; **red-line the live real-estate HUD corpus** (`counselReviewer: null` — the one live scanner is the least-gated). | CONNER: engage counsel; handoff machinery exists (`scripts/render-counsel-handoff-packets.ts`). | Engagement + ~1wk counsel | Legal#3 · Compliance#2/3 |
| P1-11 | **Pricing-page money footnote.** Refund policy, trial-charge timing, tax, cancellation + 7-day grace — all true in /terms or code, none visible at the decision point. | One footnote block on /pricing + /custom. | ~1h, in Truth Wave | Acct#3/5 |

## P2 — Quality bar

- **Public KB / help topics** from the existing `RepoKbLoader`/`PRODUCT_KB` substrate as indexable `/help/[topic]` — serves stuck customers AND is the answer-engine/long-tail SEO surface Marketing flagged. One build, two lenses. ~3–5d.
- **Per-vertical FAQPage JSON-LD** (~2h, existing builder); deeper: vertical guides + comparison pages ("vs DIY Claude", "vs hiring a VA"). Quarter-scale content engine.
- **Demo path** — no-signup sandbox or recorded walkthrough; screenshot strip is the interim.
- **Homepage monotony** — 2–3 heritage scenes; trim the knowledge-substrate stat panel (Sales + Design both flagged it).
- **Small-fixes batch:** `/login` → redirect `/app/sign-in`; `security@` alias; derive /pricing Partner bands from `tiers.ts`; drop "~35 cron-fired agents" (about:113 — violates own no-counts rule); /custom "$199→$99" arrow; per-output "draft, not advice" line; `OPERATOR_EMAIL_ALLOWLIST` → shared inbox + named backup.
- **SOC 2 pursuit** — gates procurement in 6 regulated verticals; posture built, attestation missing. Start the clock.
- **Wire CPA month-end-close + law conflict-screen callers' depth** — flagships registered but verify cadence/dispatch end-to-end with real data once the key is live.

## P3 — Polish

USD currency stated once; sitemap lastmod; drop robots `Host:`; delete dead logo iterations; motion (taste call); annual-plan self-serve; /custom payment-terms detail; legal-page version history.

---

## Deduplicated cross-lens findings (the real P0s)

| Finding | Lenses that independently flagged it |
|---|---|
| Vertical→tier pricing (P0-2) | **5** — Sales, Marketing, Product Delivery, Accounting, Legal |
| Card/trial money-moment contradiction (P0-1) | **4** — Sales, Product Delivery, Accounting, Legal |
| Dead chat / paused key (P0-4) | **3** — Product Delivery, Support, Operations |
| Silent non-firing flagship skills (P0-3) | **2** — Product Delivery, Operations |
| Scanner claims vs reality (P0-6) | **2** — Compliance, Legal |
| Zero social proof (P1-1) | **2** — Sales, Marketing |
| No status/SLA surface (P1-3) | **2** — Operations, Support |
| Two-Plainos brand break (now fixed) | 2 — Design, Support |

Convergent diagnosis across all nine: **strong top-of-funnel, contradictions at the commitment moment.** The site never lies about what the product is — it lies (mostly by drift) about price, charge timing, what fires, and what's encrypted.

## New capabilities needed (Phase D input — prevent recurrence)

1. **Registry-truth CI guard (#223)** — already written, just not on main. Asserts every sweep slug resolves to a `runtime:'live'` catalog entry. The bug class has now bitten 3 times.
2. **Claims-vs-code drift sentinel** — a weekly cron that greps customer-facing `content.ts`/policy pages for a maintained claims manifest (scanner tense, subprocessor list, encryption scope, scope wording, tier fields) and diffs against runtime truth (`isVerticalLiveAllowed`, knowledge provider config, OAuth scope constants). This audit found 7 instances of exactly this class; a 2-day build ends the genre.
3. **Canonical billing-facts module** — one source (`lib/billing/facts.ts`) for trial timing, card capture, refund, grace, tax line; /pricing, /terms, sign-up, and the in-app billing header all render from it. Kills the three-surfaces-three-stories failure mode structurally.
4. **Brand gate (exists — #228/#234)** — proof this pattern works; the pre-push gate took brand drift to zero in one wave. Replicate for claims (item 2).

## Fix-wave assignments (fires on Conner's nod — none auto-fired)

| Wave | Contents | Executor | Size |
|---|---|---|---|
| **FW-1 "Truth Wave"** | P0-1 copy + P0-2 + P0-3 one-liner + P0-5 + P0-6 + P1-7 + P1-11 + P2 small-fixes. All copy/one-liners, one worktree, one PR. **Highest value-per-token PR available.** | 1 Opus agent | ~1 day, 1 PR |
| **FW-2 "Conner gates"** | P0-4 key · P0-1 trial-truth decision · P0-7 meter policy · P1-3 status page (15 min) · #223 merge-or-rebuild · counsel engagement (P1-10) · testimonial asks (P1-1) · tax decision (P1-8) | **Conner, ~1 hour total** | — |
| **FW-3 "Trust surfaces"** | P1-2 support bundle + P1-4 phase 1 + P1-5 buying motion | 1–2 Opus agents | ~2 days, 2 PRs |
| **FW-4 "Brand remainder"** | P1-6 vertical hero art via creative-router | creative-router (+human if heritage register) | 2–3d |
| **FW-5 "Growth + KB"** | P2 KB surface + FAQ JSON-LD + content engine | content agents (Sonnet drafts OK) | ~1 wk |
| **FW-6 "Hardening"** | P1-9 encryption + P1-4 phase 2 + P1-8 Stripe Tax + SOC 2 kickoff | eng agents | ~1 wk |

## Conner decision queue (ranked by value-per-minute)

1. **Restore the Anthropic key** — revives chat/support/first-hour everywhere. (minutes)
2. **Nod FW-1 Truth Wave** — one PR clears most of P0. (seconds)
3. **Pick the trial truth** — add-card-later (recommended) or fix Stripe env. (minutes)
4. **Status page + monitor** — 15 min, closes Ops' cheapest gap.
5. **Metered-billing policy** — "no usage charges" vs fair-use clause. (one decision)
6. **#223** — merge if alive, else queue the 1-day rebuild.
7. **Engage counsel** with the P1-10 packet.
8. **Start testimonial asks** with any design partner who'll go on record.

## Ledger corrections recorded this audit (memory-critical)

- **FLEET-RUNS-FLEET final state:** #216–#222 + #224 + #225 merged; **only #223 unmerged** (#235 superseded by #224). Earlier wave ledgers ("#219/#223/#224/#225 not merged") were correct at wave-time but are now stale — #219/#224/#225 landed 2026-06-11 mid-audit.
- **Of the three 2026-06-10 SIGNUP-TO-GO killers:** key-paused **still true**, home-services schema-only **still true**, invoice-chase missing **FIXED**.
- **Brand wave #227–#234** cleared the Design lens's top issues (two Plainos, crop artifact, favicon, stale OG SVG, placeholders) mid-audit.
- **#226** added property-management (Buildium + rent-collection flagship) → supported verticals: real-estate, cpa, law, property-management + general on-ramp.
- The served dynamic OG was always clean; only the (now-fixed) static SVG mirror was stale.
