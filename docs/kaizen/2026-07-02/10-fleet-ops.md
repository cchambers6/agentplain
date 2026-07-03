# Kaizen — Fleet Operations Retro

**Date:** 2026-07-02
**Window analyzed:** 2026-06-09 (Librarian charter ratified) → 2026-07-02
**Scope:** Librarian throughput + YAML staleness, Watchdog signal quality, audit-fire eligibility rate, dispatch reliability, scheduled-task hygiene, INBOX drain cadence, dispatch parent → child pattern reliability, worktree isolation, fleet-token expiry/renewal, brief signal-to-noise, per-agent boundary respect.
**Method:** the six scheduled-task `SKILL.md` files at `C:\Users\conne\Claude\Scheduled\*\`, the live agent-memory mount (`LIBRARIAN_CHARTER.md`, `WORKING_STATE.md`, `LIBRARIAN_LOG.md` — 1,173 lines, `INBOX.md` — 1,634 lines, `data/*.yaml`), the four named memory files, `git worktree list` (199 entries), and the fleet-token recipe memory.

> Every claim below cites a file, log line, timestamp, or measured count. Nothing is invented. One sourcing note up front: the four memory files this retro was asked to read (`LIBRARIAN_CHARTER`, `project_autofire_cannot_fire_dispatch_mcp_disconnected_2026_06_15`, `feedback_librarian_pattern_in_every_orchestrator`, `feedback_persistence_discipline`) do **not** exist in the code-side project memory at `~/.claude/projects/C--agentplain/memory/` — they live only in the Cowork agent-memory mount. All four were located and read there. That split is itself friction #9.

---

## The shape of the loop (baseline facts)

| Tier | Task | Cadence | Cost cap | Observed behavior |
| --- | --- | --- | --- | --- |
| 1 | Librarian roll-up | every 15 min, waking hours | $0.50/run ($30/day) | 185+ consecutive quiet passes logged by 06-29 |
| 1 | Watchdog | every 30 min, 8am–11pm ET | $0.30/run ($9/day) | silent-by-design; PR check needs GitHub API |
| 2 | Audit-queue autofire | 4×/day (9a/1p/5p/9p ET) | <$1/run + $300/run fire budget | fired 0 across every logged run since 06-15 |
| 2 | Morning brief | daily 8am ET | <$1/run | reads WORKING_STATE + budget-state + INBOX |
| — | One-shot reruns | manual | $5–8 | two audit-fire reruns used as loop-read-path proofs |

Total scheduled overhead **cap** ≈ $44/day. Actual spend is unmeasured — `session-costs.yaml` has exactly one real entry (the $50 Fable-5 loss, 06-14) and one null placeholder. The loop that exists to track spend does not track its own spend.

---

## 10 things we do well

1. **The 24/7 loop actually runs, and has for weeks.** Librarian every 15 min, Watchdog every 30 min, autofire 4×/day, brief daily — `LIBRARIAN_LOG.md` shows an unbroken cadence through 07-02 20:53Z, with pass-numbered entries ("185th consecutive quiet," 06-29). This is a real operating system, not an aspiration.

2. **INBOX drain discipline is genuinely clean.** Every logged pass verifies drain state mechanically (`awk` last-PROCESSED marker, `sed` count of `ts:` blocks after it — e.g. the 06-29 16:51Z entry: "marker line 1487 of 1487, 0 ts: blocks after"). Entries move to `INBOX_PROCESSED.md` with a `librarian-decision:` annotation per charter. Nothing observed rotting in the queue.

3. **The Librarian charter is a real contract, not vibes.** `LIBRARIAN_CHARTER.md` specifies the singleton constraint (check `list_sessions` before spawning), the inbox-append protocol every orchestrator prompt must carry, who writes what (only Librarian writes formatted memory), decay/verification rules, and the cross-context recovery path (new session → read `WORKING_STATE.md` first). The companion rule (`feedback_librarian_pattern_in_every_orchestrator`) operationalizes it in every fired prompt.

4. **Autofire no-ops honestly when the queue is empty.** Six consecutive logged runs (06-15 21:05Z → 06-16 17:10Z and onward) each concluded "fired 0, $0 spent" with the reasoning shown: items already in-flight, guardrail-held, or below bar. It never fired to look busy, never double-fired an in-flight item, and the 1pm one-shot rerun was explicitly framed as a read-path proof, not a fire event.

5. **Per-agent boundary respect worked under temptation.** Autofire held the DocuSign send/void gating item (touches the no-outbound guardrail) and the passkey nudge (touches auth) for Conner's call instead of firing them — exactly per its own rules — and both later landed through approved PRs (#280, #279). The "don't fire billing/auth" line held even when the items scored 4/5.

6. **Dispatch-unreachable degraded gracefully into the file-bridge instead of dropping fires.** When `mcp__dispatch__start_code_task` went unreachable (06-15), the response was a designed fallback: append-only `pending-fires.yaml` with a full schema (id, budget cap, CV score, claim lifecycle), Librarian claims, Dispatch parent fires. The path bug in the spec (`C:\agentplain\memory\data\` vs the agent-memory mount) was caught, corrected, and verified in the 06-16 17:10Z rerun.

7. **The fleet self-corrects its own stale state when it gets evidence.** The 06-18 22:22Z Librarian pass, on first getting a reachable git mount, ran auth-free `merge-base --is-ancestor` checks, discovered two "in-flight" branches had actually merged on 06-15 (PRs #276/#277), and wrote a dated STATUS CORRECTION into the memory file rather than silently editing history. Verification method documented inline.

8. **Isolated worktrees are the standard, and they scale.** 199 registered worktrees; every wave in this window (audits 1–10, kaizen 1–10, design directions 1–5, de-AI 1–4) ran in its own tree. The nested-worktree/no-junction pattern and the prisma-EPERM self-install recovery are both codified in memory, so new waves inherit the fix instead of rediscovering it.

9. **The fleet-token push/PR pattern is established and battle-tested.** `mint-fleet-token.mjs` + inline-token push + PR-via-REST is documented with its full trap ledger (bash-vs-node `/tmp`, credential-helper quoting, worktree backslash path, rebased-PR fast-forward recipe) in `project_fleet_push_pr_mechanism`. Ten audit PRs (#323–#330) and the kaizen series landed through it in the last two days alone.

10. **Budget discipline is codified, with an audit trail.** `budget-state.yaml` carries the re-tier audit log (06-22 and 06-29 entries with `inputs_seen` and `reason`), the $150/fix autonomous cap, and autofire checks it before every run ("skip auto-fires if over $200/day"). The audits honestly concluded "insufficient data — hold" rather than inventing a tier change.

---

## 10 patterns causing friction (with evidence)

1. **Librarian YAML staleness perpetuates — the data layer only ingests, never hydrates.**
   As of 07-02: `session-costs.yaml` last updated **06-15** (17 days), `cv-bar-scores.yaml` **06-15**, `conner-queue.yaml` **06-20**, `calibration.yaml` **06-22**. `budget-state.yaml` has carried `week_to_date_usd: null` for **three consecutive weeks**, forcing two re-tier audits (06-22, 06-29) to conclude "insufficient data — no change." Root cause is architectural: the Librarian only appends when a session report lands in INBOX. No session reports → YAML rots, even though every number it needs (merges, PR counts, session costs) is derivable from primary sources the roll-up can already reach.

2. **Brief calibrations go stale on load-bearing rules.** The morning brief reads `WORKING_STATE.md` + `budget-state.yaml` + INBOX as gospel. `calibration.yaml` — the file that exists to correct fact-vs-claim deltas — was 10 days stale at window close, and the brief has no step that re-verifies its own inputs before publishing. The 06-16→06-18 episode is the proof: WORKING_STATE said two branches were "in-flight NOT merged" for ~13 passes after they'd merged, and every consumer downstream (brief, watchdog, autofire) repeated it.

3. **Dispatch MCP has been unreachable from scheduled-task VMs for 17 days with no fix landed.** `project_autofire_cannot_fire_dispatch_mcp_disconnected_2026_06_15` named "dispatch reconnect" the load-bearing fleet action on 06-15; the 07-02 20:53Z WORKING_STATE pass still logs "Dispatch MCP UNREACHABLE → file-bridge fallback." The file-bridge only converts to work "on Conner's next message" — so the Tier-2 autonomy loop has a human-in-the-loop bottleneck it was explicitly built to remove. The GHA bridge spec (`docs/specs/audit-fire-gha-bridge-2026-06-15.md`, built as `feat(loop)` 06-15 17:39) exists but the loop still reports fallback mode.

4. **Fleet-token expiry silent-fails PR-open.** Installation tokens live ~1h; two back-to-back pre-push build gates can eat the TTL, so the push succeeds and the PR REST call 401s (documented in `project_fleet_push_pr_mechanism`; recurred on the 07-02 audit-5 wave — "fleet token 401s" is in that audit's memory summary). Re-minting before the REST call is a *recipe agents must remember*, not a wrapper that does it automatically — every new wave re-risks a pushed-branch-no-PR orphan.

5. **The brief repeats the same actions daily with no aging signal.** The Conner queue has held the same 5 pending items since ~06-20 (design partners on record, legal entity + IP, CAN-SPAM postal address, ROI-email dedupe, flatsbo PAT revoke) — every LIBRARIAN_LOG pass and every brief re-lists them verbatim. Most damning concrete case: **the leaked flatsbo PAT (exposed 06-09) is still unrevoked 23 days later** while appearing in the queue daily. Repetition without escalation trains the reader to skim; a security item aged out of attention.

6. **WORKING_STATE drift + snapshot bloat.** The memory dir holds **264** `WORKING_STATE.md.preXXXX` snapshots plus `.bak`/`.bak2` files (~435 files total) — per-pass backups with no prune, flagged as "candidate for a batched prune" in the log for days without action. Meanwhile the state itself drifted where verification was blocked (friction #2's 13-pass stale in-flight table), and `conner-queue.yaml` was once truncated mid-item by a bad write and had to be restored from a memory file (06-15 22:22Z repair note).

7. **Audit-fire fires 0 for weeks — the loop is healthy but the queue is starved, and nothing distinguishes the two.** Every logged autofire run since 06-15 fired 0. Post-06-16, that's not the in-flight rule — it's an empty queue: INBOX shows no new `audit-queue regression` items after the 06-16 seeder pass, while the same window's manual audits (depts 1–10, 07-02) surfaced 11+ P0s. The seeder isn't feeding the queue the fleet's own auditors are filling PRs with. No seeder-health check exists; "0 eligible" and "seeder dead" produce identical run reports (the rerun-2 SKILL.md even had to spell out "if INBOX is STILL empty, that's the proof the seeder isn't producing").

8. **Quiet-pass burn: the cadence doesn't back off when the fleet is quiet.** 185+ consecutive quiet Librarian passes at 15-min cadence — each one re-verifying "INBOX drained, main unchanged, nothing written" — against a fleet that was idle for a full week (main held at 02f98e3 all of 06-22→06-29 per the re-tier audit log). Caps bound the worst case (~$30/day Librarian alone), but actual spend is unmeasured (friction #1), and the passes' only output was the log entry saying they had no output.

9. **Two memory systems, no cross-index.** The fleet's operating memory (charter, WORKING_STATE, YAML layer, pending-fires) lives in a Cowork agent-memory mount addressed by a 200-char session-UUID path; the code-side fleet loads `~/.claude/projects/C--agentplain/memory/`. Neither indexes the other. This retro's own read list cited four files absent from the code-side index; the scheduled-task SKILL.md files hard-embed the UUID paths — and one (`audit-fire-manual-rerun-2`) shipped with a **typo'd UUID** plus an inline note telling the agent to go find the right one, while `agentplain-librarian-rollup`'s "NOTE: the correct memory path is…" itself contains a *different* wrong UUID. Every path edit is a silent no-op risk for a fresh-session agent with no memory to catch it.

10. **Scheduled-task hygiene: one-shots never get retired and near-duplicates accumulate.** `audit-fire-manual-rerun-1pm` and `audit-fire-manual-rerun-2-after-seeder` — both explicitly one-shot, both spent — still sit in `C:\Users\conne\Claude\Scheduled\` alongside the recurring autofire, three tasks sharing ~90% of a mission statement with drifted copies of the same path corrections. There is no archive/expiry lifecycle for scheduled tasks, so the directory accretes dead prompts that a future edit has to keep consistent by hand.

---

## Top 5 process improvements

1. **Data-first Librarian: hydrate the YAML layer from primary sources on every roll-up.** Stop waiting for session reports to appear in INBOX. Each pass (or each hourly pass, to bound cost) should *derive* the data layer: merged-PR count and merge cadence from `git log origin/main`, open-PR state from the REST API it already uses, week-to-date session costs from Cowork session metadata where readable. `week_to_date_usd: null` for three weeks while the answer sat in reachable sources is the defining miss of this window. Acceptance: no `data/*.yaml` file more than 24h older than its newest reachable primary source; the 07-06 re-tier audit runs on real numbers.

2. **Expand the Watchdog from observer to actor on verified, bounded items.** Today it can only SendUserMessage. Give it a small actuation whitelist: re-mint an expired fleet token and retry a failed PR-open (friction #4), file a pending-fire for a stuck-PR fix, mark a resolved Conner-queue item. Keep the guardrail categories (billing/auth/outbound) message-only. The DocuSign/passkey episode proves the boundary rules hold; the watchdog earns actuation on the classes where it's been right for weeks.

3. **SLA on Conner-queue item age, with escalation tiers.** Every queue item gets `created` + `sla_days` by class (security = 3 days, legal/business = 14). Items past SLA move from "listed in the brief" to a distinct top-of-brief ESCALATED block with age in days, and security items past 2× SLA trigger a standalone watchdog ping. The flatsbo PAT at 23 days unrevoked (friction #5) is the case that must never recur. Acceptance: no security-class item exceeds SLA without a dedicated (non-brief) notification.

4. **The brief self-calibrates before publishing.** Two cheap steps before SendUserMessage: (a) re-verify load-bearing claims against live sources — `git ls-remote` for main, is-ancestor for any "in-flight" branch, file mtimes for every YAML it quotes, flagging anything stale >24h as "UNVERIFIED (stale N days)" instead of asserting it; (b) diff against yesterday's brief and compress unchanged items to one "carried: N items, oldest X days" line so new signal is the brief's body, not its garnish. This turns friction #2 and #5 into rendering rules rather than editorial hopes.

5. **Wire dispatch into the scheduled-task VMs — or finish promoting the file-bridge to a first-class dispatcher.** The 17-day fallback is the single biggest autonomy leak (friction #3). Either (a) reconnect the dispatch MCP in the Cowork scheduled-task environment, or (b) land the already-spec'd GHA bridge (`docs/specs/audit-fire-gha-bridge-2026-06-15.md`) so a `pending-fires.yaml` append triggers a fire within minutes without waiting for Conner's next message. Pair it with a seeder heartbeat (friction #7): the seeder stamps `last_run` + `items_emitted` into the data layer, and autofire reports "queue empty (seeder ran 4h ago, emitted 0)" vs "queue empty (seeder silent 5 days — investigate)" as different states.

---

## Top 3 investments

1. **Fleet Ops dashboard for Conner.** One page (repo-served, reading the YAML layer + GitHub API): loop heartbeats (last pass per tier, consecutive-quiet count), YAML freshness meters, INBOX depth in/out, pending-fires queue state, fleet-token last-mint/last-401, Conner-queue items with age-vs-SLA coloring, and week-to-date spend. Today this picture exists only by reading a 1,173-line log file; the operator of a 24/7 fleet should get it in one glance. This is also the forcing function for improvement #1 — a dashboard over stale YAML is visibly red, so freshness becomes self-enforcing.

2. **Agent-workload distribution + queue-depth metrics.** Instrument the pipeline end to end: items entering INBOX per day, time-to-drain, fires requested vs fired vs converted-to-merged-PR, per-agent PR throughput, and time-in-queue for pending-fires and Conner-queue items. The window's blind spots — a starved audit queue next to auditors producing 11+ P0s, a week-idle fleet under a full-cadence polling loop — are both distribution problems that per-run logs structurally cannot show. This data also feeds the re-tier audit, which has now aborted twice for lack of exactly these numbers.

3. **Brief-quality feedback loop.** Close the loop on the fleet's highest-frequency customer surface (Conner reads the brief daily): a one-tap 👍/👎 + optional one-liner per brief section, appended to `calibration.yaml` by the Librarian, with a weekly roll-up into the kaizen retro. Signal-to-noise is currently tuned by guesswork; 30 days of reactions turns "brief repeats itself" from a retro finding into a measured, trending metric — and gives calibration.yaml the steady data stream it has lacked since 06-22.

---

## Sourcing gaps (stated, not papered over)

- **Actual scheduled-task spend is unknown.** Caps are documented per SKILL.md; real per-run costs were never reported into `session-costs.yaml`. Every dollar figure above is a cap, not a measurement.
- **Watchdog run history is not directly observable** — it logs nothing durable when silent (by design). Its friction entry (#2's downstream, #4's non-automation) is inferred from its SKILL.md contract plus the shared stale-input problem, not from run transcripts.
- **Morning-brief transcripts were not readable from this session**; "repeats daily" is grounded in its inputs being unchanged (conner-queue frozen since 06-20, LIBRARIAN_LOG repeating the same 5 items per pass), not in captured brief outputs.
