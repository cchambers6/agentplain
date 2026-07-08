# Pattern: fleet-token push flow

**Group:** code/process · **Seeded by:** `scripts/git/agentplain-fleet-credential-helper.ts` + `.get-token.mjs`; used on every fleet PR.

> This pattern has a full ready-to-run runbook: **[`../code-hygiene/fleet-token-push.md`](../code-hygiene/fleet-token-push.md)**. Summary below.

## When to use — trigger phrases
- "push the branch as the fleet bot" / "gh isn't logged in" / "mint a token to push"

## The primitive in three lines
1. Token comes from the committed git **credential helper** (`scripts/git/agentplain-fleet-credential-helper.ts`), wrapped by `.get-token.mjs <output-file>` — token to a `0600` file, never stdout.
2. Push with `git push "https://x-access-token:${TOKEN}@github.com/cchambers6/agentplain.git" <branch>:<branch> --force-with-lease`.
3. Shred the token file.

## Guardrails (see runbook for all)
- `--force-with-lease`, never `--force`.
- Token never in stdout / commit / PR body / log.
- Credential helper needs `node_modules` on cwd (`node --import tsx`) — junction it in a worktree.
- Cleanup: `rmdir` the junction **before** `git worktree remove`.

Full procedure, gotchas (Windows `/tmp` trap, `ghs_`-token scheme), and worked example: **[`../code-hygiene/fleet-token-push.md`](../code-hygiene/fleet-token-push.md)**.
