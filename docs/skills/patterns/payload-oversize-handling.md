# Pattern: payload-oversize / dispatch-error handling (verify via list_sessions)

**Group:** fleet-ops · **Seeded by:** fleet dispatch operational experience; memory: project_dept_fleet_ops_head_2026_07_03, project_cos_pass1 (PR #352 retry).

## When to use — trigger phrases
- "the dispatch returned an error but did the session start?"
- "payload too large" / "the launch call failed"
- reconciling whether a fired pass is actually running

## Inputs
- A dispatch/launch call that returned an error or an oversize-payload response.
- Access to `list_sessions` (or the equivalent session registry).

## Procedure
1. **Don't assume failure from the error.** A payload-oversize (or similar) error on the *launch call* often means the session **still started** — the error is about the response, not the spawn.
2. **Verify via `list_sessions`** — look for a live session matching the dispatch before re-firing.
3. If it's running → let it run (don't double-dispatch). If it's genuinely absent → re-fire, trimming the payload (move bulk context into a file the prompt reads, not the prompt body).
4. Prefer file-referenced context over giant inline prompts to avoid the oversize path entirely.

## Output
Correct reconciliation — no duplicate sessions, no orphaned "did it run?" ambiguity.

## Guardrails
- **A launch error ≠ no launch.** Check the registry before concluding failure (memory: the CoS Pass 1 "retry" that had actually started).
- **Never double-dispatch on an unverified error** — you'll get two competing sessions writing the same files.
- **Trim payloads by reference** — put the big context in a doc and have the prompt read it; keep the prompt body lean.
- Compose with `wait-for-outcome-not-pr-number`: the outcome (session running, deliverable appearing) is the truth, not the launch call's return value.

## Worked example
CoS Pass 1 landed as "PR #352 (retry)" — the first dispatch appeared to error but the session had started; the correct move was to reconcile via the session list rather than blindly re-run and fork the work. The general rule: oversize/launch errors are verified against `list_sessions`, not trusted at face value.
