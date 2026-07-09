# Dossier: dispatch-session mechanics

How dispatched/scheduled sessions fail silently, and the reconciliation machinery that catches each mode.

| # | Failure | Recorded incident | Lesson → skill |
|---|---|---|---|
| 1 | **Slash-prefix interception** — prompt starting `/word` parsed as a slash command; body swallowed; session runs **0 turns** | 2026-06-07 overnight chain (`/goal …` → `local_ba36a9f6`); also bricked resume messages. Detection: `<command-name>/goal</command-name>` + "0 turns" in the transcript | plain-text framing, no `/` prefix, ever → [[orchestrator-prompt-hygiene]] |
| 2 | **AskUserQuestion wedge** — unattended task blocks on input indefinitely; orchestrator messages don't reliably unblock | 2026-05-31: completeness audit blocked for hours | forbid it in briefs; fail clean + report → [[orchestrator-prompt-hygiene]], [[scheduled-task-prompt]] |
| 3 | **Invisible replies** — plain assistant text unseen in brief-mode surfaces; user experiences silence | 2026-05-25: "why do I keep having to follow up for answers" | user-facing content via the message tool, first action of the turn → [[orchestrator-prompt-hygiene]] |
| 4 | **Launch error ≠ no launch** — oversize/tool-response error while the session started anyway | CoS Pass 1 = "PR #352 (retry)"; first dispatch had actually started | session-list check before any re-fire → [[payload-oversize-handling]] |
| 5 | **Silent death mid-flight** — state claims in-flight; session gone from the registry | loop design: governor STEP 1c ("died silently") | reconcile every tick; 4h stall presumption → [[heartbeat-governor]] |
| 6 | **Restart-instead-of-amend** — respawning loses the session's accumulated context and forks files | loop nudge design ("fixed by the smart layer, one pass late") | live message for urgency, durable nudge for correctness → [[dispatch-amend-in-flight]] |
| 7 | **Scheduled-but-cannot-dispatch** — the env lacks the session-list/launch/stop trio; task triages, never fires | Dispatch MCP unreachable 17 days; file-bridge waited on "Conner's next message"; COORDINATION §0.11 made env confirmation a blocking pre-check ("not N1-dormant on arrival") | manual first pass from the scheduled env → [[scheduled-task-liveness]] |
| 8 | **Never scheduled at all** — designed conductor, no cron; kill-switch var false for days | loop v3 dormant (PR #349); `USE_GHA_CRON` false 5+ days; kaizen skipped 2026-06-28 unnoticed | schedule + `last_tick_at` canary → [[scheduled-task-liveness]] |
| 9 | **Starved vs dead, indistinguishable** — "fired 0" honest no-ops masking a dead feeder | six consecutive "fired 0, $0" runs while the seeder had stopped and manual audits found 11+ P0s | feeder-health line in every run report → [[scheduled-task-liveness]] |
| 10 | **Typo'd IDs in scheduled prompts** — a wrong UUID path silently no-ops | `audit-fire-manual-rerun-2` shipped with a typo'd session-UUID + an inline "go find the right one" note | verify paths/IDs at authoring; cold-start prompts carry checked references → [[scheduled-task-prompt]] |

**Session-limit hygiene** (same family, degradation not death): cap waves ~4 phases/PR; self-assess at turn ~200; report at phase boundaries; platform API over CLI polling (a wave burned 40+ min on a lagging badge) → [[orchestrator-prompt-hygiene]] (`feedback_long_task_performance_2026_05_31`).
