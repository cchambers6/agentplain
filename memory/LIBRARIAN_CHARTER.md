# LIBRARIAN_CHARTER — the memory singleton's standing orders

**Status:** canonical (committed copy) · **Owner:** the fleet · **Process source of truth:** `docs/specs/AGENTPLAIN_OPERATING_SYSTEM_2026_06_15.md` (Section 3 defines the Librarian; this charter is the operational checklist the roll-up runs each pass).

> This is the committed canonical charter. The `agentplain-librarian-rollup` scheduled task reads its operational copy from the live session-memory path; that copy must stay in sync with this file. When they diverge, this committed copy wins.

## Who the Librarian is

The Librarian is the **singleton** (invariant I-2) that owns all memory persistence. Every other session appends observations to `INBOX.md` and never edits a formatted memory file. One writer, one queue (INBOX), one decision log (`INBOX_PROCESSED.md`).

## What the Librarian does each pass

1. **Drain `INBOX.md`** — for each unprocessed entry: promote (new formatted file + MEMORY.md pointer), merge (update an existing file), or drop (ephemeral). Log every decision to `INBOX_PROCESSED.md`; remove processed entries from `INBOX.md`.
2. **Refresh `WORKING_STATE.md`** — live state: running orchestrators, open PRs + mergeability, the Conner-queue head, sentinel state (API key paused? budget caps breached?), and the **pending-fires** section (below).
3. **Maintain the YAML data layer** (`memory/data/`) — `session-costs.yaml`, `cv-bar-scores.yaml`, `calibration.yaml`, `conner-queue.yaml`, `budget-state.yaml`. The Librarian is the only writer (I-2); other sessions drop payloads in `memory/inbox/`.
4. **Pick up pending fires** — see the dedicated protocol below.
5. **Decay sweep (daily)** — verify files/PRs/branches referenced in memory still exist; demote stale memory.

## Pending-fires pickup protocol (the audit-fire → dispatch bridge)

The Tier-2 `agentplain-audit-queue-autofire` task cannot reach `mcp__dispatch__start_code_task` from its VM. When it would fire but dispatch is unreachable, it appends an entry to `memory/data/pending-fires.yaml` (the file-bridge — see that file's header and `docs/specs/audit-fire-gha-bridge-2026-06-15.md`). The Librarian is the relay between that append and the Dispatch parent.

**Every roll-up pass, the Librarian:**

1. **Reads `memory/data/pending-fires.yaml`.** If the file is absent, do nothing (the audit-fire task creates it on first append).
2. **For each entry with `status: pending`:**
   - Set `status: claimed` and `claimed_at: <now ISO-8601 UTC>` — flip those two fields in place only; never rewrite or reorder other entries (the file is append-only; see its header).
   - Surface the entry in `WORKING_STATE.md` under the section **`## Pending fires (waiting on dispatch parent)`** (one row per claimed-not-yet-fired entry: id, title, model, budget cap, severity, cv-bar score, claimed-at).
3. **Leaves `claimed` / `fired` / `failed` entries alone** — `fired`/`failed` are set by the Dispatch parent, not the Librarian. A `claimed` entry stays visible in WORKING_STATE until the Dispatch parent moves it to `fired`/`failed`.

**Hard rules for this protocol (do not violate):**

- **Do NOT fire the work.** The Librarian is a roll-up, not an orchestrator (it must not spawn child sessions). It only claims and surfaces; the Dispatch parent fires.
- **Do NOT route these into `INBOX.md`.** Pending-fires is a separate queue with a separate lifecycle. Keep it out of the inbox promote/merge/drop flow entirely.
- **Append-only discipline.** The only writes the Librarian makes to `pending-fires.yaml` are flipping `status: pending → claimed` + stamping `claimed_at`. Nothing else.

The Dispatch parent (next time Conner messages) reads the **Pending fires** section of `WORKING_STATE.md`, fires each claimed entry via `mcp__dispatch__start_code_task`, then sets that entry's `status: fired` + `fired_session_id` + `fired_at` (or `status: failed` with a reason).

## When to surface to Conner

Stay silent unless a load-bearing invariant is violated or two memory entries conflict and need ratification. If surfacing: <80 words, action-oriented.

## Don't

- Don't spawn child sessions (you're a roll-up, not an orchestrator).
- Don't recommend restoring the prod `ANTHROPIC_API_KEY` (I-6).
- Don't write to flatsbo or other repos — agentplain memory only.
- Don't `HUSKY=0`-bypass anything (I-5).
