# Dossier: GitHub fleet-auth mechanics

The auth chain, every recorded failure mode, and the verification discipline that wraps it.

## The chain (verified on disk 2026-07-08)

`AGENTPLAIN_FLEET_PEM_PATH` (App private key, `C:\private\`, fleet-user-readable only) → `lib/github/app-auth.ts` (RS256 JWT → `POST /app/installations/…/access_tokens`, ~1h TTL) → `scripts/git/agentplain-fleet-credential-helper.ts` (git credential protocol, scoped to `cchambers6/*`; emits `username=x-access-token` + `password=<token>` on stdout to git's pipe only) → `.get-token.mjs <file>` (token to a `0600` file, never stdout). Key rotation = drop a new PEM at the path; zero config change (`docs/git-auth.md`).

**Ghost warning:** `scripts/mint-fleet-token.mjs` does not exist in this repo — the name drifts in from flatsbo-side vocabulary (`feedback_no_secrets_in_chat` references a `mint-fleet-token.mjs` there). Cite the real chain above.

## Incident table

| # | Incident | Citation | Lesson → skill |
|---|---|---|---|
| 1 | **Silent 403:** PAT lacked `Contents:write`; wrapper swallowed the error; task reported branches "pushed"; GitHub 404'd both | `feedback_push_verification_required` (2026-05-14) | curl-200 + ls-remote SHA before any "pushed" claim → [[push-verification]] |
| 2 | **404 = auth, not absence:** unauth curl on the private repo 404s; sessions concluded "can't see the repo" | `feedback_flatsbo_private_use_fleet_token` (2026-07-02) | mint first, then conclude → [[fleet-token-push]] |
| 3 | **`Bearer` 401s** on `ghs_` installation tokens | sales deep-dive memory ("token not Bearer") | `Authorization: token <T>` → [[curl-per-pr-merge]] |
| 4 | **Token TTL < long gate sequences** — push gates outlive the mint; the REST PR call then 401s | kaizen 01 friction-8 | re-mint before the PR call → [[curl-per-pr-merge]] |
| 5 | **`gh` auto-mode classifier stalls headless** create/merge | `.mk-pr.mjs`/`pr-sweep.mjs` provenance; 2026-07-07/08 sweep | raw REST, one PR per call → [[curl-per-pr-merge]] |
| 6 | **Pasted PAT burned in transcript; 23 days unrevoked** while re-listed daily in the queue | `feedback_no_secrets_in_chat`; kaizen MASTER friction-5/action-15 | pasted = burned; revocation gets an SLA lane → [[no-secrets-in-chat]], [[consolidated-decision-queue]] |
| 7 | **Push-recipe knowledge spread across 4+ memory files**, re-derived per session | kaizen 01 friction-8 | the consolidated runbook → `code-hygiene/fleet-token-push.md` |

**Standing rule under all of it:** "push is not done until the remote SHA matches local HEAD" (`docs/fleet-architecture.md:376-384`).
