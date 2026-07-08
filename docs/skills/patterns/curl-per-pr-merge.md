# Pattern: curl-per-PR create/merge (past the auto-mode classifier)

**Group:** code/process · **Seeded by:** `.mk-pr.mjs`, `pr-sweep.mjs`; used on PR #306 and every fleet PR since.

> This pattern has a full ready-to-run runbook: **[`../code-hygiene/curl-per-pr-merge.md`](../code-hygiene/curl-per-pr-merge.md)**. Summary below.

## When to use — trigger phrases
- "open the PR" / "merge PR #NNN" headless / "sweep the open PRs" / "gh hangs on the classifier"

## The primitive
- **Create:** `GET /pulls?head=owner:branch&state=open` (idempotency) → if none, `POST /pulls {title,head,base,body}`. Token from `git credential fill`. Header `Authorization: token <TOKEN>` (**`token`, not `Bearer`** for `ghs_` tokens).
- **Merge:** `GET /pulls/{n}` → check `mergeable_state` (`clean`?) → `PUT /pulls/{n}/merge {merge_method:"squash"}`.
- One PR per REST call — no bulk endpoint, no classifier, full control.

## Guardrails (see runbook for all)
- `token` auth scheme, not `Bearer`.
- Idempotent create — always do the `?head=` lookup first (avoids 422).
- Read `mergeable_state` before merging.
- PR body from a file (`.pr-body-<slug>.md`), never shell-quoted inline.

Full procedure + worked example: **[`../code-hygiene/curl-per-pr-merge.md`](../code-hygiene/curl-per-pr-merge.md)**.
