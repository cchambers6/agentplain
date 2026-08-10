# Prevention architecture — 2026-08-09

**Layer above** `docs/plans/2026-08-09-remediation-plan.md` (PR #398). The remediation plan fixes the 30 specific defects; this document makes the *class* of failure structurally impossible to go unnoticed again. Companion audit: `docs/audits/2026-08-09-full-audit.md` (PR #397 — read its corrections banner first; the retracted claims are not findings).

**Authored by:** Fable (planning). **Implemented by:** Opus sessions, per the execution units in §5. **Ratifier:** Conner, for §6 only — one JUDGMENT item plus one packaged accept/reject recommendation (queue item 7, delegated 2026-08-09). Everything else is resolved here.

**Rev 2 (same day):** adds root cause 7 (doctrine rot) + mechanism M7 + EU-11/EU-12, and replaces the J-2 open question with recommendation R-1, incorporating the post-prune host measurements.
**Rev 3 (same day):** adds root cause 8 (approval-blocked sessions are undetectable stalls — observed live during this spec's own execution) + mechanism M8 + EU-13.

---

## 0. What actually happened, compressed to its mechanism

Eight root causes — seven from the 2026-08-09 audit cycle, one observed live during this spec's own execution:

1. **No external liveness monitor.** Every watchdog runs on the scheduler it monitors and dies with it. Three consecutive audits each found a different dead task; all three were found because a human manually asked.
2. **No consumer for escalations.** `conner-queue.yaml` holds 11 pending items, some two months old. The L3 governor escalated correctly on 07-19; nobody answered. Detection without a reader is theatre.
3. **Silent success.** A task that runs and produces nothing is indistinguishable from a healthy one on every signal except artifact mtime. The L3 heartbeat's deferred tick was *specified* to "append nothing, write nothing" — silence was made spec-correct.
4. **Unverified inference presented as finding.** The audit produced four false findings from slot arithmetic and a wrong path, and relayed a dramatic number before checking it.
5. **Work that never lands.** `main` sat 28 days with 8 green PRs unmerged. No alarm exists for merge latency.
6. **Host fragility.** A 16 GB desktop running 40+ plugin processes is the substrate everything depends on. *(Post-prune update, 2026-08-09 late: Conner pruned the plugins — free RAM 0.98 → 4.60 GB, node MCP processes 24/2.40 GB → 14/0.91 GB, ~3.6 GB recovered. The acute wedge driver is gone cheaply; the structural half — one host, no redundancy, monitor inside the monitored — is unchanged and is what M1/M6 and R-1 address.)*
7. **Doctrine rot: a negative probe result becoming permanent fact.** A single failed probe of *one* mechanism gets generalized into a standing architectural constraint, written into a prompt, and never retested — where it hardens and shapes later design. Live instances: `chiron-build-heartbeat`'s prompt says *"Do NOT attempt to spawn a resume Fable via dispatch. Prior attempt showed dispatch is unavailable from this scheduled context"* (sitting since at least 08-01); `fire-path-probe-2026-07-19` tested only the ambient credential helper yet became "the runner cannot push" (the premise behind three weeks of L3-loop design, flagged UNPROVEN by the audit); the "build-gate OOMs above 8 GB" belief later **failed to reproduce** at 8192 MB. This is arguably how several of the other six became load-bearing: constraints nobody could cite evidence for were steering the architecture.
8. **A session blocked on an unanswered tool-approval prompt is an undetectable stall.** Observed live, 2026-08-09, during this spec's own execution: the Opus session on queue item 1 (`local_0baf88be-7cd0-446d-8bd9-2be91aa8e75c`) called `create_scheduled_task`, hit an approval prompt, and froze at turn 96 for ~40 minutes. From outside it was indistinguishable from slow work: status `running`, turn count static, last output a perfectly reasonable in-progress line. A blocked session cannot read its own inbox, so the orchestrator's status query went unprocessed — and an orchestrator can itself be blocked the same way, so no fixed depth of watcher-sessions closes this. It surfaced only because a human polled three times, noticed the static turn count, and then checked **the artifact** — `git log origin/main`, still at `5606114` — which contradicted the "deep in it" progress report already relayed once without verification. This is root cause 3's shape (healthy-looking wait state, no distinguishing signal), compounding root cause 2 (the approval prompt *is* an escalation, raised correctly, with nobody reading it) and root cause 4 (progress asserted from session state instead of evidence).

Two hard design constraints, applied throughout:

- **Every check is falsifiable and self-testing.** Each mechanism ships with a deliberate-failure test proving it fires. An unfired alarm and a broken alarm are indistinguishable — that indistinguishability is the bug being fixed.
- **Fewer, load-bearing mechanisms over comprehensive coverage.** Anything requiring discipline to maintain will rot the way the last three audits' findings rotted. Everything here either breaks loudly when neglected or is exercised automatically on a schedule.

**Ship-day falsification rule:** several of these checks MUST fire immediately on today's real data (11 stale queue items, 8 stale green PRs). A prevention layer that ships green on today's repo is broken by construction. The acceptance tests in §5 encode this.

---

## 1. The architecture in one chain

Everything reduces to one chain of custody for the question *"is the fleet alive and is its output landing?"* — with each link watched by the next link **in a different failure domain**, and the regress deliberately terminated at a human habit:

```
every recurring task                      (on-host; failure domain: task/prompt)
  └─ writes ≥1 status line per run  ──►  per-task ledger (agent store)
       └─ read by the contracts checker   (on-host, watchdog session;
          every 30 min                     failure domain: host)
            └─ findings + host census + queue mirror + git state
               pushed as one JSON payload  ──►  ops/heartbeat branch on GitHub
                 └─ read by 3 GHA workflows (GitHub infra; outside the
                    on cron                  host failure domain by construction)
                      ├─ fleet-liveness: heartbeat stale >2h → red + issue
                      ├─ decision-escalation: queue item pending past SLA → issue
                      └─ delivery-latency: green PR >7d / main frozen / local-ahead → issue
                        └─ issues + emails ──► Conner   (human; outside GitHub's domain)
                             ▲
                             └─ monthly auto-drill forces the alarm path to fire
                                and the morning brief reports the age of every
                                monitor's last run and last drill
                                  └─ regress terminates: Conner notices the
                                     absence of the Monday brief. (§1.1)
```

### 1.1 Where the regress stops, and why stopping there is safe

Every monitor can die. The chain above is finite because it terminates in **two independent human-facing channels that each report on the other**:

- **On-host channel:** the morning brief (existing task, amended in EU-10) carries a monitors footer — heartbeat age, last run of each GHA workflow, last drill date. If GHA machinery dies, the brief says so.
- **Off-host channel:** GHA issues/emails. If the host dies, GHA fires within 2 h.

For both to fail *silently*, the host and the GitHub workflows must die in the same window **and** Conner must not notice the missing daily brief. A missing expected email is one of the few absences a human reliably notices — it is a *positive* recurring signal, not an alarm that only exists when something is wrong. Adding a third machine to watch the second would itself need watching; the regress must terminate at a human, and a daily-cadence expected email is the cheapest reliable human check that exists. GitHub's own default behaviour — emailing the repo owner when a scheduled workflow run fails — is a platform-level fallback underneath all of this that we do not maintain.

Residual risk accepted: GitHub itself down simultaneously with the host, or Conner away and not reading email for a week. Both are recorded in §7 (survivable, not preventable).

---

## 2. The eight mechanisms

Naming: **M1 Pulse**, **M2 Reader**, **M3 Earned Green**, **M4 Evidence Discipline**, **M5 Landing Alarm**, **M6 Headroom Ratchet**, **M7 Doctrine Expiry**, **M8 Artifact Truth**. Eight mechanisms, but only **three moving parts**: one on-host publisher (M1's writer + M3 + M6 sampling), one off-host workflow trio sharing one issue-upsert helper (M1's reader + M2 + M5 + M6 thresholds), and one evidence toolchain (M4, which M7 extends). Everything else is configuration in three YAML files.

---

### M1 — Pulse: off-host liveness on a positive heartbeat

**Mechanism.** The existing `agentplain-watchdog` task (cron `0,30 * * * *`) gains one step: run `node scripts/ops/publish-heartbeat.mjs`, which PUTs a single file `heartbeat.json` to a dedicated branch **`ops/heartbeat`** via the GitHub Contents API using the fleet token (the documented mint recipe; no new credential, no local git required, works from any session). The branch's **commit history is the outage ruler**: gaps between commits are non-disputable outage durations, measured on GitHub's clock. This retires the class of dispute the audit could not resolve ("~3 days vs ~139.7 h").

An hourly GHA workflow `.github/workflows/fleet-liveness.yml` reads the head-commit timestamp of `ops/heartbeat` via the API (no checkout needed). If older than **2 hours**, the run goes red and upserts a GitHub issue labeled `fleet-down`. Threshold rationale: 2 h = 4 missed 30-min heartbeats — absorbs the scheduler's evidenced episodic drops (the 84-minute librarian gap of 07-19) without false alarms, while converting a 139-hour outage into a ≤2-hour detection. The evidenced ~12h46m gap of 07-18 would have fired — correctly.

**Alarm on staleness only, never on error signals.** This failure mode produces no errors — only absence. The workflow's health condition is "heartbeat is recent," and its alarm condition is the negation. Nothing in the alarm path depends on the host being able to say anything.

**Where it runs and why that's outside the failure domain.** The writer is on-host (it must be — only the host knows it's alive). The *reader* runs on GitHub's infrastructure, which is immune to host death by construction: no process, file, or scheduler on Conner's desktop is in its dependency chain. This is the exact inversion of `scheduler-liveness-watchdog`, which died with the thing it watched.

**Trigger.** Writer: every watchdog run. Reader: GHA cron, hourly (GHA cron is best-effort; the 2 h threshold already absorbs typical delay).

**Consumer, and how consumption is known.** A red run creates/updates the `fleet-down` issue → GitHub notifies Conner by email. Consumption receipt: the issue **auto-closes with a recovery comment** when the next fresh heartbeat is observed, stamping the measured outage duration into the issue — so every outage leaves a dated, human-visible record with its true length, whether or not anyone acted. If the issue is open >24 h it is also surfaced by the brief footer (EU-10) and re-bumped by the workflow's next red run (upsert = comment, not duplicate issue).

**Failure mode and what watches it.** The workflow can be disabled, deleted, or starved by GHA (GitHub auto-disables scheduled workflows after 60 days of repo inactivity — the heartbeat pushes themselves are repo activity, so this cannot trip while the fleet is alive; a long full-fleet outage pauses the *hourly* cron but not GitHub's failed-run emails from the runs before disablement, and the brief footer flags the workflow's last-run age going stale). Primary watcher: the **monthly auto-drill** (below) — a broken alarm fails its drill, and a drill that doesn't happen is caught by the brief footer's `last drill: N days ago` line going past 35 days. Regress terminates per §1.1.

**Deliberate-failure test.** `fleet-liveness.yml` declares `workflow_dispatch` with input `simulate_stale: true`, which evaluates the heartbeat as if its timestamp were epoch 0. Firing it MUST produce a red run and a `[DRILL]`-prefixed `fleet-down` issue. This exact dispatch is also run automatically by the monthly drill cron (first of the month), which then auto-closes its own issue with a `drill-ok` comment. The drill proves, monthly and without human effort, that the staleness logic, the issue path, and the notification path all still fire. Ship-day: run it once manually and confirm the issue and the email both arrive (J-1).

---

### M2 — Reader: a consumer for escalations, with escalation for non-consumption

This is the big one. The 2026-08-09 conclusion that outranks every individual defect: **the escalation machinery works; nothing reads it.** The fix is not a better writer — it is a reader whose *absence of reading* is itself loud.

**Mechanism.** Three parts:

1. **Queue mirror (on-host, rides the heartbeat).** `publish-heartbeat.mjs` includes a sanitized mirror of the live `conner-queue.yaml` in `heartbeat.json`: for each item, only `id`, `title` (truncated to 200 chars), `status`, `raised`, `priority`, `snooze_until`. Amendment-note prose is never mirrored (it has carried near-secrets). The publisher runs a secret-pattern scan (`ghs_|ghp_|github_pat_|-----BEGIN`) over the full payload and **hard-fails the publish** on any match — a missed heartbeat is strictly better than a leaked token, and the miss is itself caught by M1.
2. **Escalation reader (off-host).** `.github/workflows/decision-escalation.yml`, daily cron. Reads the mirror from `ops/heartbeat`. For every item with `status: pending` and no future `snooze_until`: pending **>7 days** → upsert one GitHub issue per item, labeled `decision-overdue`, titled with the item id and age, body carrying the title and recommended default from the mirror. Pending **>30 days** → the daily run adds a bump comment (max one per week) so the issue resurfaces in notifications. If the mirror itself is stale (host down), the reader holds and escalates **last-known state** — overdue is overdue regardless of whether the host is currently up; it does not go quiet just because the writer died.
3. **Answering semantics.** An item is *consumed* when its `status` leaves `pending` (answered / rejected / resolved-*) **or** it gains a `snooze_until` date. Snooze is a legitimate answer — the goal is *no silent pending*, not forced action. The reader closes an item's issue automatically on the first mirror showing it consumed.

**Where it runs and why that's outside the failure domain.** The queue's writer (Librarian/governor) is on-host; the reader is on GHA. The failure being designed against is "written faithfully, read by nobody" — so the reader must not share fate with the writer, the host, *or Conner's attention*. GHA + GitHub notifications reach Conner on a channel he already uses daily for other reasons (GitHub email on his phone — J-1 verifies reach), rather than a file only fleet sessions open.

**Trigger.** Daily cron, plus `workflow_dispatch` for the ship-day test.

**Consumer, and how consumption is known.** Conner, via GitHub issues/notifications, and via the morning brief which (per remediation W1-4, already planned) leads with the queue. Consumption receipt is **structural, not hopeful**: the queue file's own status field changes, observed in the next mirror, closing the issue. An unchanged status keeps the issue open and bumping. There is no state in which an item is pending, past SLA, and invisible.

**Failure mode and what watches it.** Workflow dies → brief footer reports its last-run age (EU-10); shared `fleet-ops` labels make the whole family greppable. Mirror generation dies but heartbeat survives → impossible by construction: mirror and heartbeat are one payload, one publish, one commit — they cannot diverge. Payload malformed → the reader treats unparseable mirror as "stale mirror" and keeps escalating last-known state, plus flags a `fleet-ops` issue naming the parse failure.

**Deliberate-failure test.** The reader's core logic lives in `scripts/ops/escalate-decisions.mjs` (the workflow is a thin shell), with a `--fixture` mode. CI runs the fixture test on any PR touching it: a fixture queue with one item backdated 45 days MUST produce exactly one create-issue action and one bump action (asserted against a dry-run action log, no live API). Ship-day live test: the first real run against today's mirror MUST open issues for the currently-pending items past SLA — with 11 pending items, several months old, **a first run that opens zero issues is a failed acceptance test.**

---

### M3 — Earned Green: silent success made illegal

**Mechanism.** Two rules and a checker.

**Rule 1 — the one-line law.** *No recurring task may have "write nothing" as a legal outcome.* Every recurring task's prompt is amended (EU-4) to end every run — including no-op, deferred, and error runs — by appending exactly one line to its own ledger at `<agent_store>/memory/data/status/<task-name>.log`:

```
<ISO-8601-UTC> | <task-name> | <verdict: OK|NOOP|DEFERRED|ERROR> | <one clause>
```

~80 bytes per run. This is the L3 heartbeat's own late fix (`l3-heartbeat-status.txt`, 2026-07-19) promoted from a one-off to a law. It dissolves the ambiguity that produced the audit's worst errors: **execution counts become countable facts** (`grep -c` on a ledger) instead of slot arithmetic, and "ran but chose to write nothing" becomes a distinguishable, logged verdict instead of silence. "Cheap and idempotent" no longer implies "invisible."

**Rule 2 — the contract registry.** `ops/task-contracts.yaml` (in-repo, one entry per recurring task): task name, cron cadence, ledger path (via logical store root, §M4), declared artifact paths, mode (`every-run` = artifact must advance; `on-change` = only the ledger must advance), and the host limits used by M6. The registry is **bidirectionally enforced** (the same pattern as the deletion-sweep DMMF gate): a scheduled task not in the registry is a finding; a registry entry whose task is absent from the scheduler is a finding. Tombstoned-but-enabled and disabled-but-unexplained tasks (the P1-4 class) can no longer hide — the registry entry carries an explicit `disabled_reason` field or the mismatch fires.

**The checker.** `scripts/ops/check-task-freshness.mjs`, run inside every watchdog session (the session fetches `lastRunAt` per task via the scheduled-tasks MCP and hands the checker a JSON snapshot; the script itself never guesses at scheduler state). Per contract, it compares three clocks — scheduler `lastRunAt`, ledger tail timestamp, artifact mtimes — and emits a finding on any pairwise disagreement beyond `3 × cadence`:

| Disagreement | Finding |
|---|---|
| `lastRunAt` fresh, ledger stale | `task-silent` — ran but wrote nothing (now illegal) |
| ledger fresh, `lastRunAt` stale | `scheduler-record-drift` |
| both stale | `task-not-running` (M1's domain if fleet-wide) |
| every-run artifact stale, ledger fresh | `artifact-missing` — running but not producing |
| registry/scheduler mismatch | `unregistered-task` / `orphan-contract` |

Findings ride the heartbeat payload; the fleet-liveness workflow turns any finding into an upserted `fleet-ops` issue naming the task. Green is now **earned**: a task shows healthy only when scheduler, ledger, and artifact agree.

**Where it runs and why.** On-host, inside the host failure domain — deliberately and unavoidably: ledgers and artifact mtimes exist only on the host. Its blind spot (whole host down) is exactly M1's coverage; M1's blind spot (host up, one task silently dead) is exactly this mechanism's coverage. The union is total; each watches the other's blind side from a different domain. This is the honest answer to "why is an on-host check acceptable here" — it isn't a monitor of the host; it is a monitor of individual tasks, delivered off-host.

**Trigger.** Every watchdog run (every 30 min).

**Consumer.** Findings → heartbeat → GHA issue → Conner; also summarized in the brief footer. Consumption receipt: the issue auto-closes when the finding clears in a subsequent payload.

**Failure mode and what watches it.** The checker itself is a recurring behaviour of the watchdog, and the watchdog has its own contract entry and ledger — a watchdog that stops running its checker stops advancing `contracts.checked` in the payload, which the fleet-liveness workflow flags as `checker-stale` (the payload carries a per-section timestamp precisely so an old checker result can't ride a fresh heartbeat unnoticed). Beyond that, the regress terminates at M1 + §1.1.

**Deliberate-failure test.** `check-task-freshness.mjs --self-test`: creates a temp contract fixture with a backdated ledger, runs the real comparison code, asserts **exactly one** finding naming that task, exits 0 on pass / 1 on fail. Runs in CI on any PR touching the script, and once per day inside the watchdog session (self-test failure is itself a finding). Command and expected output are in EU-3.

---

### M4 — Evidence Discipline: the prevention layer cannot repeat the audit's errors

The audit's four false findings came from three moves: reading the wrong store, multiplying cadence by elapsed time, and reading spec-correct silence as failure. The third is dissolved by M3 (silence is now illegal, so its absence is meaningful). The other two get mechanical guards — plus a rule that keeps *this* layer honest.

**Mechanism, part 1 — canonical-path registry.** `ops/canonical-paths.yaml` names every logical store with its absolute path, its **liveness tell**, and its known-bad decoys:

```yaml
agent_store:
  path: 'C:\Users\conne\AppData\Roaming\Claude\local-agent-mode-sessions\e96926c9-f6b4-447c-b651-556629bc1f98\3e6a77a8-104b-4774-8239-85aac4c3463b\agent\memory'
  aliases:   # same directory via the Windows Store redirect — valid
    - 'C:\Users\conne\AppData\Local\Packages\Claude_pzs8sxrjxfjjc\LocalCache\Roaming\Claude\local-agent-mode-sessions\e96926c9-f6b4-447c-b651-556629bc1f98\3e6a77a8-104b-4774-8239-85aac4c3463b\agent\memory'
  tell: { file: INBOX.md, pattern: '\[PROCESSED', min_count: 100 }
  known_bad:
    - 'C:\Users\conne\.claude\projects\C--agentplain\memory'   # inert twin — same filenames, dead tree
    - 'e96926c9-f6b4-47c4-a702-d6675a2c7361'                    # corrupted GUID from the old Librarian prompt; if seen anywhere, it is wrong
```

`scripts/ops/resolve-store.mjs <logical-name>` prints the absolute path **only after the tell passes** (exit 2 naming the failed tell otherwise; exit 3 if the resolved path matches a `known_bad` entry). Every ops script here (`publish-heartbeat`, `check-task-freshness`) resolves paths exclusively through it, and the Librarian/audit prompts are amended to call it before any memory read. Falling into the dual-store trap now requires ignoring a hard error, not merely following stale instructions. (This implements and then supersedes remediation W2-6's pointer-stub: the stub helps humans; the registry stops machines.)

**Mechanism, part 2 — measured numbers only.** The ops scripts are structurally incapable of slot arithmetic: every count they report is a `grep -c` over a ledger or a stat over a file, never `cadence × elapsed`. Because audits will now inherit their execution counts from these ledgers (M3), the incentive to derive counts disappears with the need.

**Mechanism, part 3 — findings schema + validator.** Structured findings (from monitors and future audits) conform to a schema: every finding carries `claim`, `class: MEASURED | INFERRED`, and for MEASURED at least one evidence ref `{kind: file-stat | command-output | api-response, ref, captured}`. `scripts/ops/validate-findings.mjs` enforces: numeric execution/run/tick claims without command-output evidence are forced to `INFERRED`; **INFERRED findings cannot carry severity above P2 and can never trigger an escalation rung** — inference may inform, never alarm; any memory path referenced must resolve through the canonical registry. The audit prompt template is amended to require emitting findings in this format and running the validator before publishing.

**Honest limit, stated plainly:** part 3 guards structured outputs. A future audit written as free prose can still assert nonsense — the mitigation is that the audit *template* requires the structured file, and the pre-merge review gate (already in force) reviews load-bearing PRs. This is the one mechanism in this document that retains a discipline component; it is deliberately the smallest one, and its mechanical core (parts 1–2) covers the two errors that actually happened.

**Where it runs and why.** The validator runs in CI on PRs touching `docs/audits/**` or findings files — CI is outside the authoring session's failure domain (an author who fooled themselves cannot also pass the independent check without evidence). The registry check runs inside every ops-script invocation, on-host, because paths are a host fact.

**Trigger.** Registry: every ops-script run. Validator: CI on matching PRs; also invocable ad hoc.

**Consumer.** A red CI check on the PR — consumed by whoever merges (the pre-merge review gate makes an unreviewed red merge a second, separate violation). Consumption receipt: the check turning green in the PR timeline.

**Failure mode and what watches it.** The registry can go stale (session GUID changes when the agent-mode session is recreated). That failure is **loud by design**: the tell fails, every ops script exits 2, the heartbeat publish fails, and M1 goes red within 2 h — a stale registry cannot produce silent wrong reads, only a visible outage, which is the correct trade. The validator rotting is caught by its own fixtures failing in CI.

**Deliberate-failure test.** Fixtures encode **the four actual retracted claims of 2026-08-09** (`~3,336 silent executions`, `~850 silent ticks`, `silent no-ops are a class`, `no escalation path`) as structured findings with the evidence they actually had. `node scripts/ops/validate-findings.mjs --fixtures` MUST reject all four, each with the rule that catches it, exit 1. `resolve-store.mjs` pointed at the inert tree MUST exit 3 naming it as `known_bad`; pointed at a copy whose tell fails MUST exit 2. All in CI.

---

### M5 — Landing Alarm: work that never lands becomes loud

**Mechanism.** `.github/workflows/delivery-latency.yml`, daily cron, GitHub REST from GHA:

- **Stale green PR:** open, non-draft, CI-green, mergeable, older than **7 days** → upsert one issue per PR, label `delivery-stalled`; a bump comment weekly thereafter.
- **Frozen main:** `origin/main` head older than **14 days** *while at least one green PR is open* → a distinct `delivery-stalled` issue (frozen main with nothing to merge is not an alarm — the condition is *unlanded finished work*, not inactivity).
- **Unpushed local work:** `heartbeat.json` carries `git.local_main_ahead` (computed on-host by the publisher). Ahead-count > 0 → issue; auto-closes when it returns to 0.

Thresholds are constants at the top of the workflow's script — editable in one place, defaults ratified by merging this spec.

**Where it runs and why.** GHA — outside the host domain *and* outside the "fleet builds things" domain. The failure here is a missing **human** action (merging is Conner-side by policy), so the alarm must live where the human's attention already is (GitHub, where the merge button is) and must not depend on any fleet component that has an interest in reporting itself productive.

**Trigger.** Daily cron + `workflow_dispatch`.

**Consumer.** Conner, via the issues; the brief leads with them via the queue/footer. Consumption receipt: merging (or closing) the PR auto-clears the condition and the workflow closes the issue on its next run — consumption is the *repository state changing*, not an acknowledgement flag someone can set without acting.

**Failure mode and what watches it.** Same family watcher as M2: brief footer reports last-run age; drill infrastructure shares the upsert helper, so a broken issue path fails the monthly drill visibly.

**Deliberate-failure test.** Fixture mode in CI (`escalate` logic shared with M2's script pattern): a fixture PR list with one 30-day green PR MUST produce exactly one create action. Ship-day live test: the first real run MUST open issues for the currently-stale green PRs — **8 exist today; zero issues on first run = failed acceptance.** (If W0-3 lands the backlog before this ships, the ship-day test switches to the fixture + one manufactured stale condition — the unit spec includes both paths so no judgment is needed.)

---

### M6 — Headroom Ratchet: the host can't be fixed, but it can be watched from outside

The host wedge is the one root cause this architecture does **not** claim to prevent (§7). What it does: give early warning before the wedge, make regrowth of the load loud, and make the crash visible in ≤2 h with a measured duration.

**Mechanism.** The heartbeat publisher samples per run: free RAM (GB), `claude` process count/RSS, `node` MCP process count/RSS (the same PowerShell census the outage postmortem used). Thresholds live in `ops/task-contracts.yaml` under `host_limits` — defaults: `min_free_gb: 2`, `max_node_mcp_procs: 15` (the load-bearing set per the outage memo is ~6–8 servers; 15 allows slack while sitting far below the 24 that participated in the wedge; after remediation W4-1's prune, tighten to measured + 50%, a one-line edit). The fleet-liveness workflow evaluates the **latest payload against the limits off-host** and upserts a `fleet-ops` warning issue on breach. Evaluating off-host matters: a host sliding toward a wedge is exactly the host you cannot trust to raise its own alarm — the last heartbeats before the 08-06 wedge would have carried the warning signs, and even an instantaneous wedge is caught by M1's staleness within 2 h.

The proc-count limit is a **ratchet against sprawl regrowth**: plugin bloat regrew silently once; now every install that pushes the census past the ceiling opens an issue naming the count. The ceiling only moves by editing a tracked file in a PR.

**Where/trigger/consumer/failure/test.** Rides M1 entirely: sampled on-host (only place the data exists), judged off-host, consumed via the same issue path, watched by the same drill, and tested by `workflow_dispatch` input `simulate_breach: true` which evaluates a fixture payload with `free_gb: 0.5` and MUST produce the warning issue. No new moving part.

*Post-prune calibration:* measured 2026-08-09 after the prune — 14 node MCP processes / 0.91 GB, 4.60 GB free. The `max_node_mcp_procs: 15` default now sits at measured + 1: deliberately snug, so regrowth of even two processes is loud. `min_free_gb: 2` gives ~2.6 GB of visible slide before warning.

---

### M7 — Doctrine Expiry: negative probe results may not become permanent fact

The audit corrected *findings* that were inferences; root cause 7 is the same disease in *constraints*: "X is unavailable from context Y" gets probed once, fails once, and is then written into a prompt as eternal law. Nobody re-probes, because a constraint in a prompt looks like knowledge, not like a claim with a date on it. The fix is to make every capability constraint carry its evidence, its scope, and an expiry — and to make an expired constraint a finding, not a fact.

**Mechanism, part 1 — the constraint registry.** `ops/constraints.yaml`, one entry per standing capability constraint:

```yaml
- id: dispatch-unavailable-scheduled-context
  claim: "mcp__dispatch__* tools are absent from scheduled-task sessions"
  scope: "Claude Desktop scheduled-task runner"        # never broader than what was tested
  mechanisms_tested: ["direct select: lookup of mcp__dispatch__start_code_task"]
  evidence: { date: 2026-07-19, ref: "WORKING_STATE.md L3 tick 14:33Z" }
  reprobe: "from a scheduled session: ToolSearch 'select:mcp__dispatch__start_code_task'; record hit/miss"
  verified: 2026-07-19
  expires: 2026-09-02        # verified + 45d default
  used_by: ["chiron-build-heartbeat/SKILL.md", "agentplain-loop-heartbeat/SKILL.md"]
```

Rules encoded in the schema: `scope` and `claim` may not exceed `mechanisms_tested` (a probe result may only claim the mechanism it tested — "push via ambient credential helper fails," never "the runner cannot push"); `reprobe` must be a runnable recipe; default expiry 45 days (long enough not to thrash, short enough that a wrong constraint cannot silently shape a quarter's design), per-entry override up to 180 for constraints with structural reasons to be stable.

**Mechanism, part 2 — expiry enforcement.** The contracts checker (M3's script, same invocation) also loads `ops/constraints.yaml` and emits a `constraint-expired` finding for every entry past `expires` — which rides the heartbeat and becomes an issue via the normal path, naming the constraint and its recorded re-probe recipe. Re-verifying = running the recipe and updating `verified`/`expires` in a PR. An expired constraint does **not** auto-delete (that would silently un-constrain designs); it goes loud until re-proven or retired.

**Mechanism, part 3 — no untracked doctrine.** The same checker greps the scheduled-task prompts (`C:\Users\conne\Claude\Scheduled\*\SKILL.md`) for a small, high-signal phrase set — `do not attempt`, `is unavailable`, `cannot push`, `dispatch is absent`, `no writable`, `not reachable from` (case-insensitive) — and flags any hit not accompanied by a `[constraint:<id>]` tag referencing a registry entry, as an `untracked-doctrine` finding. Deliberately narrow phrase list: this is a tripwire for the exact language pattern that burned us, not NLP. A flagged line gets either registered (with evidence and expiry) or rephrased; both are one-line changes.

**Mechanism, part 4 — validator rule.** EU-9's findings validator gains a `CONSTRAINT` class: any finding asserting a capability constraint must name `mechanisms_tested`, and a claim broader than its tested mechanisms is rejected (`generalized-beyond-probe`). This closes the authoring end: fresh probes can no longer be born over-general.

**Where it runs and why.** Registry in-repo (constraint changes are PR-reviewed — doctrine changes on the record, not in prompt edits nobody sees). Checker on-host (prompts live there), findings judged and issued off-host like all M3 findings. The authoring gate runs in CI, outside the session that ran the probe.

**Trigger.** Every watchdog run (findings dedupe via issue upsert); CI on PRs touching findings or the registry.

**Consumer.** Whoever answers the `constraint-expired` issue — usually an Opus session running the recorded `reprobe` recipe (mechanical by design: the recipe is written down at registration time, so re-proof costs minutes). Consumption receipt: `verified` date advances in a PR, finding clears, issue auto-closes.

**Failure mode and what watches it.** The registry can be ignored (constraints written straight into prompts) — that is exactly what part 3 trips on. The phrase list can miss novel wordings — accepted residual, stated: this mechanism catches the recurrence of the observed pattern, not every possible way to encode a belief; the backstop is that any constraint which *matters* eventually gates a design decision, and M4's evidence rules apply when it surfaces in findings. Checker rot is caught the same way as M3's (self-test daily, `checker-stale` payload timestamps).

**Deliberate-failure test.** `check-task-freshness.mjs --self-test` extends to: a fixture registry entry with `expires` in the past MUST yield exactly one `constraint-expired` finding; a fixture SKILL.md containing an untagged "Do NOT attempt … is unavailable" line MUST yield exactly one `untracked-doctrine` finding; a fixture CONSTRAINT finding claiming "runner cannot push" with `mechanisms_tested: [ambient-credential-helper]` MUST be rejected by the validator as `generalized-beyond-probe` — that fixture is verbatim the fire-path-probe error.

**Seed entries at ship time (EU-11):** `dispatch-unavailable-scheduled-context` (above; tag the chiron and loop-heartbeat prompt lines), `runner-cannot-push` (**already disputed** — seeded pre-expired so its issue opens on day one; the re-probe is remediation W2-1's token-injected push test), `build-gate-oom-threshold` (seeded pre-expired; the 8192 MB non-reproduction is already on record), `gcm-auth-dead` (verified 2026-07-25, expiry per default). Two of four seeds firing immediately is the ship-day falsification rule applied to M7.

---

### M8 — Artifact Truth: watch the artifact, not the worker

**The honest premise first.** Distinguishing "waiting on a human approval" from "waiting on a long computation" cheaply, from outside the session, is not solvable with the signals available: session status lies (`running` while frozen), turn counts are ambiguous (a full build and a blocked prompt both hold the count static), and the blocked session cannot report its own state by definition — it is frozen mid-tool-call and cannot even read its inbox. Nor can the watcher live in the spawning session: an orchestrator blocks the same way, and no fixed depth of watcher-sessions closes the hole. **So this mechanism does not watch workers at all.** It generalizes the check that actually caught the live incident: `origin/main` had not moved. The artifact is ground truth in a way session state never is. Everything else here is either that, or an explicitly-labeled heuristic with its false-positive direction chosen deliberately.

**Mechanism, part 1 — every dispatched unit declares its artifact and deadline at spawn.** When an orchestrator fires a unit of work (an Opus session, a workflow, a fired queue item), it appends an entry to `<agent_store>/memory/data/dispatch-ledger.yaml`:

```yaml
- session: local_0baf88be-...
  unit: "queue item 1 — land the 8 green PRs"
  artifact: { kind: origin-main-advances, from_sha: "5606114" }   # GitHub-observable
  spawned: 2026-08-09T23:10:00Z
  deadline: 2026-08-10T05:10:00Z     # spawn + size budget (S=2h, M=6h, L=24h)
  status: open
```

Artifact kinds are deliberately few and **GitHub-observable wherever possible** — `branch-exists`, `pr-opened`, `commit-on-branch`, `origin-main-advances`, `issue-closed`, plus `file-mtime` for host-local outputs — so the off-host checker can verify them against GitHub's API without trusting anything the host (or the worker) says. The ledger rides the heartbeat payload like the queue mirror does.

**Mechanism, part 2 — the off-host deadline check.** The decision-escalation workflow (same daily+dispatch run, same helper) reads the ledger mirror: any `open` entry past `deadline` whose artifact is **absent** → `dispatch-overdue` issue naming the session, the unit, and the declared artifact. Entries close automatically when the artifact is observed, or when the orchestrator marks them `failed`/`reaped`. An overdue issue does not mean kill — it means *someone must look*, which is exactly the step that took a human three polls and a hunch tonight. False-positive direction, chosen deliberately: a legitimately slow unit past its deadline costs one issue saying "verify or extend the deadline" — cheap, and strictly better than forty silent minutes; a deadline generous enough to never false-positive would also never catch anything, so budgets are set at ~2× honest effort (the S/M/L mapping) and extending one is a ledger edit that leaves a record.

**Mechanism, part 3 — progress claims require artifact evidence.** The orchestrator protocol (appended to `docs/audits/AUDIT_PROTOCOL.md` in EU-13) encodes the retraction from the live incident as a rule: a dispatched unit may only be reported as *progressing* on the basis of an artifact delta (new commit, branch movement, ledger line, file mtime) — session status and turn counts are `INFERRED`-class evidence under M4 and may support "still running," never "making progress." The one cheap worker-side heuristic that helped — turn count static across 3 polls — is recorded in the protocol as a *prompt to go check the artifact*, not as an alarm in its own right.

**Mechanism, part 4 — shrink the trigger surface.** Blocked-on-approval is less likely when there is nothing left to approve: each execution unit in this spec already names its files and commands; EU-13 adds a `permissions` line to the unit template (tools/commands the unit will call), so spawners can pre-authorize the named set at spawn. This does not eliminate the stall class (novel tool calls happen) — it reduces its frequency, and M8's deadline check catches what remains.

**Where it runs and why.** The ledger writer is the *spawning* session (only it knows what it dispatched); the judge is the off-host workflow — outside the worker's failure domain, outside the spawner's failure domain (a blocked orchestrator's already-written ledger entries still get checked; its *unwritten* ones are covered by the fact that the orchestrator is itself a dispatched unit with its own ledger entry when fired by a scheduled task), and immune to the "everything on the host looks fine" illusion because it consults GitHub, not the host.

**Trigger.** Ledger writes at spawn; deadline evaluation on the daily escalation run + every `workflow_dispatch`; artifact observation on the same runs.

**Consumer.** Conner or the orchestrator answering the `dispatch-overdue` issue. Consumption receipt: the ledger entry leaves `open` (artifact observed → auto-close with the observation stamped; or explicitly `reaped` in a mirror update), which closes the issue on the next run.

**Failure mode and what watches it.** A unit dispatched *without* a ledger entry is invisible to M8 — that is the mechanism's real hole, and it is patched the same way M3 patches unregistered tasks: the orchestrator protocol makes ledger-write part of the dispatch act itself (one helper call, EU-13), and any PR/branch that appears on GitHub with no matching ledger entry is flagged by the escalation run as `undeclared-work` (a warning, not an alarm — ad-hoc sessions are legitimate; the flag exists so *delegated* work can't silently bypass the ledger). Checker rot: same channels as M2/M3 (fixtures in CI, brief footer, drill). A stall shorter than its deadline is invisible by design — accepted and stated in §7.

**Deliberate-failure test.** Fixture ledger with one entry past deadline pointing at a branch that does not exist MUST yield exactly one `dispatch-overdue` action in the dry-run log (CI). Live ship-day test: seed a real ledger entry with `deadline` one minute out and artifact `branch-exists: refs/heads/does-not-exist-0810`, fire the workflow → the issue opens, naming the fixture session. The incident session (`local_0baf88be…`, artifact `origin-main-advances from 5606114`) is encoded as the canonical fixture — the test is literally "would this have caught tonight."

---

## 3. Decisions resolved here (so Opus needs none)

| Decision | Resolution |
|---|---|
| Heartbeat transport | GitHub Contents API PUT to branch `ops/heartbeat`, file `heartbeat.json`, fleet token. No local git, no worktree, works from any session. History is kept (it is the outage ruler). |
| Staleness threshold | 2 h (4 missed beats; absorbs evidenced episodic drops, catches real outages). |
| Escalation SLAs | Issue at 7 days pending; weekly bump after 30 days. Snooze via `snooze_until` in the queue item is a first-class answer. |
| Delivery thresholds | Green PR 7 days; frozen-main 14 days *with* green PRs open; local-ahead > 0 immediate. |
| Host limits | `min_free_gb: 2`, `max_node_mcp_procs: 15`, in `ops/task-contracts.yaml`. Post-prune measurement (14 procs / 4.60 GB free) makes 15 = measured + 1: snug by intent. |
| Constraint expiry | Default 45 days, per-entry override ≤180. Expired ≠ deleted: expired = loud until re-proven or retired. Probe claims scoped to `mechanisms_tested`, enforced by validator. |
| Dispatch deadlines | S=2h, M=6h, L=24h from spawn (~2× honest effort). Overdue = "verify or extend," never auto-kill. False positives accepted deliberately: one cheap issue vs. an invisible stall. Artifact kinds GitHub-observable wherever possible. |
| Status-line format | `<ISO-UTC> | <task> | OK\|NOOP\|DEFERRED\|ERROR | <one clause>` appended to `<agent_store>/memory/data/status/<task>.log`. |
| Issue taxonomy | Labels `fleet-ops` (family), `fleet-down`, `decision-overdue`, `delivery-stalled`, `drill`. One issue per condition, upsert-with-comment, auto-close on clear. One shared helper `scripts/ops/upsert-issue.mjs`. |
| Drill cadence | Monthly (1st), automatic, auto-closing, `[DRILL]`-prefixed. Brief flags `last drill > 35 days`. |
| Secret hygiene | Publisher hard-fails on secret patterns in payload; a missed beat is better than a leaked token and is itself detected by M1. |
| Payload sections carry own timestamps | So a stale checker result cannot ride a fresh heartbeat. |
| Relationship to remediation plan | W1-1/W1-2 are subsumed by M1 (this spec is their full form); W1-3 by M3; W1-4 stays in remediation (brief leads with queue) — EU-10 here adds only the monitors footer; W2-6's stub stays for humans, M4's registry is the machine-grade version. No double-build. |

---

## 4. Mechanism ↔ location summary

| Mechanism | Writer runs | Judge runs | Why the judge's domain is right |
|---|---|---|---|
| M1 Pulse | on-host watchdog | GHA (GitHub infra) | Immune to host death by construction; inversion of the dead watchdog |
| M2 Reader | on-host (mirror rides heartbeat) | GHA, daily | Reader must not share fate with writer, host, or a file nobody opens |
| M3 Earned Green | on-host (only place mtimes exist) | findings judged & issued off-host | M3 and M1 cover each other's exact blind spot from different domains |
| M4 Evidence | authoring session | CI on the PR | Independent of the session that might have fooled itself |
| M5 Landing | GHA reads GitHub directly (+ ahead-count via heartbeat) | GHA | The missing action is human; alarm lives where the merge button is |
| M6 Headroom | on-host sampling | GHA thresholds | A host sliding toward a wedge can't be trusted to raise its own alarm |
| M7 Doctrine Expiry | registry in-repo; prompt lint on-host | expiry findings issued off-host; authoring gate in CI | Doctrine changes must be PR-visible; the session that ran a probe can't also be the judge of how far its result generalizes |
| M8 Artifact Truth | spawner writes ledger at dispatch | GHA checks artifacts against GitHub | Neither the worker (frozen) nor the spawner (blockable the same way) can be the judge; the artifact on GitHub is ground truth no session state can fake |

---

## 5. Execution units for Opus

Thirteen units. Each is a single deliverable an Opus session can finish without judgment calls. **Spawn protocol (M8):** whoever dispatches a unit writes its ledger entry at spawn (artifact + size-derived deadline) and pre-authorizes the tools the unit names — for these units that means git push via token URL, the GitHub REST API, local file writes under the named paths, and (EU-4/10/11/13) edits to `C:\Users\conne\Claude\Scheduled\*\SKILL.md`; declared artifacts are the unit's acceptance outputs (branch/PR for repo units, file mtimes for prompt edits). Repo work branches from `origin/main` (worktree; PRs via the fleet token + REST recipe; compare-URL fallback if PR creation is classifier-blocked). Task-prompt work edits `SKILL.md` files under `C:\Users\conne\Claude\Scheduled\<task>\` directly (not in the repo). Ledger/status writes go to the **live agent store only** — resolve it via EU-2's script; its path and tell are in §M4.

**Dependency graph:**

```
Wave A (parallel):  EU-1  EU-2
Wave B (parallel):  EU-3 (←EU-2)   EU-5 (←EU-1)   EU-9 (←EU-2)
Wave C (parallel):  EU-4 (←EU-3)   EU-6 (←EU-1,5)  EU-7 (←EU-5)   EU-8 (←EU-5,6)   EU-11 (←EU-3,9)
Wave D (parallel):  EU-10 (←EU-5,6,7)   EU-13 (←EU-1,6 — extends EU-6's script)
Gated on R-1 acceptance:  EU-12 (←EU-5; independent of Waves C/D)
```

---

### EU-1 · Heartbeat publisher — `M` · parallel-safe (Wave A)
**Deliverable.** `scripts/ops/publish-heartbeat.mjs` + one added step in the `agentplain-watchdog` SKILL.md.
**Files.** New: `scripts/ops/publish-heartbeat.mjs`. Edit: `C:\Users\conne\Claude\Scheduled\agentplain-watchdog\SKILL.md` (append the step; do not restructure the prompt). Creates branch `ops/heartbeat` on first run via the Contents API.
**Behaviour.** Build payload: `ts`; host census (free GB, claude/node proc counts + RSS via `Get-CimInstance`/`Get-Process`, matching the postmortem's method); `git.local_main_ahead` (`git -C C:\agentplain rev-list --left-right --count origin/main...main`, right-hand number; on git error, field = `null`, never a guess); sanitized queue mirror (§M2 field list — read the queue via EU-2's resolver **if EU-2 has landed, else the literal live path from §M4 with the tell grep inlined**); `contracts` section = output of EU-3's checker if present on disk, else `{status: "checker-not-installed"}`. Run the secret scan; on match, print the offending JSON path and exit 1 without publishing. PUT via Contents API with fleet token (mint per the documented recipe; never read a token from a file in the repo).
**Acceptance (runnable).**
`node scripts/ops/publish-heartbeat.mjs && sleep 2 && node scripts/ops/publish-heartbeat.mjs` then
`git ls-remote origin refs/heads/ops/heartbeat` → prints a sha; GitHub API `GET /repos/{owner}/agentplain/commits?sha=ops/heartbeat&per_page=2` → two commits with distinct timestamps ≤5 min apart. Secret test: `node scripts/ops/publish-heartbeat.mjs --inject-test-secret` → exit 1, no new commit on the branch.
**Depends on:** nothing. **Parallel:** yes.

### EU-2 · Canonical-path registry + resolver — `S` · parallel-safe (Wave A)
**Deliverable.** `ops/canonical-paths.yaml` (content as specified in §M4, verbatim paths) + `scripts/ops/resolve-store.mjs`.
**Files.** Both new, in-repo.
**Acceptance (runnable).**
`node scripts/ops/resolve-store.mjs agent_store` → prints the live absolute path, exit 0.
`node scripts/ops/resolve-store.mjs agent_store --override-path "C:\Users\conne\.claude\projects\C--agentplain\memory"` → exit 3, output contains `known_bad`.
Copy INBOX.md to a temp dir without `[PROCESSED]` lines, `--override-path <tempdir>` → exit 2, output names the failed tell (`min_count`).
**Depends on:** nothing. **Parallel:** yes.

### EU-3 · Task contracts + freshness checker — `M` (Wave B)
**Deliverable.** `ops/task-contracts.yaml` seeded with every currently-enabled recurring task (enumerate live via `list_scheduled_tasks` at build time; include `disabled_reason` entries for deliberately-disabled ones — for `chiron-build-heartbeat` write `disabled_reason: "pending W2-5 adjudication"`) + `scripts/ops/check-task-freshness.mjs` implementing the §M3 comparison table + `--self-test`.
**Files.** New: `ops/task-contracts.yaml`, `scripts/ops/check-task-freshness.mjs`. Creates `<agent_store>/memory/data/status/` directory.
**Interface.** `node scripts/ops/check-task-freshness.mjs --scheduler-snapshot <path-to-json>` where the snapshot is `[{name, cron, enabled, lastRunAt}]` written by the calling session from MCP; outputs findings JSON to stdout. Ledger/artifact paths resolve through EU-2.
**Acceptance (runnable).**
`node scripts/ops/check-task-freshness.mjs --self-test` → stdout ends `SELF-TEST PASS: 1 finding (task-silent) for fixture-task`, exit 0.
Against a real snapshot with all-fresh state → `[]`. Manually backdate one real ledger file's tail line by 2 days, rerun → exactly one finding naming that task, kind `task-silent`.
**Depends on:** EU-2. **Parallel:** with EU-5, EU-9.

### EU-4 · One-line law rollout across task prompts — `M` (Wave C)
**Deliverable.** Every enabled recurring task's SKILL.md gains the mandatory closing step (append the §M3 status line, every run, all verdict paths) and a matching contract entry exists. Tasks: `agentplain-librarian-rollup`, `agentplain-watchdog`, `agentplain-loop-heartbeat` (or `agentplain-loop-governor` if the W2-3 cutover has happened — check which is enabled, amend the enabled one, contract the other as `disabled_reason: "governor cutover W2-3"`), `agentplain-morning-brief`, `agentplain-audit-queue-autofire`, `agentplain-audit-queue-seeder-local`, `chiron-demo-readiness-watchdog`, `scheduler-liveness-watchdog`. Wording: one short appended section, identical across tasks, that explicitly covers NOOP/DEFERRED/ERROR paths ("a run that writes nothing else still writes this line").
**Files.** Edit each `C:\Users\conne\Claude\Scheduled\<task>\SKILL.md`; edit `ops/task-contracts.yaml` (repo PR) if any entry was missing.
**Acceptance (runnable).** `grep -L "memory/data/status/" C:\Users\conne\Claude\Scheduled\*\SKILL.md` → empty for the enabled-task list above. After one natural cadence cycle (or one manual fire of any single task): `wc -l <agent_store>/memory/data/status/<that-task>.log` ≥ 1 and the tail line parses against the §M3 format regex.
**Depends on:** EU-3. **Parallel:** with EU-6/7/8.

### EU-5 · fleet-liveness workflow + issue helper — `M` (Wave B)
**Deliverable.** `scripts/ops/upsert-issue.mjs` (find-by-label+slug, create or comment, close-with-comment; used by all workflows) + `.github/workflows/fleet-liveness.yml` (hourly cron; staleness check per §M1; M6 threshold evaluation of the latest payload; `checker-stale` detection via payload section timestamps; `workflow_dispatch` inputs `simulate_stale` and `simulate_breach`; auto-close + measured-outage-duration comment on recovery).
**Files.** New: both. Uses default `GITHUB_TOKEN` (`permissions: issues: write, contents: read`) — no new secret.
**Acceptance (runnable).**
`gh workflow run fleet-liveness.yml -f simulate_stale=true` (or the REST dispatch equivalent) → run concludes `failure`; an open issue labeled `fleet-down` titled with `[DRILL]` exists.
Then `gh workflow run fleet-liveness.yml` (no inputs, real heartbeat fresh from EU-1) → run concludes `success`; the drill issue is closed with a recovery comment containing a duration.
`-f simulate_breach=true` → open `fleet-ops` issue naming `free_gb`.
**Depends on:** EU-1 (branch must exist). **Parallel:** with EU-3, EU-9.

### EU-6 · decision-escalation workflow — `M` (Wave C)
**Deliverable.** `scripts/ops/escalate-decisions.mjs` (core logic, `--fixture` mode, dry-run action log) + `.github/workflows/decision-escalation.yml` (daily cron + dispatch; reads mirror from `ops/heartbeat`; SLA/snooze/bump/auto-close semantics per §M2; stale-mirror = escalate last-known state; unparseable mirror = `fleet-ops` issue).
**Files.** New: both. CI: add the fixture test to the existing test run (it is a plain node test file — `scripts/ops/escalate-decisions.test.mjs`).
**Acceptance (runnable).**
`node --test scripts/ops/escalate-decisions.test.mjs` → pass: fixture with one 45-day item yields exactly `[create, bump]` in the dry-run log; snoozed item yields `[]`; resolved item with open issue yields `[close]`.
Live: `gh workflow run decision-escalation.yml` → run green AND **issues exist afterward for every real queue item pending >7d** (≥1 guaranteed on today's data; zero created = FAIL).
**Depends on:** EU-1, EU-5. **Parallel:** with EU-4/7/8.

### EU-7 · delivery-latency workflow — `M` (Wave C)
**Deliverable.** `.github/workflows/delivery-latency.yml` + `scripts/ops/delivery-latency.mjs` (same shell/logic split, `--fixture` mode) implementing the three §M5 conditions with thresholds as top-of-file constants.
**Files.** New: both, + `scripts/ops/delivery-latency.test.mjs`.
**Acceptance (runnable).**
`node --test scripts/ops/delivery-latency.test.mjs` → fixture with one 30-day green PR yields exactly one create action; fixture with frozen main + zero green PRs yields none.
Live: `gh workflow run delivery-latency.yml` → if stale green PRs exist at run time (8 today), one `delivery-stalled` issue per PR; if the backlog has landed by then, run the fixture path and manufacture the local-ahead condition instead (heartbeat payload already carries it — assert the issue opens iff `local_main_ahead > 0`).
**Depends on:** EU-5. **Parallel:** with EU-4/6/8.

### EU-8 · Monthly auto-drill — `S` (Wave C)
**Deliverable.** Second cron entry in `fleet-liveness.yml` (1st of month) that runs the `simulate_stale` path with `[DRILL]` marking, then auto-closes its own issue with `drill-ok` and the date; drill outcome recorded as an issue comment so `last drill` is queryable by EU-10 via the issues API (label `drill`).
**Files.** Edit: `.github/workflows/fleet-liveness.yml` only.
**Acceptance (runnable).** `gh workflow run fleet-liveness.yml -f drill=true` → a `drill`-labeled issue is created AND closed within the same run, closing comment contains `drill-ok`; a normal run afterward is green and does not touch drill issues.
**Depends on:** EU-5 (and EU-6's helper conventions). **Parallel:** with EU-4/6/7.

### EU-9 · Findings schema, validator, retracted-claim fixtures — `M` (Wave B)
**Deliverable.** `ops/findings-schema.yaml` (schema per §M4 part 3) + `scripts/ops/validate-findings.mjs` + `scripts/ops/fixtures/retracted-2026-08-09.yaml` encoding the four retracted claims with the evidence they actually had + a valid MEASURED fixture + CI wiring (run validator on PRs touching `docs/audits/**` or `**/findings*.yaml`) + one appended section in the audit prompt template (locate the audit-runbook doc under `docs/`; if none exists, add the requirement to `docs/specs/audit-fire-gha-bridge-2026-06-15.md`'s companion notes is NOT acceptable — instead create `docs/audits/AUDIT_PROTOCOL.md` containing only: findings format requirement, validator command, canonical-path rule, and the three banned inferences from `feedback_dual_memory_store_trap`).
**Files.** New: schema, validator, 2 fixtures, `docs/audits/AUDIT_PROTOCOL.md`; edit: CI workflow.
**Acceptance (runnable).**
`node scripts/ops/validate-findings.mjs scripts/ops/fixtures/retracted-2026-08-09.yaml` → exit 1, output lists 4 rejections each naming its rule (`slot-arithmetic-without-command-evidence`, `path-not-canonical`, `inferred-cannot-be-P1`, ...).
`node scripts/ops/validate-findings.mjs scripts/ops/fixtures/valid-measured.yaml` → exit 0.
**Depends on:** EU-2. **Parallel:** with EU-3, EU-5.

### EU-10 · Brief monitors footer — `S` (Wave D)
**Deliverable.** `agentplain-morning-brief` SKILL.md gains a closing "Monitors" footer: heartbeat age (from `ops/heartbeat` head commit via API), last-run age of each of the three workflows (actions API), last drill date (newest closed `drill` issue), count of open `fleet-ops`/`decision-overdue`/`delivery-stalled` issues. Flag lines in red-equivalent wording when: heartbeat >2 h, any workflow last-run >48 h, drill >35 days. Graceful degradation is specified, not judged: any API miss renders as `<name>: UNREACHABLE (<error>)` — an unreachable monitor is itself a flag line, never omitted. (The queue-leads-the-brief content is remediation W1-4, not this unit — do not duplicate it.)
**Files.** Edit: `C:\Users\conne\Claude\Scheduled\agentplain-morning-brief\SKILL.md`.
**Acceptance (runnable).** Fire the brief task once manually → the delivered brief contains a Monitors footer with all six lines populated (or UNREACHABLE-flagged), and the drill line matches the newest closed `drill` issue's date.
**Depends on:** EU-5/6/7 existing (degrades visibly if any are missing). **Parallel:** no — last (of the core waves).

### EU-11 · Constraint registry + doctrine-expiry enforcement — `M` (Wave C)
**Deliverable.** `ops/constraints.yaml` with schema comment + the four seed entries from §M7 (two seeded pre-expired: `runner-cannot-push`, `build-gate-oom-threshold` — their issues MUST open on the first watchdog cycle after ship); expiry + untracked-doctrine checks added to `check-task-freshness.mjs`; `CONSTRAINT` class + `generalized-beyond-probe` rule added to `validate-findings.mjs`; `[constraint:dispatch-unavailable-scheduled-context]` tags added to the two prompt lines that carry that doctrine (`chiron-build-heartbeat`, `agentplain-loop-heartbeat` SKILL.md — tag, do not reword the constraint itself).
**Files.** New: `ops/constraints.yaml`. Edit: `scripts/ops/check-task-freshness.mjs`, `scripts/ops/validate-findings.mjs` + its fixtures, two SKILL.md files under `C:\Users\conne\Claude\Scheduled\`.
**Acceptance (runnable).**
`node scripts/ops/check-task-freshness.mjs --self-test` → additionally reports `constraint-expired (fixture)` = 1 and `untracked-doctrine (fixture)` = 1, exit 0.
`node scripts/ops/validate-findings.mjs scripts/ops/fixtures/overgeneralized-constraint.yaml` (the verbatim fire-path-probe error) → exit 1, rule `generalized-beyond-probe`.
Live: first real checker run emits exactly 2 `constraint-expired` findings (the pre-expired seeds) and 0 `untracked-doctrine` findings (both known lines are tagged).
**Depends on:** EU-3, EU-9. **Parallel:** with EU-4/6/7/8.

### EU-12 · GHA bridge pilot — one stateless task end-to-end — `L` · **gated on R-1 acceptance**
**Deliverable.** The already-specced `repository_dispatch` route (`docs/specs/audit-fire-gha-bridge-2026-06-15.md`) implemented for exactly ONE stateless, fire-capable task: `.github/workflows/audit-fire.yml` accepting the specced payload, running the work, opening (never merging) a PR, and writing `pr_url` back per the spec. Purpose is **option preservation and price discovery**, not migration: record measured wall-time, runner minutes, and token cost per fire in the workflow summary, so R-1's falsifier #4 has real numbers.
**Files.** New: `.github/workflows/audit-fire.yml` + whatever the bridge spec's payload contract requires. No task is moved off the host; the desktop path remains primary per the spec's own coexistence design.
**Acceptance (runnable).** `curl -X POST .../dispatches -d '{"event_type":"audit-fire","client_payload":{...test payload...}}'` → workflow run completes, a PR exists with the expected branch prefix, and the run summary contains the three cost numbers. The short-term file-bridge fallback still works (fire one item through it afterward).
**Depends on:** EU-5 (helper conventions only). **Parallel:** independent of Waves C/D. **Do not start until Conner accepts R-1** — if he rejects toward full migration instead, this unit is superseded by a migration spec, not extended.

### EU-13 · Dispatch ledger + artifact-deadline checks — `M` (Wave D)
**Deliverable.** `scripts/ops/dispatch-ledger.mjs` (`add | close | reap` subcommands; `add` validates artifact kind against the M8 enumeration and computes the deadline from a `--size S|M|L` flag); ledger mirror added to `publish-heartbeat.mjs`'s payload (same sanitization pass); `dispatch-overdue` + artifact-observation + `undeclared-work` checks added to `escalate-decisions.mjs` (EU-6's script — same dry-run action-log pattern, artifact observation via the GitHub API only); orchestrator protocol section appended to `docs/audits/AUDIT_PROTOCOL.md` (ledger-write is part of the dispatch act; progress claims require artifact deltas — session status and turn counts are `INFERRED` and support "still running" only; turn-count-static-across-3-polls is a go-check-the-artifact prompt, not an alarm; spawn protocol per this spec's §5 preamble).
**Files.** New: `scripts/ops/dispatch-ledger.mjs`. Edit: `scripts/ops/publish-heartbeat.mjs`, `scripts/ops/escalate-decisions.mjs` + its test file, `docs/audits/AUDIT_PROTOCOL.md`. Ledger lives at `<agent_store>/memory/data/dispatch-ledger.yaml` (resolve via EU-2).
**Acceptance (runnable).**
`node --test scripts/ops/escalate-decisions.test.mjs` → new cases pass: the canonical fixture — a ledger entry mirroring the live incident (`session: local_0baf88be…`, artifact `origin-main-advances from 5606114`, deadline in the past) — yields exactly one `dispatch-overdue` action ("would this have caught tonight" = yes, by construction); an entry whose artifact IS observed (fixture API response) yields exactly one `close` action; a fixture PR with no ledger entry yields one `undeclared-work` warning.
Live: `node scripts/ops/dispatch-ledger.mjs add --unit drill --size S --artifact branch-exists:refs/heads/does-not-exist-0810 --deadline-override +1m`, fire the escalation workflow → a `dispatch-overdue` issue opens naming the drill entry; `dispatch-ledger.mjs reap` it → issue closes on the next run.
**Depends on:** EU-1, EU-6. **Parallel:** with EU-10.

---

## 6. Routed to Conner — one JUDGMENT, one packaged recommendation

| # | Decision | Why only Conner | Default |
|---|---|---|---|
| J-1 | **Notification reach.** Do GitHub issue/workflow-failure emails actually reach you (phone) fast enough to be an alarm channel? Ship-day: EU-5's drill fires; confirm you got the email and how fast. If GitHub email isn't a channel you'd notice within a day, name the channel you would (SMS via the existing env-gated Twilio layer is the pre-built alternative) and one EU gets amended to add it. | Only you know what you actually notice. | GitHub notifications; add Twilio SMS only if the drill test proves email too slow. |

### R-1 — Where the fleet lives (queue item 7, delegated 2026-08-09; accept or reject)

**The call: stay on the desktop. Do not migrate the fleet to GHA. Buy the option instead of the move (EU-12), and bind the decision to five named falsifiers.**

**Reasoning, with the prune data weighed honestly.** The desktop had two failure modes: it wedges, and it dies silently. Tonight's prune addressed the first for ~$0 — free RAM 0.98 → 4.60 GB, node MCP load 24 procs/2.40 GB → 14/0.91 GB — and M6's ratchet (ceiling 15 vs measured 14) keeps it addressed by making regrowth loud. The second — the monitor living inside the thing it monitors — is fully solved off-host by M1/M2 *without moving any workload*: worst-case undetected outage drops from ~139 h to ≤2 h. That is the half money can't fix with RAM, and it is fixed by this spec regardless of where the fleet runs. What migration would buy **on top** of all that is availability — the fleet keeps working while the host is down — and that is worth little here, for a reason that is structural, not hopeful: **the customer-facing runtime does not live on the desktop.** Production sweeps and workflows run on Inngest/Vercel in the cloud already; a host outage stalls the internal build/ops cadence only. The August outage hurt because it was *invisible for days*, not because the ops layer paused.

Against that modest gain, migration's real costs: (1) **It is not a lift-and-shift.** The fleet's memory substrate — INBOX, WORKING_STATE, conner-queue, the new status ledgers — is host-local by construction; `audit-queue-seeder.yml` already documents that a cloud runner cannot write it. Moving scheduled work means re-homing the memory store first: an architecture project, not plumbing. (2) **Recurring cost asymmetry.** Desktop scheduled sessions ride the existing Claude subscription; GHA sessions pay metered API plus runner minutes. Illustrative floor: the Librarian alone at `*/15` is ~2,900 runs/mo — at ~3 min/run on a private-repo Linux runner ($0.008/min) that is ~$70/mo of runner time *before* any API token costs, for one task of eight. Exact API delta unknown; it is strictly positive and recurring. (3) Full migration is a week-plus of fleet work (remediation W4-2's own honest estimate) competing with revenue-facing work like the vertical one-liner.

**Cost of this recommendation:** $0 new recurring. One-time: the prevention layer (ships regardless) + EU-12's pilot (~1 day) to prove and price the GHA path.

**Migration path if/when a falsifier fires** (pre-committed so the future decision is "turn the crank," not a fresh investigation): **Phase 0** — EU-12 pilot: one stateless task end-to-end on `repository_dispatch`, costs measured (this happens now, on acceptance). **Phase 1** — move stateless, fire-capable work (audit-fire, delivery checks) behind the proven bridge. **Phase 2** — re-home the memory store (the real project; decide repo-backed vs hosted store then, with Phase 0/1 cost data in hand). **Phase 3** — move the stateful tasks (Librarian, governor) last. Each phase independently shippable and reversible.

**What specifically changes my mind** — each measurable by machinery in this spec, none requiring a new investigation:

1. **A second full-host outage within 90 days with free RAM ≥ 2 GB at last heartbeat** (M6's payload proves it wasn't memory) → the substrate is unreliable independent of headroom → migrate.
2. **Median alarm-to-recovery > 24 h across two or more outages** (measured by M1's outage ruler + `fleet-down` issue timestamps) → the human-restart dependency, not the host, is the bottleneck → migrate or automate restart.
3. **Any customer-visible SLA comes to depend on the desktop fleet** → migrate that path immediately; do not wait for the review.
4. **Fleet workload outgrows the subscription** so it pays metered API anyway (EU-12's measured per-fire cost × observed fire volume makes this arithmetic, not judgment) → the cost asymmetry dies → re-decide.
5. **The memory store gets re-homed for an independent reason** (multi-machine, backup policy) → the biggest migration blocker is gone → re-decide.

Review trigger: any falsifier firing, or 2026-11-09 (90 days), whichever first — the review date goes into `conner-queue.yaml` as a snoozed item so M2 resurfaces it automatically. A standing infrastructure decision with no expiry would be root cause 7 wearing a nicer shirt.

Everything else that looked like a decision is resolved in §3 and editable later in one tracked file each.

---

## 7. Honest accounting: what is not preventable, and what "survivable" means for each

Claiming total prevention is the same overreach that produced the audit's false findings. These seven are not prevented; each is made survivable in a specific, testable way:

1. **The host can still die.** One machine, an Electron app — the prune bought real headroom (4.60 GB free, wedge driver removed) but bought no redundancy. Survivable: early warning before (M6 thresholds off-host), detection ≤2 h during (M1), measured duration after (heartbeat gap — no more disputed "3 vs 5.8 days"), and auto-recovery on restart (cold-start-safe tasks + issues auto-close). Removing the failure mode entirely means migrating — R-1 recommends against that today and names the five conditions under which the answer flips.
2. **The scheduler will keep dropping individual fires episodically.** Evidenced behaviour (84-min and ~12.7-h gaps on healthy tasks); closed-source, not fixable from here. Survivable: M3 makes every drop countable within a day from ledger gaps, and M1's threshold is sized so episodic drops don't cry wolf.
3. **Conner may not answer.** No mechanism can force a human decision, and one that nags harder just trains ignoring. Survivable: M2 guarantees *seen* (issues on a channel he uses, ages always visible, snooze as a legitimate answer) — the system's guarantee is "no silent pending," never "answered."
4. **GitHub itself can be down or GHA cron can starve.** Survivable: thresholds absorb ordinary delay; GitHub-down + host-down simultaneously is the accepted residual, bounded by GitHub's own recovery and caught retroactively by the outage ruler. No third platform is added — a third watcher would itself need watching (§1.1).
5. **A free-prose audit can still assert nonsense.** M4 mechanizes the two error patterns that actually occurred (wrong store, slot arithmetic) and gates structured findings; it cannot gate prose. Survivable: the audit protocol requires the structured file + validator, and the pre-merge review gate reviews load-bearing PRs. Residual: an author who bypasses both — at which point the failure is disobedience, not architecture, and no architecture fixes that.
6. **"Waiting on a human" and "waiting on a computer" cannot be cheaply told apart from outside, and a stall shorter than its deadline is invisible.** Stated plainly rather than engineered around: session status, turn counts, and last-output lines are all consistent with both states, and the blocked session cannot testify. M8 therefore does not try — it bounds the damage instead: every dispatched unit's stall is caught at its declared deadline (2h/6h/24h by size) via the artifact, with the false-positive direction chosen deliberately (a slow-but-healthy unit costs one "verify or extend" issue). The residual — a 40-minute stall inside a 6-hour budget stays invisible for the remainder of the budget — is accepted; shrinking it means either tighter deadlines (more false positives, a knob in one file) or a real prompt-state API from the platform, which does not exist today. Reduction at the source (pre-authorized permission sets per unit) lowers frequency but cannot reach zero.
7. **Doctrine can be written in words the tripwire doesn't match.** M7's phrase lint catches the observed pattern (`do not attempt`, `is unavailable`, …), not every possible encoding of an untested belief. Survivable: any constraint that *matters* eventually surfaces in a finding or a design decision, where M4's evidence rules and M7's `generalized-beyond-probe` gate apply; the registry's expiry clock catches the rest on a 45-day fuse. The residual — a load-bearing belief phrased novelly and never surfaced in a finding — is accepted and named, not papered over.

---

*Built on `origin/main` @ `5606114`. Sources: PR #397 (with corrections banner), PR #398, the live agent-store memory (`feedback_dual_memory_store_trap`, `project_audit_2026_08_09_retractions`, `project_scheduler_total_execution_outage_2026_08_09`, `conner-queue.yaml` — live tree verified by tell: 358 `[PROCESSED]` markers vs 0–1 in the inert twin). Every number herein is read from those artifacts, not derived.*
