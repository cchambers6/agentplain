# Kaizen retro 2/10 — Product (2026-07-02)

**Scope:** roadmap health, spec clarity, killer-workflow effectiveness, shipped-vs-used, PMF signals, vertical productization, connector coverage, prioritization patterns.

**Evidence base:** the nine delivered department reports from `docs/audits/full-audit-2026-07-02/agentplain/` (depts 1–7, 9, 10 — read from their PR branches, pinned `origin/main @ f928400`), `docs/audits/click-path-triage-2026-06-15.md`, `docs/specs/EXECUTION_ROADMAP_FROM_STRATEGIC_PACKET_2026_06_14.md`, `docs/specs/AGENTPLAIN_OPERATING_SYSTEM_2026_06_15.md`, and memory (fleet pride audit 2026-06-07, kaizen loop PR #273, full-audit ledger).

**Source caveats (nothing below is invented):**
- Department 8/10 (voice + settings + call history) has **no committed report** — its branch `audit/voice-settings-call-history-2026-07-02` sits at `f928400` with zero commits and its worktree is empty. Treated as a process finding (F10), not silently skipped.
- Three memory slugs named in the retro brief (`project_business_plan_ceo_10_lenses_2026_06`, `project_click_path_triage_perception_vs_defect_2026_06_15`, `project_vertical_gap_is_productization_not_adapter`) do not exist under those names. The underlying artifacts do — the click-path triage doc on main, the business-plan packets synthesized in the execution roadmap, and the pride-audit memory ("the port exists, the adapter does not") — and those were used instead.

---

## 10 wins

1. **The approval-gate factory seam held at 100%.** All 10 mutating connectors (including DocuSign) wrap writes at the factory; SHA-256 fingerprints bind grants to exact payloads; `CONNECTOR_WRITE_ACTION` is hard-excluded from bounded auto-execute. The single highest-stakes product invariant — nothing outbound without a yes — survived a hostile audit (dept 4).

2. **The click-path triage corrected the founding premise instead of pandering to it.** "Almost every button is wrong" → 265 clickables traced, **0 truly broken on main**. The felt breakage was the paused LLM key plus dispatch drift, not dead buttons. That honesty redirected a whole fix wave from phantom bugs to the two real causes.

3. **The #277 dispatch-coverage gate turned a recurring bug class into a solved class.** 17/17 available connectors routed, zero stub tool bodies, enforced at three chokepoints (pre-push, CI, package script). The "connected but can't act" failure that dominated June cannot silently recur for OAuth connectors.

4. **Truth-Wave discipline became structural, not editorial.** The weekly report renders dollar outcomes only when a real invoice amount rode the payload, says "drafted" never "sent", and is deterministic (no LLM in the ROI-proof path — also outage-proof). The honesty rule moved from copy review into code shape (dept 7).

5. **One aggregator feeds email + dashboard.** `computeWeeklyReportData` backs both the Friday email and the in-app weekly page, so the two proof surfaces cannot drift apart. This is the pattern every claim-bearing surface should copy.

6. **The 5-tab IA collapse landed clean.** Single nav source of truth (`lib/workspace/nav.ts`), zero orphaned routes, correct 308 back-compat, degraded-mode banner universal and leak-proof, vendor invisibility holding across the shell (dept 3: 0 P0, 4 mechanical P1s).

7. **Guarantee plumbing is production-grade.** Idempotent append-only ledger with RLS, pure evaluation function shared by cron and surface, capped whole-charge Stripe refunds with human page-out on every shortfall, once-per-lifetime guards, 25/25 tests (dept 9 — the plumbing, distinct from the wiring gap in F3).

8. **Authorization architecture is genuinely strong everywhere audited.** No IDOR across 83 API routes; every workspace-scoped action re-derives role from the DB; operator surface has six layers of gating; portal read-isolation is tenant-scoped throughout. Auth is not where the product's risk lives (depts 2, 6, 10).

9. **Honesty seams are a product language now.** Null meters over fabricated numbers, "Connected — renewing soon" state labels, calm not-configured OAuth landings, disabled coming-soon rows, honest quiet-week empty states. The audits repeatedly found the *opposite* of the feared silent-dead-end failure mode (depts 1, 5, click-path).

10. **The audit machinery itself compounds.** Nine evidence-cited, main-pinned department reports with per-report spend accounting; two would-be P0 false positives were disproven and documented rather than filed (dept 3 §5, dept 4 F-4). The org can now measure its product honestly at will — that capability is itself a product asset.

---

## 10 friction patterns

1. **Shipped-but-unreachable.** `/how-it-works` built (PR #283) then shadowed by a stale redirect — the standalone page dead since merge day (dept 1 P0). `/guarantee` has zero inbound links and no sitemap entry (depts 1, 9). The portal cannot be activated from the product at all — `POST /api/portal/setup` and `/invite` have zero UI callers; effective reachable customers: 0 (dept 6). Nothing anywhere creates `PortalCase`, so the headline status page is dead code. Pattern: **merge ≠ shipped; the activation path keeps landing in a different PR that never comes.**

2. **Cosmetic-but-marketed controls.** BYO storage: marketed present-tense to Partner/Max, zero write path for `WorkspaceStorageConfig` exists (dept 10 P0-3). Discipline heads: promises hard approval routing; the resolvers have zero call sites (P1-9). Customer "Test connection" returns healthy from the DB row alone (dept 5 P1-9). The savings counter says "live"; no refresh exists (dept 9 P1-2). **Surfaces narrate guarantees the runtime doesn't deliver — the dept-10 auditor named this the single concentrating theme.**

3. **Producer-without-consumer seams leak money and trust.** `recordSavedTime` has one caller, so 4 of 7 calibrated actions — including invoice-chase, the flagship killer workflow — write **0 minutes**, and the Day-7 evaluation then offers refunds the fleet earned back (dept 9 P0-1: recurring money out the door). `notifyApprovalQueued` fires on 1 of ~8 approval-creation paths, so connector-write approvals stall silently (dept 4 F-1). `recordEphemeralFetch` has one call site, so the storage-proof counter undercounts the behavior it exists to prove (dept 5 P1-6). Memory tiering has zero production callers; `MemoryAuditLog` is never written on normal operations (dept 10 P1-6/8). **"Callers wire in as they land" comments are where the leaks started.**

4. **Spec-vs-code drift.** The Strategic-7 BI spec names (`lib/bi/insights/`, `WeeklyBrief.tsx`, 50+ detectors, customer-local delivery) match nothing on main — the real stack lives under different names with ~16 phrase mappings (dept 7). Audit criteria expect a mobile drawer the shipped IA deliberately doesn't have (dept 3 P2f). The kaizen loop itself shipped inert: data YAMLs empty because session-stamp was never wired into dispatch (memory, PR #273). Specs are written once and not reconciled after the build diverges.

5. **Stale tests and comments assert the opposite of production.** The wave-2 smoke test still pins DocuSign send/void as UNGATED — false since the factory gate landed — and it misled an audit pass into reporting a phantom P0 (dept 4 F-4). The conversation-cleanup header states the banned pre-correction retention framing (F-9). The billing page hardcodes "no card required" against `facts.ts` (dept 10 P1-10). **Stale artifacts aren't just noise; they actively corrupt downstream reasoning, including the fleet's own.**

6. **Gates cover hand-maintained lists, and everything off-list drifts.** voice/brand gates skip `lib/reports/` — so the richest recurring customer email drifted off the Heritage palette exactly as the gate-gap predicted, while its gated sibling was correctly retuned (dept 7 P0-1). Also unscanned: `lib/integrations/` marketplace descriptions, the entire portal including the invite email, and `app/(operator)` (depts 5, 6, 10). **The gate architecture is right; its surface enumeration is the weak joint.**

7. **New tables ship outside the safety nets built the day before.** The 9 portal tables landed one day after #298 closed the RLS gap — with no RLS, no teardown coverage, and end-client PII (dept 10 P0-1). Support tickets survive account close against an explicit on-surface promise (P0-2). Safety nets don't auto-apply; nothing forces a new workspace-scoped model to register with RLS + teardown + disclosure.

8. **Tests exist but CI doesn't run them.** The portal unit suite fails on pinned main and nobody knew (dept 6 PORTAL-9). The RLS-invariant and data-categories tests would both fail today — no workflow executes them (dept 10 P1-2). The instruments built to catch P0-1 were built, then left unplugged.

9. **Architecture merges without its positioning layer (and vice versa).** PR #306's architecture merged; the ratified two-bucket single-sources (`data-commitments.ts`, `data-flow.ts`) still live only on an unmerged branch — policy points at files production doesn't have (dept 5 P0-3). Meanwhile the primary Connect CTA bypasses the #306 disclosure entirely (P0-2). The doctrine and the pixels ship on different schedules.

10. **The vertical productization gap moved up a layer but is the same gap.** June's pride audit: "the port exists, the adapter does not." July: TaxDome and Karbon — the CPA vertical's month-end-close connectors — have fully built connect endpoints with **zero UI call sites**, advertised `available` but unconnectable by anyone (dept 5 P0-1). The adapter now exists; the form doesn't. Same class, one layer up: **verticals are blocked on last-mile productization, not on platform capability.** (Also: dept 8 delivering no report means the voice surface — a whole product layer — has no current health reading.)

---

## Top 5 process improvements

1. **Adopt a "reachable, notified, measured" definition-of-shipped.** A customer-facing feature PR must include (a) its activation path — UI entry point, inbound links, sitemap/nav registration; (b) its notification hooks; (c) its measurement writers (saved-time, metering, audit rows) — or it lands behind a flag with the copy gated too. Mechanical check that would have caught most of F1–F3: grep the PR for new endpoints/actions/resolvers with **zero call sites** and treat each as a blocker or an explicitly-filed follow-up with an owner.

2. **Extend the Truth-Wave rule in-app as a claims-vs-code gate.** Every present-tense capability claim on a customer surface must trace to code that delivers it (the dept-10 P0s are all claim-vs-runtime splits: "nothing tenant-specific remains", BYO "you can keep…", discipline-heads routing). Practically: a `claims.ts`-style annotation or review checklist item — "quote the claim, cite the file:line that makes it true" — applied to settings/data/billing copy the same way #290 applied it to marketing.

3. **Replace hand-maintained gate lists with a registered-surfaces manifest.** One manifest of customer-visible surfaces (route groups, email templates, portal, anything rendered to a human) consumed by voice-gate, brand-gate, and vendor-invisibility checks; adding a route group or email template without registering it fails the build. This turns dept 7 P0-1, dept 6 PORTAL-10, and dept 5's ungated marketplace copy into one structural fix instead of three whack-a-moles.

4. **Wire the invariant tests into CI and gate schema changes on them.** A `unit-invariants` workflow running the RLS-isolation and data-categories suites on every PR (dept 10's own recommendation — it would have caught the portal tables the day they shipped). Plus a schema rule: any migration adding a workspace-scoped (directly or transitively) model must ship RLS + teardown entry + data-categories disclosure in the same PR, enforced by the invariant test actually running.

5. **Institute per-spec reconcile-or-kill checkpoints.** Every spec gets a named revisit at the end of the wave that was meant to build it: reconcile the spec to what shipped (rename `lib/bi/insights/` expectations to the real `lib/reports/` stack), explicitly defer with a date, or kill it. Same ritual for known-gap comments and stale test pins — a "KNOWN GAP" older than two waves is either an INBOX item with an owner or it gets deleted with the code fixed. This is the antidote to F4/F5, and it's cheap: it's a 30-minute pass per wave, not a process apparatus.

---

## Top 3 backlog decisions to make NOW

1. **Stop the guarantee money leak this week.** Dept 9 P0-1 is the only finding in the whole audit that recurringly costs real dollars *and* sends a false "we failed you" message to customers the fleet actually served. Decision: one PR wiring `recordSavedTime` into the sweep persist paths + bounding the Day-7 candidate window to `ageDays ∈ [7,14]` — or, if that can't land immediately, gate the guarantee cron off today. There is no third option in which the cron keeps running against an undercounting ledger.

2. **Portal: fund it or flag it off — no middle state.** Today it is simultaneously unreachable by customers (zero activation UI), unsafe at its edges (silent edit-discard, caseId injection, byte-discarding uploads), and a latent GDPR breach (9 PII tables outside RLS/teardown/CI). Decision: either the portal is a committed near-term product — then one wave funds PORTAL-1…6 + RLS migration + teardown + CI as a unit — or the routes get gated off and the tables cleaned until it is. Leaving it half-live is the worst of both: all of the liability, none of the adoption.

3. **Merge or abandon `feat/data-minimization-positioning-2026-06-18`, and ratify the "Claude (reasoning)" exception.** The two-bucket positioning is ratified doctrine whose single-source files don't exist on main (dept 5 P0-3), the primary Connect path bypasses the disclosure the architecture was built for (P0-2), and the we-bring tab renders a vendor name that is either the sanctioned SBM exception or a violation — currently undecided (P1-4). One sitting resolves all three: merge (or formally kill) the branch, route the tile CTA through the disclosure, and write the vendor-name ruling into the allowlist with a rationale.

---

## PMF signal read (honest, brief)

Pre-revenue by design: the prod LLM key stays paused until Conner is actively prospecting (execution-roadmap §0.3), Stripe checkout is the gating decision, and the binding constraint identified across all strategic packets remains **trust + proof, not product, model, or cost** (blended margin ~95%; killer workflows are deterministic, near-zero COGS). The product signal to watch is therefore internal for now: the killer workflows run, but their value doesn't register in the product's own proof surfaces (0 guarantee minutes from sweeps, undercounting pass-through counters, weekly email drifting off-brand). **The proof machinery is the product right now — the friction patterns above are precisely the places it leaks.**

---

*Retro 2/10 · kaizen 2026-07-02 · worktree `C:\agentplain-wt-kaizen-2-fable` @ f928400 · sibling: 04-marketing (branch `kaizen/marketing-retro-2026-07-02`).*
