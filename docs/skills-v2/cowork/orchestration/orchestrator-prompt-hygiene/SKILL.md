---
name: orchestrator-prompt-hygiene
description: The prompt-format and runtime rules that keep a dispatched session from silently dying, wedging, or going invisible — no slash prefix, no AskUserQuestion, SendUserMessage for anything the user must see, turn/phase budgets, and the standard blocks every code-task brief carries. Use every time you write a start_code_task / dispatch prompt or a resume message.
---

# Orchestrator prompt hygiene (the silent-killers checklist)

Each rule here is a recorded way a dispatched session produced nothing while looking fine.

## Format traps

- **Never begin the prompt (or a resume message) with `/word`.** The receiving Claude Code session parses it as a slash command, swallows the entire body as args, and runs **0 turns**. This killed the 2026-06-07 overnight chain (`/goal OVERNIGHT MANDATE…` → `local_ba36a9f6`, done-success-0-turns) and bricked sprint resume messages until the prefix was removed. Long-runtime framing goes in plain text: `LONG-RUNNING OVERNIGHT ORCHESTRATOR — run continuously…`. **After-the-fact detection:** transcript shows `<command-name>/goal</command-name>` then `0 turns`.
- **Context by file path, not by paste.** Giant inline bodies hit the oversize path ([[payload-oversize-handling]]); a brief that says "read `docs/briefs/<slug>.md`" doesn't.

## Runtime traps

- **Forbid AskUserQuestion in unattended tasks.** It wedges the task indefinitely (observed: an audit blocked for hours; orchestrator SendMessage didn't reliably unblock it). Brief: "If you cannot proceed, ship what you have, fail clean, and report — never block on input."
- **Anything the user must see goes through SendUserMessage** (Dispatch/brief-mode surfaces): plain assistant text is invisible there. The recorded failure: answers composed as plain text, user saw silence, asked "why do I keep having to follow up for answers." First action of the turn = the answer via SendUserMessage; work continues after.
- **Turn/phase budgets:** cap waves at ~4 phases per PR; brief "at turn ~200, assess whether you'll finish — if not, ship as wave-Na and defer wave-Nb"; report at phase boundaries so a session-limit kill is recoverable at the boundary.
- **Status checks via MCC/API, not CLI polling:** the GitHub commit-status badge and `vercel` CLI lag 30–40 min behind actual deploy state; a wave once burned 40+ minutes polling while the preview was Ready. Poll the platform API/MCP, or `curl <preview-url>` for 200.

## The standard blocks every code-task brief carries

1. Rebase-first + pre-push re-rebase ([[rebase-first-full-build]])
2. Required completion verification ([[push-verification]])
3. Ready-for-review PR, full URL in the report ([[curl-per-pr-merge]], [[report-back]])
4. Memory-inbox append block ([[librarian-inbox-rollup]])
5. The ratified frame, when the pass decides anything ([[ratified-frame-preamble]])
6. Model routing per the current default (as of 2026-07-19: Fable `claude-fable-5` default for all judgment work — Max-plan-included, no longer scarce; Sonnet `claude-sonnet-5` for mechanical plumbing; Haiku `claude-haiku-4-5-20251001` for conductor ticks and triage; Opus 4.8 only for 1M-context or Fable-unavailable — `project_model_routing_plan_2026_07_19`, `feedback_fable_is_max_default_2026_07_19`)

## Example invocation

> **Input:** "Fire the overnight wave orchestrator."
>
> **Output shape:** a plain-text-framed prompt (no `/` prefix) beginning `LONG-RUNNING OVERNIGHT ORCHESTRATOR — …`, context by path, the six standard blocks, phase-boundary reporting, no-AskUserQuestion clause — and after dispatch, a registry check that the session is >0 turns before walking away.

## Compose with

[[payload-oversize-handling]] · [[dispatch-amend-in-flight]] (same rules for resume messages) · [[scheduled-task-prompt]] (the unattended-cousin) · [[report-back]]

## Origin

`feedback_no_slash_prefix_in_orchestrator_prompts` (2026-06-07 overnight chain, "a lot of this didn't fire") · `feedback_long_task_performance_2026_05_31` (AskUserQuestion wedge; Vercel CLI lag; turn budgets) · `feedback_answer_questions_directly` (SendUserMessage-first) · `feedback_librarian_pattern_in_every_orchestrator`.
