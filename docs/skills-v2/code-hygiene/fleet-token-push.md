# Fleet-token push — ready-to-run runbook (real paths)

**Kind:** runbook · **Canonical skill:** [`../cowork/fleet-ops/fleet-token-push/SKILL.md`](../cowork/fleet-ops/fleet-token-push/SKILL.md) · **Seeded by:** every fleet PR June–July 2026; scripts verified on disk 2026-07-08.

## The real primitives (agentplain repo)

- `scripts/git/agentplain-fleet-credential-helper.ts` — git credential protocol; mints a ~1h GitHub App installation token via `lib/github/app-auth.ts` (RS256 JWT → `/app/installations/…/access_tokens`); scoped to `cchambers6/*`; never logs the PEM or the token.
- `.get-token.mjs` (repo root) — `node C:/agentplain/.get-token.mjs <abs-output-file>` → token to a `0600` file, never stdout. Helper path is hardcoded to `C:/agentplain/...`; runs `node --import tsx`, so it needs `node_modules` on cwd.
- **`scripts/mint-fleet-token.mjs` does not exist in this repo** — same-named minters exist in flatsbo-side vocabulary; here, cite the pair above.

## Full sequence (worktree build → push → verify → PR → teardown)

```bash
# 1. Isolated worktree + junction (never npm ci)
git worktree add C:/agentplain-wt-<name> --detach origin/main
cmd //c "mklink /J C:\agentplain-wt-<name>\node_modules C:\agentplain\node_modules"
git -C C:/agentplain-wt-<name> switch -c <branch>

# 2. ...edit, commit... then rebase-first + full build (fresh worktrees run NO husky hooks)
git -C C:/agentplain-wt-<name> fetch origin && git -C C:/agentplain-wt-<name> rebase origin/main
cd C:/agentplain-wt-<name> && PRISMA_GENERATE_NO_ENGINE=true npm run build:no-migrate

# 3. Mint + push (explicit Windows path — bash /tmp ≠ node os.tmpdir())
node C:/agentplain/.get-token.mjs C:/Users/<you>/AppData/Local/Temp/ap-token.txt
TOKEN=$(cat C:/Users/<you>/AppData/Local/Temp/ap-token.txt)
git -C C:/agentplain-wt-<name> push \
  "https://x-access-token:${TOKEN}@github.com/cchambers6/agentplain.git" \
  <branch>:<branch> --force-with-lease
rm -f C:/Users/<you>/AppData/Local/Temp/ap-token.txt

# 4. VERIFY — exit 0 is not evidence (silent-403 precedent)
curl -sI https://github.com/cchambers6/agentplain/tree/<branch> | head -1     # HTTP/2 200
git -C C:/agentplain-wt-<name> ls-remote origin <branch>                      # SHA = local HEAD

# 5. PR via REST (see ./curl-per-pr-merge.md) — re-mint if >~45 min since step 3 (1h TTL)

# 6. TEARDOWN — junction FIRST, or --force deletes the real node_modules through it
cmd //c "rmdir C:\agentplain-wt-<name>\node_modules"
git worktree remove C:/agentplain-wt-<name> --force
```

## Failure modes

| Symptom | Meaning | Move |
|---|---|---|
| push exits 0, branch URL 404s | silent 403 (scope/expiry) | re-mint, re-push, re-verify |
| API 404 on the private repo | auth, not absence | mint a token first |
| `Bearer` header 401 | `ghs_` needs `token` scheme | `Authorization: token <T>` |
| `tsx ERR_MODULE_NOT_FOUND` on push | broken hook noise, exits 0 | ignore for push; run the build yourself |
| bare `--force-with-lease` rejected | detached HEAD | `--force-with-lease=<branch>:<old-sha>` |
