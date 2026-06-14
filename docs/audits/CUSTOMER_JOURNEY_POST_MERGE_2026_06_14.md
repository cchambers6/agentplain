# Customer-Journey E2E Audit — Post-Merge State — 2026-06-14

**Method:** Adversarial walk of the full SMB-owner journey against `origin/main` @ `c009aeb` (after 12 PRs #240–#252 merged 2026-06-14), verified against actual source in worktree `C:\agentplain-cj-audit` **and** live prod (`agentplain.com`, `app.agentplain.com`). Every claim is cited to `file:line` or a live fetch. Prior-audit claims were re-verified, not trusted.

**Primary persona:** mid-career realtor / small-brokerage owner (5–25 transactions/yr). **Secondary (compare-where-diverges):** solo CPA, home-services owner.

**Ground truth (held throughout):**
- Prod `ANTHROPIC_API_KEY` is the `sk-ant-PAUSED-…` sentinel **by policy** (not a P0 to fix). **Degraded mode is the live customer experience** — every moment is scored on what the customer *actually* gets today, not the happy path.
- Trial business rule (stated): card-at-signup **required**, 7-day default / 14-day CPA+Law / 14-day money-back.
- Pricing: three tiers (Regular / Partner / Max) + Custom — ratified `project_stripe_both_surfaces.md` (2026-06-09).

---

## TL;DR — the one finding that matters

**12 PRs of real, well-built in-app value landed this batch — and not one of them touched a single trust-existential marketing-surface P0. All five are still live in production, verified by live fetch today.** The fleet's own launch note (`docs/launch/CONNER_TOMORROW_MORNING.md`) confirms why: **FW-1 "Truth Wave" has not fired** — it is gated on four Conner decisions that are still open. So the product a *hand-held design partner* touches got materially better (approvals, activity-failure visibility, degraded-mode honesty, a deterministic first-5-min moment, a real support ticket lifecycle); the surfaces a *cold self-serve buyer* hits (pricing, compliance claims, legal accuracy, social proof) are byte-for-byte the same contradictions the 2026-06-11 audit flagged.

**Live-prod proof (fetched 2026-06-14):** `/cpa` shows Partner **$279/$249** per-seat; `/pricing` shows Partner **$269/$239** for the *same tier* — a self-contradicting price on the path to checkout. `/cpa` still claims "a Circular 230 slip **is corrected at the draft stage**" — a scanner that fires nothing for CPA (`isVerticalLiveAllowed` is true only for real-estate). Zero testimonials anywhere.

---

## Verdict

**Design-partner-ready today? → YES (with a human in the loop).** The in-app experience is genuinely strong and honest in degraded mode. For a Max/Custom-tier partner where Conner/the team guides the sale and onboarding, the contradictions on the public marketing pages are mediated by a person, and the product itself — approval queue, activity feed, support tickets, the seeded first-5-min draft — delivers a credible "this is real" experience on day 0. Ship to a design partner you onboard by hand.

**Self-serve-ready today? → NO.** Three independent hard stops: (1) **the product cannot take money** — Stripe is flag-gated *off* (`STRIPE_BILLING_ENABLED` default false, `env.ts:140`); signup completes with zero Stripe calls. (2) **The marketing surface contradicts itself at the commitment moment** — pricing drift live, compliance over-claims live, two legal-accuracy defects live, zero social proof. (3) **The LLM is paused** — beyond the one deterministic seeded moment, the "magic" a cold buyer was promised is dormant.

**Single highest-leverage move this week → Make the four FW-1 decisions (≈20 min) and fire FW-1 "Truth Wave."** Unchanged from 2026-06-11 — *because this batch fixed none of it.* One copy PR clears P0-2 (price drift), P0-5, P0-6, P1-7, P1-11. **Adversarial caveat (new):** FW-1's instruction to "force all verticals to Regular" *conflicts with ratified memory* `project_stripe_both_surfaces.md` (three tiers are correct). Resolve the **price drift** (unambiguous bug) immediately; treat **vertical→tier anchoring** as the one genuine product decision inside FW-1 (see P0-2 below) — do not let an agent guess it.

**Open P0 count: 6** (P0-1 mandate-mismatch, P0-2, P0-5, P0-6, P0-7, plus self-serve-can't-charge). P0-4 (key) is policy, not a gap. P0-3 is down to a one-line home-services fix.

---

## Per-moment scoring

| Moment | Bar (1–5) | One-line | Top blocker to higher |
|---|---|---|---|
| Day 0 — Discovery (marketing) | **2** | Strong arc + honesty, then self-contradicts exactly where trust is decided | Compliance over-claim + price self-contradiction, live |
| Day 0 — Signup / trial / billing | **4** | Honest, fail-closed, single-source copy — but can't actually charge, and mandate ≠ code | Stripe gated off; card-required + 7/14 split unbuilt |
| Day 0 — First-5-min value (#248) | **4.5** | Deterministic seeded draft + 1-click approve + "saved 15 min" — *survives the paused key* | Only proof is labeled-sample until real data flows |
| Day 1–7 — Onboarding wizard | **2.5** | Solid structure, honest degraded copy — but real vertical-blindness bugs survive | LAW/RIA permanent dead-end CTA; always-Gmail connect |
| Day 1–7 — In-app UX (#243/#249/#250/feed/#251) | **4** | Premium daily surfaces, best-in-class degraded honesty | Customer-vocab leak on /fleet + /disciplines detail |
| Support front door (#244) | **3** | Real ticket lifecycle works LLM-free — but no public/header door | /help still BROKER_OWNER-gated; degraded chat lead-captures payers |
| Day 8–14 — Trial countdown | **4** | Honest billing-lifecycle plumbing, grace + dunning copy-consistent | Mandate split (7/14) unbuilt; flat 14-day |
| Day 15–30 — Retention | **4** | Live `/reports/weekly` ROI twin + Friday email, real hours/dollars | Overview/home has no value tally; degraded week-1 = zeros |
| Edge cases | **3.5** | Waitlist+refund honest, degraded systemic — orphan-row PII gap on closure | Support/lead tables orphan; status page absent |

---

## Moment 1 — Day 0 Discovery (marketing) — **2/5**

A realtor lands on a genuinely well-built homepage (full story arc intact, honest compliance disclaimer, Plaino present with real heritage hero + approval-moment fetch pose, `app/(marketing)/page.tsx:149,421`). The moment they click into their own vertical or `/pricing`, trust erodes.

- **P0-2 Vertical→tier pricing — STILL-OPEN (live).** `lib/verticals/cpa/content.ts:28` `tier:"plus"` → renders a Partner $299 banner via `app/(marketing)/[vertical]/page.tsx:90`; home-services identical (`home-services/content.ts:30`); `law/content.ts:31` and `ria/content.ts:30` are `tier:"max"` → a "quoted to scope" sales-wall instead of a price. A solo CPA/HVAC owner (your secondary personas) is anchored to $299, not the $199 Regular floor. **Live-confirmed:** `/cpa` shows "$299 per seat" Partner. *(See the Conner-decision note below — this one item is partly strategy, not pure bug.)*
- **Price self-contradiction — STILL-OPEN (live, unambiguous bug).** Canonical `lib/pricing/tiers.ts:111-112` = Partner $279 (2–9) / $249 (10–24). `components/vertical/PricingTierBanner.tsx:40-41` correctly shows $279/$249. But `app/(marketing)/pricing/page.tsx:43-44` **and** `lib/marketing/home-content.ts:39-40` show **$269/$239**. **Live-confirmed today:** `/cpa` = $279/$249, `/pricing` = $269/$239 for the identical Partner tier. A buyer sees one price on their vertical page and a different one on the pricing page they click to. Fix = derive both tables from `tiers.ts`. **Effort: S.**
- **P0-6 Present-tense compliance claims — STILL-OPEN (worst trust risk for this buyer).** Only real-estate fires scanners (`lib/agents/sentinel/index.ts:89` `BASELINE_LIVE_VERTICALS = {"real-estate"}`). Yet `property-management/content.ts:264` "the fair-housing scanner flags it," `ria/content.ts:281` "the SEC Marketing Rule corpus flags them," `cpa/content.ts:270` "a Circular 230 slip is corrected at the draft stage," `law/content.ts:128` "a privilege-aware compliance pass." The homepage carries the honest qualifier ("loaded as drafts — they don't fire until counsel red-lines them," `home-content.ts:67,112`) but it is **not ported to a single vertical page.** **Live-confirmed:** `/cpa` Circular 230 claim present verbatim. **Effort: S** (copy, 4 files).
- **P0-5 Legal accuracy — STILL-OPEN (2 of 3 real).** (a) **OpenAI is an active subprocessor, not disclosed** — embeddings via `lib/knowledge/openai-embedding.ts` send customer knowledge-doc bodies to OpenAI; subprocessor list `privacy/page.tsx:121-151` omits it. (b) **AES-256-GCM overclaim** — `privacy/page.tsx:95` says knowledge docs "are encrypted at rest using AES-256-GCM," but `KnowledgeDocument.body` is plaintext `String` (`schema.prisma:1394`) written verbatim (`pgvector-store.ts:104,143,152`), no cipher applied. (c) **Drive "never write scopes" is actually CLEAN** — `drive.file` (`marketplace.ts:318`) grants only app-authored files; prior claim overstated. **Effort: S** copy; **M** if real encryption.
- **P1-1 Social proof — STILL-OPEN.** No testimonial, named customer, logo, or count on any page; only proof is self-referential flatsbo dogfood (`home-content.ts:63,107`; `about/page.tsx:100-134`). Live-confirmed: none on `/cpa` or `/pricing`.
- **Banned copy — STILL-OPEN (minor).** "~35 cron-fired agents" on three live surfaces (`home-content.ts:63`, `about/page.tsx:113`, `custom/page.tsx:142`) — violates the no-agent-counts rule.

**Strengths:** radical honesty as a brand asset (the homepage disclaimer + dogfood narrative are exactly right for a liability-conscious broker — the defects are all *failures to propagate* that honesty, not dishonest strategy); complete story arc; production-quality Plaino wiring at meaningful narrative beats.

---

## Moment 2 — Day 0 Signup / trial / billing — **4/5**

The funnel is honest, fail-closed, and internally self-consistent — and that is a real improvement over the three-stories-one-money-moment state of 2026-06-11.

- **P0-1 money-moment — copy-drift FIXED; mandate-mismatch NEW.** Trial copy is now single-source + env-driven (`lib/billing/trial-copy.ts`, `sign-up/page.tsx:45-47`, `SignUpForm.tsx:247-253`) and **regression-locked** (`tests/trial-copy.test.ts`) — the "30-day, card-at-signup" lie is structurally dead. Default is *trial-first / no card* (`actions.ts:237`); card-at-signup is opt-in via `STRIPE_CHECKOUT_ENABLED` (`actions.ts:191`). Marketing "First month free / no card" CTAs now **match** the code default — no contradiction in code today. **BUT** the stated go-live mandate (card-at-signup *required*) is the opposite of the shipped default, and the **7-day / 14-day-CPA-Law split does not exist** — trial length is one flat env number (`env.ts:147-153`) applied to all verticals; grep found no per-vertical trial logic. So: self-consistent today, inconsistent with the mandate.
- **Self-serve can't charge — STILL-OPEN (P0-class).** Stripe scaffold (#241) is a real `StripeBillingProvider` (`billing/index.ts:22-28`) but dark behind `STRIPE_BILLING_ENABLED` (default false, `env.ts:140`). **A real buyer cannot pay today** (`actions.ts:174-179` short-circuits with zero Stripe calls). To take money: set `STRIPE_BILLING_ENABLED` + `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` (+ `STRIPE_CHECKOUT_ENABLED` for card-at-signup).
- **Vertical signup gating — STRONG / FIXED.** `lib/verticals/readiness.ts` derives support from registry truth (catalog `runtime:'live'` AND production-caller manifest). Supported at signup: real-estate, cpa, law + general on-ramp. **home-services correctly waitlisted** (`registry.ts:1019` has no `runtime:'live'`). Gate is fail-closed (`isVerticalSupportedSafe`, `readiness.ts:219-236`); waitlist branch runs *before* charging (`actions.ts:101-109`). **STILL-OPEN mismatch:** the home-services marketing page sells a "Start free trial" → buyer submits → only then learns they're waitlisted. Honest on money, jarring on journey.
- **P0-7 metered billing — OFF + UNDISCLOSED (latent).** Real meter pipeline exists (`stripe-usage-meter-sweep.ts` → `lib/billing/usage/stripe-meter.ts`), double-gated off (`STRIPE_USAGE_METER_ENABLED` + `_EVENT_NAME`, `env.ts:177-180`). Zero public disclosure on `/pricing` or `/terms` (grep + live: none). Fine while off; a disclosure landmine the moment it flips.
- **PAST_DUE / cancel — STRONG / FIXED.** PAST_DUE grants grace through `currentPeriodEnd` then hard-gates PAUSED (`workspace-paused-gate.ts:130-147`); dunning copy matches ("fleet keeps running through <date>," `dunning.ts:392-397`). Cancel = `atPeriodEnd:true` idempotent (`billing/actions.ts:161`). **Minor NEW:** cancel is one-click with no confirm dialog (`billing/page.tsx:291-305`); the `confirm=downgrade` guard exists only on Partner→Regular downgrade. Low-risk (reversible).

**Strengths:** single-source trial copy + regression test kills drift structurally; fail-closed registry-derived vertical gate with boot-time self-check; correctly-modeled PAST_DUE grace.

---

## Moment 3 — Day 0 First-5-min value (#248) — **4.5/5** ✦ best thing a new customer gets today

Fully deterministic, **zero LLM** — it lands in degraded mode. A new realtor hits `/welcome`, watches a staged 3-step narration, then sees a **real templated draft** ("Hi Marcus, thanks for reaching out about 418 Peachtree Way… Saturday morning or Sunday afternoon?") and approves in one click → "You just saved about 15 minutes."

- Draft from pure template functions: `lib/onboarding/demo-data.ts:602` `buildActivationDraft` → `TEMPLATES['first-touch-lead']:631`. No `llm.complete` in the path.
- Vertical-accurate seed (realtor = 1 urgent + 4 non-urgent, `demo-data.ts:92-150`); server pre-queues `ACTIVATION_DRAFT` + `SkillRun` idempotently (`activation-run.ts:68-156`); `/welcome/page.tsx:34` re-runs on load (self-heals a failed signup-time seed).
- Demo work scored **0** in the value ledger (`lib/measurement/value-impact.ts`) — never inflates real ROI. The "saved 15 min" is explicitly labeled sample data.

This is the correct call for degraded mode and the single strongest day-0 moment. **Only loss:** the proof is labeled-sample until real inbox data flows.

---

## Moment 4 — Day 1–7 Onboarding wizard — **2.5/5**

Solid structure, honest degraded copy, but real vertical-blindness bugs from 2026-06-10 survive.

- **`{partner}` literal bug — FIXED** (`onboarding/page.tsx:657` proper JSX).
- **INBOX_REQUIRED dead-picks — FIXED** (`picked-skills.ts:137` gates behind `hasInbox` → no silent 5-min timeouts).
- **LAW/RIA permanent dead-end CTA — STILL-OPEN (structural).** `killer-workflow.ts:123` (LAW) and `:176` (RIA) set `unlockedBy:null`; the connected check (`:250`) therefore *always* false → these two verticals forever show "connect your document library," deep-linking a page their own code comment says isn't required. They can never reach "see it run." **Effort: S** (treat `unlockedBy:null` as already-satisfied).
- **Vertical-blind connect step — STILL-OPEN.** `onboarding/page.tsx:541` always returns `available[0]` = Gmail; the realtor never sees FollowUpBoss (the connector that lights their actual workflow). **Effort: S/M.**
- **Realty jargon for all 10 verticals — STILL-OPEN.** `onboarding/page.tsx:482,714` render "broker-of-record review screen" unconditionally; a CPA/HVAC owner sees brokerage language. **Effort: S.**
- **Degraded first-fire — degrades gracefully, NO code leak, NO failed rows.** The four no-inbox first-fire skills never write `SkillRun` rows → status endpoint finds none → `FirstFireWatch.tsx:122` times out to calm copy ("still working… next run within 15 minutes"). The raw `UPSTREAM_LLM_ERROR: PAUSED` lives only in logs, never a DB row or the UI. *Caveat:* this makes the first-fire-watch step largely **vestigial** for no-inbox users — the real first-value moment correctly migrated to `/welcome` (#248).

**Strength:** the degraded honesty seam is well-architected (single paused-sentinel source of truth, operator copy gated behind `isOperator`).

---

## Moment 5 — Day 1–7 In-app UX — **4/5** (real value, not scaffolding)

- **#243 approval queue — FIXED (4+/5).** Genuinely mobile-first: real swipe (`ApprovalRowItem.tsx:62-94`), ≥44px targets, confidence chips + time-to-approve estimate. Batch funnels each item through the **same** audited `decideApproval` core (`actions.ts:35,49`); batch eligibility conservatively excludes money/listings/compliance/low-confidence (`presentation.ts:168`). No dead buttons found. Premium daily surface.
- **#249 connectors — FIXED.** Working Connect/Reconnect/Retry/Manage buttons; honest "Request connection / your service partner wires this" when OAuth unconfigured; pure customer-vocab status badges ("ready to connect," "reconnect needed").
- **#250 discipline cards (index) — FIXED (real).** Lucide-slug eyebrow removed; `customerStatusSentence` derived from real wiring; "Connect [Name] to start" actionable button; real `role="switch"` toggle.
- **Activity feed failed-steps (c634c26) — FIXED (P1-4 resolved).** `classifyOutcome` (`ActivityFeed.tsx:287`) renders failed rows with plain-language reasons (`ERROR_REASONS:250`, never a code dump); page-level "needs a look" banner + "issues" chip appear **only when count>0**; skips distinguished from failures; legacy rows default success (no false alarms). The "quiet day vs silent failure" gap is closed.
- **#251 plaino chat — FIXED (exemplary).** `degraded-mode.ts:114` detects the paused sentinel **before any DB write**; `talk/page.tsx:87` renders the calm notice on first load; `talk/actions.ts:77` never calls `runPlainoTurn`. No doomed turn persisted, no blank thread.

**Blocker — customer-vocab leak NEW/WORSE on /fleet + /disciplines/[id] detail.** #250 cleaned the disciplines *index* but not the *detail* page and never touched FleetMap. `fleet/FleetMap.tsx:71` group title literally "rooting"; `:133` renders raw slug "realty-drafter"; `disciplines/[disciplineId]/page.tsx:185` renders `"live":"rooting"`, `:191` raw slug. Both one tap from primary nav (`layout.tsx:19-20`). Violates ratified `feedback_customer_vocab_not_engineer` (PR #249). **Effort: S** (reuse the existing agents-page mapping + `agentDisplayLabel`).

**Blocker — compliance page still read-only.** `compliance/page.tsx:176-201` renders flags with **no** button/form/onClick (grep-confirmed). A week-1 owner can't acknowledge, resolve, or apply-the-rewrite; only path is the sibling draft in /approvals. **Effort: M.**

---

## Moment 6 — Support front door (#244) — **3/5**

PR #244 genuinely fixed the "form into the void" problem: a real customer-facing ticket lifecycle + staff inbox + SLA visibility that **works LLM-free in degraded mode** (the ticket form does not depend on the paused key). That's a meaningful step up from every help route 404-ing.

- **STILL-OPEN — no public/pre-login front door + `/help` BROKER_OWNER-gated.** A non-owner teammate or a logged-out prospect still has no working door; `/help` remains role-gated. No header Help link.
- **STILL-OPEN (prior P1) — degraded in-app chat lead-captures a *paying* customer** instead of routing to the now-working ticket form. A customer who pays then needs help is treated like a marketing lead.
- **NEW (PII) — support/lead tables orphan on workspace closure.** Teardown leaves support/lead rows behind; spawned as a separate task by the audit agent. **Effort: S.**

All three remaining blockers are S-effort copy/config/wiring, not architecture.

---

## Moment 7 — Day 8–14 Trial countdown — **4/5**

Honest billing-lifecycle plumbing: trial-expiry warnings + grace + dunning fire and are copy-consistent with the gate (`dunning.ts`, `workspace-paused-gate.ts`). **Blocker:** the mandate's 7/14 split is unbuilt (flat 14-day env). **Effort: M.**

---

## Moment 8 — Day 15–30 Retention — **4/5**

- **Live `/reports/weekly` ROI twin — IMPROVED (P0-from-2026-06-10 partly cleared).** Shows **hours-saved** (`reports/weekly/page.tsx:201,270`) and **real dollars influenced** (`:244-251`) computed on-demand from the same `computeWeeklyReportData` the Friday email uses (`:112-116`) — *not* gated on a cron. In workspace nav (`layout.tsx:26`). Dashboard and inbox can't drift.
- **#245 weekly email — real + vertical-specific**, Friday 8am ET; degrades to honest "Quiet so far / nothing to report yet" rather than an embarrassing empty send.
- **STILL-OPEN:** the workspace **home/overview** has no value tally (`overview-view.tsx:229-276` counts drafts/showings/flags only) — ROI requires navigating to a separate page; and in degraded + no-inbox week-1, all real counts are 0.

---

## Moment 9 — Edge cases — **3.5/5**

- **Unsupported-vertical waitlist + auto-refund — honest, detect-only.** Refund cron (`lib/billing/unsupported-vertical-refund.ts`) is OpsFlag-gated detect-and-page by default (auto-refund behind `UNSUPPORTED_VERTICAL_AUTO_REFUND`, off until ratified). Correct conservative posture.
- **Status page — STILL-OPEN.** `/api/health` exists and is green, but nothing external probes it and `status.agentplain.com` is unwired (Conner Better Stack setup, per launch note). **Effort: 15 min Conner + 1-line PR.**
- **Teardown PII gap — NEW** (see Moment 6).
- **Dunning emails fire** via Resend seam (`dunning.ts`), copy-consistent.

---

## Delta vs `MASTER_AUDIT_ACTION_QUEUE_2026_06_11.md`

### ✅ Fixed / materially improved this batch (the real value of #240–#252)
- **P1-4 customer-visible failure surface** — activity feed now surfaces failed/skipped honestly (`c634c26`). **Cleared.**
- **P0-1 money-moment copy-drift** — single-source env-driven trial copy + regression test; marketing CTAs now match code default. **Drift cleared** (mandate question remains).
- **Degraded-mode honesty** — now systemic and calm across chat (#251), first-fire, talk, connectors, activity. Best-in-class for a product running PAUSED. **New strength.**
- **Approval queue (#243)** — premium mobile-first daily surface with safe batch. **New strength.**
- **Connectors (#249) + discipline index (#250)** — action buttons + customer vocab. **Cleared on those surfaces.**
- **First-5-min (#248)** — deterministic seeded value moment that survives the paused key. **New strength.**
- **Support ticket lifecycle (#244)** — real LLM-free front door (replaces 404-into-void). **Partial clear of P1-2.**
- **Live `/reports/weekly`** — on-demand ROI twin. **Partial clear of the 2026-06-10 "no ROI until Monday cron."**
- **Onboarding** — `{partner}` literal + INBOX_REQUIRED dead-picks **fixed.**
- **Inngest route conflict seam refactored (#238)** — kills the recurring stacked-PR merge tax.

### 🟥 Still open (untouched — all on the marketing/trust surface)
- **P0-2** vertical→tier pricing + **price drift $269/$239 vs $279/$249** — confirmed live today.
- **P0-5(a,b)** OpenAI subprocessor omission + AES-256-GCM knowledge-doc overclaim — confirmed on main.
- **P0-6** present-tense compliance claims on 9 verticals — confirmed live on `/cpa`.
- **P0-7** metered-billing disclosure (meter off, latent).
- **P1-1** zero social proof — confirmed live.
- **P1-3** status page absent.
- **P1-9** `KnowledgeDocument.body` plaintext.
- **P1-10** counsel pack (Conner engagement).
- **P0-3** home-services `runtime:'live'` — one line, still missing (`registry.ts:1019`).

### 🔻 Worse / new since 2026-06-11
- **Customer-vocab leak NEW on /fleet + /disciplines/[id] detail** — #250 cleaned the index but not these one-tap-from-nav surfaces ("rooting," raw slugs). A *partial* fix created a *visible inconsistency*.
- **Mandate-mismatch NEW** — stated card-at-signup-required + 7/14 trial split is unbuilt; code ships no-card flat-14-day. Self-consistent, but not what go-live says.
- **Marketing sells waitlisted verticals** with "Start free trial" → buyer submits → waitlist screen (home-services + 4 others).
- **Support/lead-table orphan rows on closure** — NEW PII gap.
- **LAW/RIA permanent dead-end onboarding CTA** — carried from 2026-06-10, not prominent in the master queue; structural (`unlockedBy:null`).

---

## P0 / P1 / P2 issue queue (post-merge)

### P0 — ship-blocking for self-serve

| # | Surface | Current | Should be | Fix scope |
|---|---|---|---|---|
| P0-a | `/pricing` + `home-content.ts` vs `/cpa` (live) | Partner $269/$239 vs $279/$249 — self-contradicting | One number, derived from `tiers.ts` | **S** — delete hardcoded bands, compute from `PER_SEAT_MONTHLY_USD_CENTS` |
| P0-b | 9 vertical `content.ts` | Present-tense "scanner flags / Circular 230 corrected" — fires nothing | Homepage's "loaded as drafts, fire after counsel red-lines" qualifier + conditional tense | **S** — copy, 4 files |
| P0-c | `privacy/page.tsx` | OpenAI omitted from subprocessors; AES-256-GCM claim on plaintext `KnowledgeDocument.body` | OpenAI listed; AES claim scoped to Neon/platform level | **S** copy (P1-9 = real encryption, M) |
| P0-d | Stripe billing | `STRIPE_BILLING_ENABLED` off — cannot charge | On + keys set, aligned to trial decision | **Conner config + S** |
| P0-e | `registry.ts:1019` | home-services `runtime` missing → silently waitlisted while page sells it | `runtime:'live'` + caller, OR vertical CTA reads readiness | **S** (Conner Decision D) |
| P0-f | Trial mechanics | No-card flat-14-day ≠ mandate (card-required, 7/14 split) | Build per-vertical trial map + flip checkout, OR ratify current | **M + Conner decision** |

### P1 — 4+/5 bar stays broken until these land

| # | Surface | Current → Should | Scope |
|---|---|---|---|
| P1-a | `/fleet` + `/disciplines/[id]` | "rooting"/raw slugs → "Setting up"/"Working" + display labels | **S** |
| P1-b | Support | no public/header door; `/help` owner-gated; degraded chat lead-captures payers → working door for all, route payers to ticket form | **S–M** |
| P1-c | Onboarding | LAW/RIA dead-end CTA; always-Gmail; realty jargon for all verticals → vertical-aware | **S** each |
| P1-d | Social proof | zero → ≥1 testimonial / screenshot strip | external + **S** |
| P1-e | Status page | unwired → Better Stack + footer link | 15 min + **S** |
| P1-f | Teardown | support/lead rows orphan → delete on closure | **S** |
| P1-g | `compliance/page.tsx` | read-only flags → acknowledge/apply-rewrite action | **M** |

### P2 — quality bar
- Price-anchor: decide whether solo CPA/HVAC anchors on Partner $299 or Regular $199 (**Conner**, see note).
- Drop "~35 cron-fired agents" (3 surfaces); cancel confirm dialog; metered-billing disclosure clause before any flip; overview/home value tally; public KB `/help/[topic]` from existing `PRODUCT_KB`.

---

## The one genuine Conner decision inside FW-1 (don't let an agent guess it)

The master audit (P0-2) and the launch note instruct: "force all vertical `content.ts` tier fields to `regular`." **That conflicts with ratified memory `project_stripe_both_surfaces.md` (2026-06-09): three tiers (Regular/Partner/Max) are correct; the old single-tier ban is dead.** Two separable things hide under "P0-2":

1. **Price drift ($269/$239 vs $279/$249)** — unambiguous bug, no strategy attached. **Fix now**, derive from `tiers.ts`.
2. **Vertical→tier *anchoring*** (CPA page leads with Partner $299; law/ria with a Max wall) — this is a *product/pricing strategy* call. Archived memory `project_vertical_tier_mapping` says "do NOT enforce vertical→tier on new content," which *supports* the audit's de-anchoring — but it sits against the live three-tier model. **This needs Conner's explicit nod (FW-1 Decision C), not an agent's edit.** Surfacing it, not resolving it, is the correct move per `feedback_no_guesses_no_estimates` + `feedback_no_quick_fixes`.

---

## Bottom line

The fleet built a genuinely better *product* this week and a materially honest *degraded experience* — design-partner-ready, by hand, today. It did not touch the *storefront*, where every trust contradiction the last audit found is still live in production. The gap between those two facts is the whole story: **fire FW-1, make its four decisions (resolve the pricing-tier conflict yourself), and the self-serve storefront catches up to the product behind it in one copy PR.**
