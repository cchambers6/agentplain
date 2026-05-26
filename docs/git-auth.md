# Git authentication for agentplain-fleet

## TL;DR

```
pwsh scripts/git/setup-fleet-credential-helper.ps1      # Windows
sh   scripts/git/setup-fleet-credential-helper.sh       # POSIX
```

Then `git push` works for any repo under `cchambers6/*` on github.com — no
manual token mint, no `x-access-token` URL pasting, no PAT in plaintext.

## What this fixes

Before this helper, every code session that needed to push had to hand-mint a
fresh installation token from the agentplain-fleet GitHub App private key and
splice it into the remote URL. That friction is P0-3 in
`docs/fleet-architecture.md` — "no git credential helper around the
agentplain-fleet App token flow". The helper makes auth durable: git asks for
credentials, the helper mints a fresh ~1h token on demand, git pushes.

## How it works

1. `scripts/git/setup-fleet-credential-helper.{ps1,sh}` registers a
   `credential.helper` scoped to `https://github.com/cchambers6/*` in
   `~/.gitconfig`. It also turns on `credential.useHttpPath` for github.com so
   the request path is part of the credential lookup.
2. When git needs auth for a URL under cchambers6, it invokes
   `scripts/git/agentplain-fleet-credential-helper.ts` with the action `get`.
3. The helper reads `protocol=`, `host=`, `path=` from stdin, verifies
   `host=github.com` and that the path's first segment is `cchambers6` (the
   only owner this helper services).
4. It reads the App private key from `AGENTPLAIN_FLEET_PEM_PATH`
   (default `C:\private\agentplain-fleet.2026-05-14.private-key (2).pem`),
   builds an RS256-signed App JWT, POSTs to
   `/app/installations/132417507/access_tokens`, and emits
   `username=x-access-token` + `password=<token>` on stdout.
5. Git uses those credentials for the request. The token never touches disk.

For anything else — different host, different owner, a `store` / `erase`
action, missing path — the helper emits nothing. Git falls through to whatever
else is configured (or prompts).

The token-mint engine is `lib/github/app-auth.ts`. Same engine the fleet's
cron-output committer uses; same engine that ships across to flatsbo (the App
is installed on both repos).

## Environment

| Variable | Required | Default |
|---|---|---|
| `AGENTPLAIN_FLEET_PEM_PATH` | optional | `C:\private\agentplain-fleet.2026-05-14.private-key (2).pem` |

The PEM is read fresh on every helper invocation; rotating the key is a file
swap.

## Verifying the setup

```
git config --global --get-regexp '^credential\.'
```

You should see entries similar to:

```
credential.https://github.com.usehttppath true
credential.https://github.com/cchambers6.helper
credential.https://github.com/cchambers6.helper !node --import tsx 'C:/agentplain/scripts/git/agentplain-fleet-credential-helper.ts'
```

The blank `helper` entry is intentional — it resets any inherited helper chain
(e.g. `manager-core`) at this URL scope so only our helper fires for
cchambers6 URLs.

## Security note

This grants the App's scoped permissions (Contents/PR/Workflows write on
`@cchambers6` only — the App is not installed on any other account) to **any
local git operation under `cchambers6/*`**. Concretely: anything on this
machine that can run `git push` to a cchambers6 repo will, transparently, have
write access via a fresh App token.

- Intended for the fleet's own dedicated machine. Don't install on a shared
  workstation.
- The PEM file at `C:\private\` must remain readable only by the fleet user.
- The helper never logs the PEM or the minted token; it writes the token only
  to git's stdin pipe.
- Off-target requests (other hosts, other owners) are a strict no-op — the
  helper cannot leak the token to a malicious remote that happens to be
  configured.
- Rotating the App key: drop a new PEM at `AGENTPLAIN_FLEET_PEM_PATH` (or set
  the env var to the new path). No config change needed.

## Portability

Same App is installed on both `cchambers6/agentplain` and
`cchambers6/flatsbo`, so the helper Just Works for both. The token-mint engine
(`lib/github/app-auth.ts`) is a verbatim port of the flatsbo module; either
repo can host the canonical implementation. If a future forge (GitLab, Gitea)
gets a fleet App, add a sibling helper script that calls the corresponding
`ForgeAppAuth` implementation — the interface is already vendor-neutral.

## Uninstalling

```
git config --global --unset-all credential.https://github.com/cchambers6.helper
git config --global --unset credential.https://github.com.useHttpPath
```
