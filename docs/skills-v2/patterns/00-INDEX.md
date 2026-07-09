# patterns/ — the incident casebook (v2)

In v1, `patterns/` duplicated each skill as a prose twin. v2 collapses that: **each `cowork/**/SKILL.md` is the single canonical text for its skill** (self-contained, with an example invocation). What remains here is what a per-skill file can't hold — the **cross-cutting mechanics dossiers**: one page per failure domain, every recorded incident with its citation, and the skill that now encodes each lesson.

Use these when diagnosing ("which known incident does this smell like?") or when writing a new skill ([[capability-builder]] step 1: recurrence evidence lives here).

| Dossier | Domain | Feeds skills |
|---|---|---|
| [windows-worktree-mechanics](./windows-worktree-mechanics.md) | junctions, hooks, Prisma, teardown | isolated-worktree · rebase-first-full-build · detached-worktree-rebase |
| [github-fleet-auth-mechanics](./github-fleet-auth-mechanics.md) | tokens, 403/404, REST, verification | fleet-token-push · push-verification · curl-per-pr-merge · no-secrets-in-chat |
| [parallel-wave-collision-modes](./parallel-wave-collision-modes.md) | rebase tax, HEAD switching, stacks, union dups | sequential-landings · stacked-pr-discipline · rebase-first-full-build |
| [dispatch-session-mechanics](./dispatch-session-mechanics.md) | launch, amend, wedge, liveness | orchestrator-prompt-hygiene · payload-oversize-handling · dispatch-amend-in-flight · scheduled-task-liveness |
| [built-but-unwired-ledger](./built-but-unwired-ledger.md) | producers with no consumers | wired-not-just-built · scheduled-task-liveness · truth-wave-check |
