# Spend telemetry wiring — ending the NULL-spend state

**Date:** 2026-07-03 · **Owner:** Head of Finance & Ops · **Executes:** Engineering (see `05`)
**Problem statement:** `stampSessionCost()` (`lib/kaizen/session-stamp.ts`) has zero call sites; `memory/data/session-costs.yaml` has held zero rows ever (kaizen 9/10); the weekly retro reads a file nothing writes. Week-to-date spend is NULL on both the ops side (no data) and the billing side (no WTD window in `lib/billing/usage/aggregate.ts`). This has been open since the kaizen-loop PR (#273) flagged it.

---

## 1. The two meters, kept distinct (do not conflate)

| Meter | Path | State today | Measures |
|---|---|---|---|
| **Billing meter** (customer/product spend) | `LoggingLlmProvider` → `persistUsageRecorder` (`lib/llm/index.ts:171`, `lib/billing/usage/recorder.ts:62`) → `LlmUsageRecord` → `getWorkspaceUsageReport` (`lib/billing/usage/aggregate.ts`) | **Wired and correct**; dormant only because the prod key is paused, so zero traffic flows | Per-workspace prod token spend — the thing budget caps gate on |
| **Ops meter** (fleet session spend) | session → `stampSessionCost()` → `memory/inbox/*.yaml` → Librarian merge → `memory/data/session-costs.yaml` → `lib/memory/data-readers.ts` / `lib/kaizen/data-readers.ts` → weekly retro | **Built, never connected.** Zero call sites, zero rows ever | What the fleet itself costs to run — the dominant real cash-adjacent spend today |

The billing meter needs one small addition (a WTD window). The ops meter needs its wire. Everything below is the ops meter unless marked otherwise.

---

## 2. Call-site plan for `stampSessionCost()`

The module was designed for exactly this (its own header says so): a session calls it at completion; it writes an append-only payload to `memory/inbox/`; the Librarian merges. Payloads are collision-free by construction, and `estimated_cost_usd` is computed from token counts via `lib/kaizen/pricing.ts` when omitted, with a `cost_unpriced` flag when the model isn't priced — so partial data is still honest data.

Three call sites, in priority order:

### Call site A — the fleet session protocol (day 1, no code)

Every fleet session (orchestrator or worker) stamps itself at completion. This is a **protocol addition, not a code change**: add a mandatory completion step to the fleet operating docs (`memory/LIBRARIAN_CHARTER.md` companion / CLAUDE.md fleet section):

```
Before ending any fleet session that consumed model tokens:
  node --import tsx -e "import('./lib/kaizen/session-stamp.js').then(m => m.stampSessionCost({...}))"
  with: session_id, title, model, model_context_size, started_at, completed_at,
        tokens_in, tokens_out (from the session's own usage view), outcome, tier,
        pr_number/pr_url when a PR was produced.
```

Notes that make this stick where PR #273's version didn't:
- **Token counts may be approximate** — the session reads its own context/usage indicators. An approximate row beats a NULL table; `cost_unpriced` and `notes` exist for caveats.
- Use `node --import tsx`, not bare `tsx` (kaizen 9/10 gotcha).
- The stamp is **append-only to inbox** — it cannot clobber anything, so there is no reason to skip it "to be safe."

### Call site B — the dispatch parent completion path (when dispatch is back)

The seam the kaizen retro named: whatever wraps `mcp__dispatch__start_code_task` stamps the child session on completion with the metadata dispatch already has (session id, model, tier, outcome, PR). The dispatch MCP has been down 17 days (kaizen 10/10), so this call site is written into the dispatch-parent runbook now and becomes live when dispatch does. **Do not block the pipeline on it** — call site A covers the interim.

### Call site C — the PR-merge backstop (GHA, day 2–3)

A small GitHub Actions job on `pull_request: closed` (merged=true) that checks whether an inbox payload referencing that PR number exists; if not, it writes a minimal stamp (`session_id: "pr-<n>-backstop"`, tokens 0, `cost_unpriced: true`, outcome from merge state, `notes: "backstop — session did not self-stamp"`). Purpose: **the table can no longer silently miss work.** Every merged PR leaves a row, and the retro can report the self-stamp compliance rate (stamped-by-session vs backstopped), which is itself the adoption metric for call site A.

### Product lane (billing meter) — one addition

Add a `weekToDate` window to `getWorkspaceUsageReport` (`lib/billing/usage/aggregate.ts`), same shape as `today`/`last30Days`. Zero rows while the key is paused, but the window must exist before un-pause so day one of real traffic is day one of complete reporting, not day one of building reports.

---

## 3. The Librarian-rollup executor (the missing middle)

**Today:** the write contract (`memory/data/README.md`) says the Librarian drains `memory/inbox/` on a 15-minute cadence — but the Librarian is a scheduled agent whose operational copy lives on the Cowork agent-memory mount, the dispatch bridge is down, and the YAML layer's zero-rows-ever record shows the cadence has never actually run against real payloads. An agent-with-a-charter is the wrong tool for a deterministic merge anyway.

**Plan: `scripts/librarian-merge-inbox.ts`** — a deterministic, LLM-free executor that does the mechanical third of the Librarian's charter:

1. Read every `memory/inbox/*.yaml` payload; validate against the payload types `session-stamp.ts` emits (`type: session-cost | cv-bar-score`, `target:` file).
2. Merge into the target YAML under `memory/data/` — append-only by `session_id`/`pr_number` key, idempotent (re-running on the same inbox is a no-op), `schema_version: 1` respected.
3. Move processed payloads to `memory/inbox/processed/` (keep the audit trail; never delete).
4. Refuse anything it doesn't recognize — unknown payload types stay in the inbox for the (agent) Librarian's judgment passes. **This executor takes over the mechanical merge only; the charter's judgment work (INBOX.md promote/merge/drop, decay sweep, pending-fires relay) stays with the Librarian agent.**

**Schedule:** GHA cron, daily at 06:00 UTC (matching the repo's existing scheduled-job pattern), committing the merged YAML back to main with a `chore(librarian): merge inbox` commit. Daily is enough — the consumer is a weekly retro, not a live dashboard. If/when the Cowork-mounted Librarian task resumes, it calls this same script instead of hand-merging, so there is exactly one merge implementation.

**Invariant preserved:** one writer to `memory/data/` (the executor), everyone else appends to `memory/inbox/` — invariant I-2 keeps holding, it just gets an executor that actually executes.

---

## 4. The dashboard view for Conner

Phase it — the digest is days away, the page is not urgent at zero customers:

**Phase 1 (this window): the weekly ops digest, numbers-first.** Extend `scripts/run-kaizen-retro.ts` output (it already loads session costs via `lib/kaizen/data-readers.ts` scoped to 7 days) so the retro's header block is a finance panel:

- Fleet WTD + MTD token spend, by tier and by model (from `session-costs.yaml`), with the % of rows that are `cost_unpriced` or backstopped shown honestly.
- Prod-key state: paused / live / rotated-to-secondary (from the sentinel state).
- Workspaces in WARN/OVER on either cap dimension (from `getFleetBudgetSnapshots`, `lib/billing/budget.ts:411`) — all zeros while paused, and that's the point: the panel exists before the traffic does.
- Fixed-cost ledger delta (from `03-runway-model.md`'s ledger once it exists).

Delivery: the existing weekly kaizen schedule; output lands where the retro already lands. Conner reads one panel, top of one doc, once a week.

**Phase 2 (post first partner): `/operator/finance`.** An operator-surface page rendering the same readers live: per-workspace budget bars (`deriveBudgetStatus` — the same derivation the gate uses, so the number shown is the number enforced), fleet snapshot table, spend-by-vertical once real traffic exists. Spec'd in `05` as a Data/Engineering ask; **not built until there is a customer whose spend is worth watching live.**

---

## 5. Acceptance — when is the NULL-spend state officially over

1. `memory/data/session-costs.yaml` contains rows produced by the pipeline (inbox → executor), not hand-seeded.
2. Two consecutive weekly retros report non-zero fleet spend with a self-stamp compliance rate attached.
3. `getWorkspaceUsageReport` exposes `weekToDate` (verified by its unit test), ready for un-pause day.
4. The runway model's token line (`03` §2) cites `session-costs.yaml` instead of "NOT MEASURED."

Until all four hold, every finance number in this department's docs stays labeled **modeled**, per `feedback_no_guesses_no_estimates`.
