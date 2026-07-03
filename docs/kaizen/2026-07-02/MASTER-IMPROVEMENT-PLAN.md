# Master Improvement Plan — Kaizen Synthesis (2026-07-02)

**Synthesized from:** all 10 domain retros in `docs/kaizen/2026-07-02/`.
Six were read from `origin/main` (02-product, 03-design, 04-marketing, 07-finance-ops,
09-data-analytics, 10-fleet-ops); four were read from their still-open PR heads because
they had not merged at synthesis time — 01-engineering (PR #336 @ `383aba9`),
05-sales (PR #341 @ `4e70715`), 06-customer-success (PR #339 @ `10c06cb`),
08-legal-compliance (PR #340 @ `6862cf2`). Nothing below is sourced outside those ten
documents; where a claim traces to one retro's evidence, the domain is named.

**The one-paragraph read:** the fleet builds honest, well-architected machinery and then
does not connect it. Seven of ten retros independently describe the same failure shape —
a producer with no consumer, a meter with no wire, an asset with no activation path — and
seven of ten also report that memory files their own briefs told them to load do not
exist. The wins are systemic (truth-as-code, single sources of truth, fail-closed
defaults); the frictions are systemic too (local-only gates, claims outrunning runtime,
everything decision-shaped bottlenecked on one person with no SLA). Almost nothing on
this list is a rebuild. It is wiring, gating, and cadence.

---

## 1. What's already working (top 10 across domains)

These are practices multiple domains independently flagged as wins. They reinforce each
other — protect them; do not let new process erode them.

1. **Truth is engineered, not editorial.** Every domain runs some form of it: brand/voice
   gates as executable lints (marketing, design), claims traced to `file:line` in sales
   packets (`CLAIMS_GROUND_TRUTH.md`), "drafted never sent" enforced in the weekly-report
   code path (product), `dataGaps`/"DATA MISSING" instead of invented numbers (data,
   finance), `[COUNSEL]` flags instead of pretended review (legal), and all ten retros
   correcting their own briefs rather than laundering unverified claims. This is the
   house style and the moat.

2. **Incidents become durable gates, not apologies.** Broken main → pre-push build gate;
   Neon outage → migrate gated to `VERCEL_ENV=production` (PR #307); "connected but can't
   act" → the #277 dispatch-coverage gate that turned a recurring bug class into a solved
   class (engineering, product). Zero reverts in 60 days / 667 commits — forward-fix
   discipline is real.

3. **Single-source-of-truth wins wherever it was actually applied.** Pricing ladder in
   `lib/pricing/tiers.ts`, billing policy in `lib/billing/facts.ts`, one budget
   derivation feeding both meter and gate, one nav source for the 5-tab IA, one
   aggregator behind both the Friday email and the in-app weekly page, 3-way token
   lockstep at Heritage ship time (finance, product, design, marketing). Every place a
   surface *derives* a fact instead of asserting it, drift stopped.

4. **The approval gate held under hostile audit — and under temptation.** All 10 mutating
   connectors wrap writes at the factory with payload fingerprints (product);
   "the approval gate is the product, not a footnote" is the sales pitch (sales); and
   autofire *held* the DocuSign and passkey items for Conner's call instead of firing
   them, even at 4/5 scores (fleet-ops). The highest-stakes invariant is intact at every
   layer.

5. **Defaults fail toward safety, deliberately per-layer.** Compliance rewrite is
   fail-closed behind a two-layer counsel gate; vertical readiness fails toward the
   waitlist, never toward taking money; voice recording defaults off (legal). Meanwhile
   the budget gate deliberately fails *open* so cost accounting can never take down a
   customer call (finance). The failure direction was chosen per seam, not defaulted.

6. **Worktree isolation scales.** 199 registered worktrees, every wave in its own tree,
   zero cross-wave commit pollution since the rule landed; the trap recipes (junction,
   EPERM, backslash paths) are codified and inherited (engineering, fleet-ops).

7. **The audit/kaizen machinery compounds.** The 07-02 ten-department audit produced
   findings *and* fix PRs (#322–#332) same-day with P0/P1 discipline; two would-be P0
   false positives were disproven and documented instead of filed (engineering, product).
   The org can measure itself honestly at will — that capability is an asset.

8. **Deterministic, LLM-free floors everywhere it matters.** The five live killer
   workflows run 0 LLM calls (≈95% modeled gross margin, Stripe fee — not Anthropic — is
   the largest COGS line), the vertical asset pipeline regenerates from tokens, the
   kaizen retro script runs offline for $0 (finance, product, design, data). Outage-proof
   and margin-proof by construction.

9. **Honest empty/degraded states are a product language.** The universal Plaino-resting
   banner, null meters over fabricated numbers, honest quiet-week empty states, autofire
   no-op'ing with its reasoning shown ("fired 0, $0 spent") rather than firing to look
   busy (product, CS, fleet-ops).

10. **The operating manuals were written before customer #1.** CS playbook + research
    engine, counsel-ready legal risk map + handoff packet generator, complete symmetric
    design-partner packet library, ops-grade discovery agenda (CS, legal, sales). The
    first design partner meets a rehearsed motion — the moment the activation gaps below
    are closed.

---

## 2. Cross-domain friction patterns (top 10)

Each appears in ≥3 domains. These are architectural, not local.

| # | Pattern | Source domains | The workaround people are running |
|---|---------|----------------|-----------------------------------|
| F1 | **Built-but-unwired.** Producers with no consumer: `stampSessionCost` zero call sites, Librarian charter with no executor, `recordSavedTime` writing 0 minutes for 4/7 actions, `notifyApprovalQueued` on 1 of ~8 paths, `{{CALENDLY_LINK}}` unresolved, photo utilities live but empty, health-score fully spec'd with zero implementation | finance, data, fleet-ops, product, sales, CS, design (7) | Weekly retros report "DATA MISSING"; guarantee cron offers refunds the fleet earned back; sends simply don't happen |
| F2 | **Quality gates are local-only and the bypass is routinized.** All lint/build/brand/voice enforcement lives in `.husky/pre-push`; `HUSKY=0` is a *sanctioned* recipe; a PR touching `app/` or `components/` runs zero server-side checks; invariant tests exist that no workflow executes | engineering, design, marketing, product (4) | Post-merge audit waves catch what CI should have; the portal test fails on main and nobody knew |
| F3 | **Claims outrun runtime.** `/security` absolutes live 16 days after being flagged, over open hardening gaps; BYO storage marketed with no write path; "removed on account close" while tickets survive close; present-tense compliance implied for 9 verticals when 1 fires; "first month free" surviving in old sales scripts against the ratified 7-day trial | marketing, legal, product, CS, sales, design (6) | Periodic Truth Waves re-audit ~120 claims by hand; drift returns between waves because nothing watches weekly |
| F4 | **Merge ≠ shipped.** The activation path lands in a different PR that never comes: `/how-it-works` shadowed by a stale redirect since merge day, portal 0%-activatable (zero UI callers), TaxDome/Karbon connect endpoints with no UI call sites, packet library merged 2.5 weeks with zero sends, four design review passes producing a P0 queue with nothing shipped ten days later | product, sales, marketing, design, CS (5) | None — features sit dark; reviews terminate at the doc |
| F5 | **Everything decision-shaped single-threads on Conner, with no SLA.** Founder bio, `/security` absolutes, entity, pricing headline, token approvals, cohort size, spend approvals — one queue, no cadence, no escalation; the same 5 items re-listed verbatim in every daily brief since ~06-20; a replaced PAT unrevoked 23 days | marketing, sales, legal, fleet-ops, CS (5) | The brief repeats items until the reader skims; work stalls or proceeds hedged |
| F6 | **Memory named in briefs doesn't exist; briefs carry unverified claims.** 7 of 10 retros could not load memories their briefs cited (engineering: 6 of 7 missing); one brief cited a "50+ detector insight library" that is 7 families and no library; expensive lessons (stacked-PR backmerge, junction-follow deletion) were named and never written | engineering, product, sales, CS, legal, data, fleet-ops (7) | Each retro re-derives facts from artifacts and files a "does not exist" caveat; the fleet pays to relearn |
| F7 | **Hand-maintained enumerations drift.** Gate scan-scope hardcodes 6 email files while ~8 other HTML generators kept the old palette; `brand-gate.md` documents the pre-Heritage hexes as ratified; portal clay default duplicated in 6 literals; subprocessor list missing the OpenAI embedding path | design, product, marketing, legal (4) | Per-review greps re-discover the same misses; the gate reports 0 new violations because it never looks there |
| F8 | **New surfaces ship outside the safety nets built the day before.** 9 portal tables with end-client PII landed one day after the RLS gap closed — no RLS, no teardown, no CI; nothing forces a new workspace-scoped model to register with the invariants | product, legal, CS, design (4) | Audit waves find it post-merge; the DPA is unsignable until it's fixed |
| F9 | **Zero spend/ops observability.** Week-to-date spend NULL for three consecutive weeks; re-tier audits aborted twice for lack of data; whether Vercel is green or Neon suspended is unanswerable from the repo; every dollar figure in fleet-ops is a cap, not a measurement | finance, data, fleet-ops, engineering, legal (5) | Caps stand in for actuals; the unit-economics model decays unratified; "no ceiling" is unfalsifiable |
| F10 | **Ratified doctrine lives on unmerged branches.** The two-bucket data positioning single-sources, `/data`, `/dpa` — all on `feat/data-minimization-positioning-2026-06-18`, unmerged since June; policy cites files production doesn't have; the primary Connect CTA bypasses the disclosure the architecture was built for | product, marketing, legal, sales (4) | Surfaces hedge or silently diverge from ratified positioning; the CPA/Law confidentiality pitch is written and unshipped |

---

## 3. Master process improvements (top 15, ranked)

Ranked by leverage: recurring dollars/liability first, then unblocking breadth, then
effort. "Do first" = start this week.

| # | Improvement | Source domains | Impact (who benefits) | Effort | Sequencing | Outcome |
|---|-------------|----------------|------------------------|--------|------------|---------|
| 1 | **Wire the spend pipeline:** call `stampSessionCost()` from the dispatch completion seam and register the `agentplain-librarian-rollup` executor so INBOX drains and the YAML layer fills | finance, data, fleet-ops, engineering | Every downstream number — kaizen retro, re-tier audit, budget state, morning brief | S | Do first | The 2026-07-05 kaizen run reports sessions > 0 and real week-to-date spend for the first time |
| 2 | **Stand up a server-side CI floor (`pr-checks.yml`):** typecheck + unit tests (incl. the RLS-invariant, data-categories, and portal suites) + brand-gate + voice-gate + a vendor-invisible regex + a claims linter (fails copy asserting live compliance for verticals outside `BASELINE_LIVE_VERTICALS`) + a duplicate-migration-timestamp check | engineering, design, marketing, product, legal | Everyone; makes `HUSKY=0` safe instead of dangerous | M | Do first | A bypassed local push can no longer land unchecked drift on main |
| 3 | **Stop the guarantee money leak:** wire `recordSavedTime` into the sweep persist paths, bound the Day-7 window, and run auto-refund in human-review mode until the writers land | product, CS, sales | Revenue + customer trust (kills wrongful "we failed you" refunds) | S | Do first | The guarantee pays out only when the fleet actually fell short |
| 4 | **One sitting on the data-minimization branch:** merge (or formally kill) `feat/data-minimization-positioning-2026-06-18`, route the Connect CTA through the disclosure, ratify the vendor-name ruling into an allowlist | product, marketing, legal, sales | Positioning, legal exposure, the CPA/Law sales pitch | S | Do first (Conner sitting) | Ratified doctrine and production stop pointing at different file sets |
| 5 | **Adopt "reachable, notified, measured" as the definition of shipped:** feature PRs must include activation path, notification hooks, and measurement writers — enforced by a zero-call-site check on new endpoints/actions/resolvers | product, design, sales, CS | Kills the F1/F4 class at the source | M | After #2 (rides the CI floor) | "Merged" stops meaning "dark" |
| 6 | **Conner decision queue with SLA:** one triaged list (bio, `/security` absolutes, entity, pricing headline, cohort, spend approvals), weekly review cadence, `sla_days` by class (security = 3), past-SLA items escalate to a distinct top-of-brief block | marketing, fleet-ops, sales, legal, CS | Unblocks five domains' stalled work; ends 23-day security debt | S | Do first (process, no code) | Decisions clear on a cadence instead of aging invisibly |
| 7 | **"No recovery without a memory" + cross-index the two memory stores:** any bypass/heal/recovery session ends by writing the memory file; STUBs >7 days count as missing; the Cowork agent-memory mount and the code-side index reference each other | engineering, data, fleet-ops, +7 retros' caveats | The whole fleet stops paying to relearn | S | Do first (rule, then backfill the 6 named-missing engineering memories within a week) | The next retro's brief cites only memories that exist |
| 8 | **Registered-surfaces manifest + tokens as single runtime source:** one manifest of customer-visible surfaces consumed by brand/voice/vendor gates (glob, not hardcoded lists); export an email-safe palette from `tokens.ts` and route all HTML generators through it; brand-gate imports the canonical set instead of keeping its own copy | design, product, marketing, legal | Retires F7 structurally — one fix instead of per-file whack-a-mole | M | After #2 | The next token move cannot silently strand a customer surface |
| 9 | **Ship `fleet-ship.mjs` + `wt.mjs`:** one door for mint-token (TTL-aware, re-mint on 401) → push → PR; one lifecycle tool for worktree create/teardown encoding the junction, EPERM, and backslash traps | engineering, fleet-ops | Every fleet wave, immediately; kills the pushed-branch-no-PR orphan | M | Can start now | The per-session plumbing tax and its 4-memory recipe disappear |
| 10 | **Weekly compliance/claims standing check:** re-verify the flagged `/security` absolutes, `[COUNSEL]`-flag count per published doc, deletion-path invariant tests green, days-since-rotation per credential; output lands in the INBOX | legal, marketing, product | Claims stop drifting back between Truth Waves | S | After #1 (needs the INBOX pipe healthy) | The Truth Wave becomes a gate, not an annual event |
| 11 | **PR size budget + merge-train:** ≤800 insertions / ≤30 files with a labeled override; a ready PR merges within 24h or gets an explicit waiting-on-X label; overlapping PRs land smallest-first; open-PR cap before new waves dispatch | engineering (product's post-merge-P0 evidence supports it) | Review becomes real; heal passes stop | S/M | Can wait (behind #2) | 41% of PRs >1k insertions → <15%; p90 turnaround 22h → <12h |
| 12 | **Data-first Librarian + heartbeats:** roll-up derives YAMLs from primary sources (git log, REST API, session metadata) instead of waiting for voluntary reports; seeder stamps `last_run`/`items_emitted`; a meta-monitor alerts on missed cron slots | fleet-ops, data | The autonomy loop; ends "queue empty vs seeder dead" ambiguity and silently-skipped kaizen runs | M | After #1 | No `data/*.yaml` >24h staler than its newest reachable source |
| 13 | **Reconnect dispatch (or promote the file-bridge):** land the already-spec'd GHA bridge so a `pending-fires.yaml` append fires within minutes; the 17-day fallback is the single biggest autonomy leak | fleet-ops, engineering | Tier-2 autonomy stops requiring Conner's next message | M | Can start now | Autofire converts queue items to fires without a human in the loop it was built to remove |
| 14 | **Sales activation minimum:** 50-name Georgia RE beachhead list, resolve `{{CALENDLY_LINK}}`, CRM-lite of record, weekly draft-and-approve outreach rhythm (fleet drafts, Conner sends ~60-90 min/wk) | sales, marketing | The #1 GTM channel goes from 0 sends to a cadence — dogfooding the product's own pattern | M | **Blocked by #6** (founder-time budget, cohort, spend approvals) and partially by prod-key decision (§6) | 5 sends/week sustained; the founder's approval queue becomes the first case study |
| 15 | **Secret-rotation policy + dated credential inventory — and revoke the 06-09 PAT today** | legal, fleet-ops | Closes a 23-day security loop; prevents the next one | S | Do first (the revoke is minutes) | No credential ages past its interval without a flagged owner |

**A senior operator's first five:** #1, #2, #3, #4, #6. Together they connect the spend
pipeline, put a floor under quality, stop the only recurring dollar leak, reconcile
doctrine with production, and unblock everything queued on decisions — roughly the
fleet's next three weeks.

---

## 4. Investment priorities (top 5)

1. **Ops + cost telemetry (the substrate everything above reads).** A real sink for
   `LlmUsageRecord` and the budget-gate log lines (Axiom fits the existing structured
   logger; Datadog if infra dashboards are wanted too), feeding a one-page Fleet-Ops
   dashboard (loop heartbeats, YAML freshness, queue depths, token last-mint/last-401,
   Conner-queue age-vs-SLA, WTD spend) and a live unit-economics view (modeled vs actual
   COGS, margin trend, Stripe-fee share). Cost: one vendor bill + wiring already-emitted
   events. Benefit: the re-tier audit, margin re-baseline, and the daily brief all become
   fact-based; a dashboard over stale YAML is visibly red, so freshness self-enforces.
   Timing: immediately after improvement #1 lands — three retros (finance, data,
   fleet-ops) independently named this their top investment.

2. **Product-analytics lite + the health score we already spec'd.** A minimal event
   layer (PostHog self-hosted or a thin homegrown table — must respect the two-bucket
   positioning and vendor invisibility) capturing activation funnel, approval latency,
   connector connects, workflow runs per vertical; plus `research-engine.md` §4's health
   score as a daily Inngest sweep over tables already on main. Cost: small — build, not
   buy (a churn vendor has nothing to model at n<10). Benefit: the entire missing
   "customer" half of analytics; pricing, tier design, and churn defense currently run on
   zero measured usage. Timing: before customer #1 converts, so day one of real data
   isn't day one of debugging.

3. **Commissioned creative: photography + second-tier vertical illustration.** The
   briefs exist (5 golden-hour verticals, 2026-06-22), the CSS slots are live and empty,
   and the brand thesis is literally "rooted in reality" — real photography of real
   operators is the one proof the design system can't generate. Art-direct persona-aware
   (standing/restraint for RE/law/CPA; warmth for general/PM), route through
   creative-router per the tools-or-humans rule, and extend the deterministic scene
   pipeline to the 6 placeholder verticals so the /verticals index stops showing a
   quality cliff. Cost: a commission budget. Benefit: both design and marketing named
   this independently; it is the visible gap between the brand promise and the page.
   Timing: parallel-track now; nothing blocks it but the spend approval (§6).

4. **The GTM activation stack.** Apollo (~$50–100/mo) for the ICP-filtered beachhead
   list, Calendly/Cal.com to resolve the booking dead-end, a lightweight CRM of record
   (HubSpot free / Attio / Airtable) with the DISCOVERY→CLOSED states, a warmed outbound
   sending domain — then one small measured paid test on realty creative with
   attribution wired. Cost: low hundreds/month. Benefit: converts a complete, honest,
   merged asset library from shelf-ware into the #1 ratified channel; the paid test
   prices CPA before scaling. Timing: blocked only by the Conner decisions in §6 —
   the assets decay while it waits.

5. **A sustained content/AEO publishing cadence.** The technical SEO and AEO baseline is
   built and correctly diagnosed; the missing asset is rhythm — brief → draft against
   ground truth → gates → publish → measure, running continuously against 10 verticals'
   long-tail intent, folded into the weekly kaizen loop with an owner and a
   published-state tracker. Cost: mostly fleet time. Benefit: the compounding
   distribution asset; specificity beats horizontal AI slop, and the honesty gates make
   the content defensible. Timing: can start now; pairs with #3's imagery as it lands.
   (The CS support front-door — Plain/Intercom behind an adapter — is deliberately *not*
   in the five: per the CS retro itself, decide when the first Max design partner signs.)

---

## 5. Kaizens that AGREED on a specific fix (load-bearing signal)

Same fix, independently derived, often near-verbatim:

- **"Wire `stampSessionCost` into dispatch"** — finance imp #1, data imp #1, fleet-ops
  friction #1, engineering fleet-gap #3. Four retros, one call site. The single most
  agreed-on item in the series; data called it "nothing else on this list matters until
  the fuel line is connected."
- **"Promote brand/voice gates from pre-push to blocking CI"** — design imp #2,
  marketing imp #1, engineering investment #2, product imp #4 (invariant tests variant).
  All four cite `HUSKY=0` as the reason and the `connector-dispatch-coverage.yml`
  pattern as the proof it works.
- **The same metaphor for F1, coined independently three times:** finance "the classic
  meter with no wire," data "a well-built engine with an empty fuel tank," product
  "producer-without-consumer seams." Three domains describing one architecture problem.
- **"Fix `recordSavedTime` / guarantee undercount"** — product decision #1 ("no third
  option"), CS process fix #4 (auto-refund to human-review mode until fixed), sales fix
  #5 (the same instrumentation serves the case-study template).
- **"Merge or kill `feat/data-minimization-positioning-2026-06-18`"** — product decision
  #3, marketing friction #5, legal friction #4 (the DPA template lives on that branch).
- **"Codify vendor invisibility and resolve the 'built on Claude' canon conflict"** —
  marketing's bake-in section and sales' objection library both route to the same
  ruling; legal notes brand-gate R1 already enforces the rendered half.
- **"Revoke the 06-09 PAT"** — legal action #1 ("today"), fleet-ops friction #5 (the
  23-day case that "must never recur"). Note: legal's evidence check found no artifact
  confirming a *leak* (the checklist says expired); both agree revocation is overdue
  regardless.
- **"Give the Conner queue an SLA with escalation"** — fleet-ops imp #3, marketing imp
  #4, sales decision items, CS escalation-criteria fix. Same mechanism, four phrasings.
- **"Commission the photography"** — design investment #1 and marketing investment #2,
  citing the same brief file and the same empty CSS slots.
- **"Register the Librarian roll-up executor"** — data imp #2 and fleet-ops imp #1
  (fleet-ops adds: hydrate from primary sources, don't just drain the inbox).
- **"Missing memory files"** — not a proposed fix but the same *measured defect* filed
  by 7 of 10 retros against their own briefs. That unanimity is itself the finding.

---

## 6. Kaizens that CONTRADICTED each other (Conner calls, not fleet fixes)

1. **Un-pause the prod Anthropic key: finance vs standing policy (and sales is split).**
   Finance imp #2: restore now behind the daily spike-guard on a small workspace set —
   the paused key blinds the margin model and every re-baseline. Standing policy (money-
   GTM, corroborated by legal): paused until Conner is actively prospecting. Sales wants
   it un-paused *before* outreach (a design partner can't pilot on a paused key) but also
   warns selling ahead of activation-readiness burns the most expensive references.
   **Call needed:** un-pause scope and trigger — telemetry-gathering un-pause now
   (finance), or keep it coupled to the first outreach send (policy).
2. **Cohort math and vertical sequencing.** The sales claims doc caps the design-partner
   cohort at 3–5 across all verticals; the money-GTM plan targets 10 real-estate
   partners; the packet library weights five verticals equally against a ratified RE
   beachhead. Sales flags that the default (spread Conner-time five ways) is the worst
   allocation under the binding constraint. **Call needed:** cohort number + RE-first
   ratification with an explicit CPA/law trigger.
3. **"Built on Claude" hero subheads.** The SBM-wrapper canon (2026-06-06) prescribes
   the phrase on all 10 vertical heroes; the marketing-surface canon (2026-06-16) and
   the vendor-invisible rule ban it. Rendered surfaces currently follow the stricter
   rule on discipline alone. **Call needed:** one ruling, written into the allowlist and
   the SBM memory — marketing and sales both queue work behind it.
4. **The `/security` absolutes.** Marketing values the strong claims ("returns zero rows
   regardless", "no admin can rewrite history", 24h SLA) as trust collateral for exactly
   the CPA/law buyer; engineering/legal document the hardening gaps behind them as open.
   Flagged for Conner on 06-16, still rendered 16 days later. **Call needed:** soften
   the copy now, or fund the hardening and keep it — holding both is the current (worst)
   state, and sales wants it resolved before pointing skeptical prospects at the site.
5. **Portal: fund it or flag it off.** Product frames it as a binary with no middle
   state (unreachable + unsafe edges + 9 PII tables outside RLS = all the liability,
   none of the adoption); CS counts it as CS-critical surface area once fixed; legal
   counts it as the thing blocking a signable DPA. Nobody argues for the status quo, but
   fund-vs-flag changes which of PRs #327/#330's fixes are urgent. **Call needed:** one
   wave to make it real, or gate the routes and clean the tables until then.
6. **Always-on cadence vs quiet-pass burn.** Fleet-ops documents 185+ consecutive quiet
   15-minute Librarian passes over an idle week and proposes back-off; the same retro's
   improvement #1 *adds* work per pass (hydration from primary sources). With spend
   unmeasured (F9), both positions are currently unfalsifiable. **Call needed:** none
   immediately — land improvement #1, measure a week, then set cadence with numbers.

---

## 7. Fleet-ops loopbacks (how we work, not what we build)

Items other domains' retros identified that land on the fleet-ops backlog:

1. **Memory integrity is the #1 meta-defect.** 7/10 retros hit named-but-missing memory
   files; expensive lessons evaporate; two memory systems (code-side index vs Cowork
   agent-memory mount) don't index each other, and scheduled-task SKILL.md files embed
   typo'd UUID paths. Owns: the "no recovery without a memory" rule, STUB kill, the
   cross-index, and a mandatory 5-minute post-wave retro-write step in the wave template
   (engineering fleet-gap #2).
2. **Dispatch MCP unreachable 17 days; autofire seeder starved.** The Tier-2 loop's
   biggest autonomy leak plus its blindness twin: "0 eligible" and "seeder dead" produce
   identical run reports while manual audits surface 11+ P0s that never enter the queue.
   Owns: GHA bridge or reconnect, seeder heartbeat, and routing audit-wave findings into
   the autofire queue.
3. **No overlap check at dispatch time.** The sequential-landings rule requires a
   pre-fanout file-overlap audit; nothing runs it; engineering pays in rebase cascades
   and heal passes. Owns: wave briefs declare expected file-sets; fleet-ops
   refuses/serializes overlapping dispatches.
4. **Duplicate/bakeoff dispatch is unlabeled.** Two worktrees ran the same engineering
   retro, discoverable only by collision; if deliberate, the brief must say so and name
   the judge; also relevant here — four kaizen PRs (#336, #339, #340, #341) were still
   unmerged at synthesis time, so this master plan had to read them from PR heads.
   Owns: bakeoff labeling convention + a "retro lands before synthesis dispatches" rule.
5. **Briefs must be verified before they're issued.** Data's retro caught its own brief
   citing a nonexistent "insight library" and "50+ detectors" (actual: 7 families);
   several briefs asserted gaps the code disproved (finance's three corrections, CS's
   "no ticketing"). Owns: brief-authoring checklist — every artifact named in a brief is
   existence-checked first; the fleet's own "no guesses, cite the artifact" rule applies
   to briefs, not just outputs.
6. **Fleet plumbing as product:** `fleet-ship.mjs` (token TTL, push, PR) and `wt.mjs`
   (worktree lifecycle) — see improvement #9. Also: weekly main-tree hygiene sweep
   (engineering imp #5 — the shared `C:\agentplain` checkout is a junk drawer that
   caused at least one stale-disk misread this cycle), scheduled-task lifecycle
   (retire spent one-shots), and a WORKING_STATE snapshot prune (264 `.preXXXX` files).
7. **The kaizen loop must monitor itself.** The weekly retro silently skipped 06-28;
   the judgment layer burns an Opus session to report "no data"; `dataGaps` should file
   its own repair items to the audit queue instead of paragraphs (data imp #3 / inv #3,
   fleet-ops friction #6). Owns: scheduled-task meta-monitor + empty-input short-circuit.
8. **Brief self-calibration + Conner-queue SLA rendering** (fleet-ops imps #3/#4): the
   daily brief re-verifies load-bearing claims against live sources, compresses carried
   items, and escalates past-SLA items to a distinct block — the mechanism behind
   improvement #6.

---

*Synthesis method: all ten retros read end-to-end from origin/main @ `41e1852` and the
four open PR heads listed in the header; no external sources. Rankings weight recurring
dollars/liability, cross-domain breadth, and effort — not retro length (the 62-line
sales retro and the 222-line legal retro carried equal votes).*
