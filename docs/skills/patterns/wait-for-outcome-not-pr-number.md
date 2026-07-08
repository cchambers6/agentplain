# Pattern: wait for the outcome, not a PR number

**Group:** orchestration · **Seeded by:** async fleet dispatches where the deliverable is an in-place doc set or a decision, not always a PR; memory: the many "DONE (PR #NNN)" entries alongside doc-in-place passes.

## When to use — trigger phrases
- "wait for the pass to finish" / "did it complete"
- an orchestrator blocking on a dispatched agent
- a pass whose deliverable is docs-in-place or a decision, with no PR yet

## Inputs
- The dispatched task and its completion signal (task-notification, `list_sessions` status, or the artifact appearing on disk).

## Procedure
1. Define the **outcome** you're waiting for up front — a merged PR, a written file set, a state.yaml deliverable, a green gate. Not "a PR number."
2. Block on that outcome's real signal:
   - harness-tracked agent → the task-notification (you're re-invoked automatically; don't poll).
   - external state (CI, deploy, remote queue) → poll on a cadence matched to how fast it changes.
   - docs-in-place → the files existing + the report-back.
3. Only treat the pass as done when the **outcome** is verified — a returned PR URL that 404s, or a session that died mid-write, is not done.

## Output
Completion judged by the artifact, not by a number the agent claimed.

## Guardrails
- **A PR number is not proof.** The pass is done when the PR is *open and correct*, or the docs are *on disk*, or the deliverable is *in state.yaml* — verify the thing, not the claim.
- **Don't poll harness-tracked work.** You're re-invoked when it finishes; a short-interval wakeup to check is wasted (and burns cache).
- **Not every pass ends in a PR.** Loop passes commit to main directly; some passes only write docs-in-place or update `state.yaml`. Waiting for a "PR URL" from those waits forever.
- If the session died (payload-oversize, terminal error), the outcome won't appear — reconcile via `list_sessions` (see `payload-oversize-handling`).

## Worked example
Loop v3 worker passes commit straight to `main` with `loop: pass N [track] — scope` and declare deliverables in `state.yaml` — there's no PR to wait on. The correct completion check is "the deliverable is in `last_pass_deliverables` and the commit landed," not "give me the PR number."
