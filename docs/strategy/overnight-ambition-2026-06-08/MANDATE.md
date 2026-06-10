# Overnight Ambition Mandate — 2026-06-08

> Conner's mandate: *"Set up a strong build for tonight. This needs to fit everything our fleet thinks it can be and more."*
> The **"everything"** = audit-driven improvements. The **"and more"** = revolutionary capabilities the fleet didn't dare ask for in its own audit. This doc surfaces both, clustered into sequenced waves.

**Status of record (verified against `origin/main` @ `5f5fc59`, night of 2026-06-07):**
- Main is at **PR #188** (explainer visuals). **#189 (bounded auto-execute) and #190 (results) are OPEN, not merged** — do not build on them as if landed.
- 14 PRs landed today (#175–#188). Keystone adapters, explainer visuals, briefing control, activation, org/competitive honesty all on main.
- Customer-discipline pride: **1 → 3** (target met). Whole-fleet median still 1 (the deferred Media/Insights/eng-org-chart baseline-1 charters drag it — out of scope by design).

---

## How this was built

12 discipline-ambition agents each answered ONE question against the real codebase: *"If we had NO constraints, what would my discipline ship in 6 months that NO SMB-AI competitor — including Anthropic's own Claude for Small Business — has even thought of?"* Raw outputs: `~/.claude/projects/C--agentplain/memory/fleet_ambition_2026_06_07.md`.

**The signal is convergence.** Six themes recurred independently across disciplines that never coordinated. Convergence across independent agents is the strongest evidence these are the right bets.

---

## The category-defining bet (Plaino CEO tier)

**agentplain becomes the persistent operational-memory layer for a local business** — the only AI service that carries forward *why this specific business decides the way it does* (rejected drafts and the reason, seasonal patterns, false-positive compliance flags, the owner's real voice vs. the template) from one month to the next, getting more personal every cycle.

This is the moat a model supplier **structurally cannot build**: Anthropic doesn't own the per-business operational data, won't staff the humans, won't own the compliance/vertical expertise, and has no incentive to make *this one brokerage's* workflow more personal. It directly fights churn (the #1 SMB-SaaS killer) by making month 2 demonstrably better than month 1 — and it seeds the $15K "train the fleet on our process" service engagements on top of the flat subscription.

> *"The moment I see the same risky clause land twice and you fix it the same way both times, I remember. Next time I don't ask you to do the same work again — I do it right the first time. That's when the fleet becomes irreplaceable: not because it drafts, but because it learns what matters to your business and gets better at caring about the same things you do."* — Plaino CEO tier

---

## The six convergent themes

| # | Theme | Disciplines that independently proposed it | Why no competitor has it |
|---|-------|---------------------------------------------|--------------------------|
| A | **Prove the value** — quantify hours saved + $ influenced per workspace | Knowledge, Finance, Customer, BizMgr | Competitors measure tokens generated, not labor/capital saved |
| B | **The fleet that remembers** — durable workspace memory + learned preferences | CEO, Customer, Marketing, Sales, Compliance, Ops | Requires owning multi-month per-business operational data |
| C | **Cost-aware platform** — per-task model routing + ARR-tied budget governance | Engineering, Finance | Everyone hardcodes one model; we route by what the task needs |
| D | **Compliance you can hand a regulator** — proof records, attestations, posture | Legal, Compliance | Requires counsel-reviewed corpus + immutable audit trail |
| E | **Plaino living layer** — queue-state avatar + visual-card conversations | Brand, Customer | Competitors build chat; we build *visual* conversations on one metadata seam |
| F | **Operations autonomy** — self-healing scheduler + bounded safe-admin auto-run | Customer, Ops | Approval-gated auto-execute = vetted once, then trusted (not blind automation) |

---

## The 22 waves — sequenced & tagged

**Tags:** `[SHIP]` fleet can ship now, no external dependency · `[CONNER]` needs a Conner decision/sign-off · `[EXTERNAL]` blocked on a vendor key/OAuth/counsel · `[AFTER #189]` depends on bounded-auto-execute landing first.

### Theme A — Measurement spine (the value proof)
1. **Workspace Value Ledger** `[SHIP]` `★ NIGHT2-1 tonight` — hours-saved + $-impact per workspace, computed from `WorkApprovalQueueItem` dwell/decisions × vertical wage benchmarks and `LlmUsageRecord` cost. Read-only operator surface. *No migration.* Seam: `lib/measurement/value-impact.ts`, `lib/billing/usage/aggregate.ts`.
2. **Skill-to-Outcome grading loop** `[SHIP]` — acceptance rate + decision latency + edit-distance per skill; auto-re-rank runtime dispatch toward high-ROI skills. Seam: `model SkillRun` + `WorkApprovalQueueItem.decisionReason`, new `lib/measurement/skill-grades.ts`.
3. **Cost-by-agent drill-down** `[SHIP]` — slice `LlmUsageRecord` by (skill, vertical, model, period); kill the anonymous `OTHER` bucket. Seam: `/operator/workspaces/[id]` usage tab.
4. **Agent confidence + drift detector** `[SHIP]` (depends on #2) — flag when a skill's acceptance falls 15%+ WoW before customers notice. Seam: `lib/measurement/drift-detector.ts`.

### Theme B — The fleet that remembers (the CEO bet)
5. **Workspace memory seam** `[SHIP]` `★ #1 PRIORITY NEXT` — durable structured learnings recorded on every approval decision (why approved/rejected/edited). Migration-light: rides existing JSON payload fields first (the zero-migration pattern that shipped the Plaino card system). Seam: `lib/workspace-memory/`, write-hook in `lib/approvals/decisions.ts`.
6. **Memory-driven approval ranking** (depends on #5) — predicted/adaptive queue with a whispered context line ("you usually approve these in <5min"; "last time you edited this clause").
7. **Learned brand-voice engine** `[SHIP]` (depends on #5) — tune drafts from the workspace's own approved-draft history, not a static tone guide. Seam: `lib/preferences/` + `content-calendar-drafter-general`.
8. **Compliance playbook replay** (depends on #5) — learned safe-edit pre-applied next time the same risky clause lands. Seam: `lib/agents/sentinel/`.

### Theme C — Cost-aware platform (the margin fix)
9. **Cost-aware model routing** `[SHIP]` `★ NIGHT2-2 tonight` — per-task-class model selection (Haiku for triage, Opus for reasoning) behind `LLM_MODEL_ROUTING` flag, default OFF (no-op until enabled). Directly attacks the production-plan headline: heavy workspaces cost more in tokens than they pay. Seam: `lib/llm/index.ts` compose chain.
10. **ARR-tied budget governance** `[SHIP]` — auto-pause non-critical crons when trailing-7d token cost exceeds (MRR × 0.25); operator alarm, never a customer-facing kill switch (no-outbound). Seam: `lib/billing/budget.ts` + `lib/skills/fire-gate.ts`.

### Theme D — Compliance as defensibility
11. **Compliance proof record** `[CONNER]` — immutable per-workflow audit (corpus version + matched flags + sign-off) + PDF export a customer hands a regulator. Needs migration + counsel framing. Seam: append-only `WorkflowComplianceProof`.
12. **Jurisdiction attestation certificates** `[CONNER]` — monthly signed compliance attestations. Needs counsel sign-off + Conner as signing operator.
13. **Regulatory change feed → corpus refresh** `[EXTERNAL]` — poll state RE commissions / HUD / federal register; draft candidate rule updates for counsel. Needs a feed source (BrightData/Tavily key).
14. **Customer-facing compliance posture dashboard** `[SHIP]` — corpus coverage %, 90-day flag trend, remediation backlog. Seam: `/app/.../workspace/[id]/compliance-posture`.

### Theme E — Plaino living layer (retention)
15. **Plaino visual-card library expansion** `[SHIP]` `★ NIGHT2-3 tonight` — grow the chat "what next" card from ~5 paths to a composable library of visual answer types (decision trees, before/after, mini compliance dashboard), all on `PersistedChatMessage.metadata`, all text-degradable + accessible. Seam: `lib/plaino/visual-card.ts`, `components/plaino/`.
16. **Plaino queue-state avatar** `[SHIP]` — pose changes with real queue energy (herding = items pending, scouting = integrations scanning, sitting-alert = idle-ready). A one-glance operational mirror. Seam: `components/ui/ap/PlainoAvatar.tsx` + `lib/workspace/queue-state.ts`.
17. **7-day onboarding Plaino sequence** `[SHIP]` (needs brand assets) — daily "we're working" visuals across first week. Seam: `components/onboarding/`, `tools/brand/`.

### Theme F — Operations autonomy
18. **Self-healing scheduler** `[AFTER #189]` — auto-reschedule around real calendar conflicts within gates. Seam: `lib/inngest/functions/scheduler-sweep.ts`.
19. **Bounded auto-execute for safe admin** `[AFTER #189]` — extend office-manager to auto-run sub-threshold safe categories (mark-as-read, sub-confirmations) at confidence > 0.85. Seam: `lib/skills/office-admin/` + `approval-threshold.ts`.

### Theme G — Local market intelligence
20. **Local market intelligence feed** `[EXTERNAL]` — geography-aware weekly brief (comps, rate trends, sector benchmarks) — the thing national competitors can't surface. Needs BrightData/Tavily key. Seam: `lib/skills/market-intelligence-vertical/`.

### Theme H — Platform scale
21. **One-button vertical instantiation** `[CONNER]` — spin up a fully-wired vertical workspace (skills + MCP routing + corpus + RLS seed) from one template. Needs scope decision. Seam: `lib/verticals/`, `lib/onboarding`.
22. **Vertical activation blueprint library** `[CONNER]` — pre-build ship-ready bundles (ICP, objection bank, corpus, agent shortlist) 90 days before greenlight. Seam: `docs/decision-packets/`, `lib/verticals/`.

---

## Tonight's auto-executed waves (background, isolated worktrees)

| Wave | Theme | Why chosen for unattended execution |
|------|-------|-------------------------------------|
| **NIGHT2-1** Workspace Value Ledger | A | Pure-additive, no migration, no external key, no live-LLM at runtime, disjoint dir (`lib/measurement`) |
| **NIGHT2-2** Cost-aware model routing | C | Flag-OFF default = no-op until enabled (sentinel-pause irrelevant), disjoint dir (`lib/llm`) |
| **NIGHT2-3** Plaino visual-card library | E | Deterministic builders, accessible, disjoint dir (`lib/plaino`, `components/plaino`) |

The three touch **disjoint directories** → minimal merge conflict, can land in any order. Each ships behind a flag where it changes runtime behavior, with unit tests, and only pushes if the local `build:no-migrate` gate passes.

**The headline bet (#5 workspace memory) is deliberately NOT auto-executed tonight** — it carries a schema decision worth Conner's eyes, and a botched migration in the shared tree is the exact failure mode that killed prior runs. It is the #1 sequenced next wave.

---

## CONNER DECISIONS surfaced by this synthesis

1. **Compliance defensibility scope (#11/#12)** — do we invest in regulator-grade proof records + attestations now? Recommended: **yes, after #189 lands** — it's the clearest "supplier can't build this" moat and the highest-trust realty selling point. Needs counsel sign-off you already have queued.
2. **Vertical instantiation (#21/#22)** — build the one-button vertical machine now, or finish the realty pilot first? Recommended: **finish realty** (per the locked "no new verticals until locked ones finish" rule) — but build #22's *blueprint scaffolder* now so activation is 7 days, not 6 weeks, when you do greenlight.
3. **External keys unblock 3 waves (#13/#20)** — a single BrightData/Tavily key unlocks both the regulatory feed and the local-market-intelligence feed (two of the highest repeat-use drivers). Recommended: **provision one key.**
