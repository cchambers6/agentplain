# Runbook: restore production after the database credential was rotated

**Status as of 2026-09-24:** production is DOWN in the way that matters. It has
not deployed successfully in **98.9 days** (149 consecutive failed production
deployments), and the 2026-06-17 build that is still live serves
`/api/health` **503** with `db.ok=false`. Marketing pages return 200, which is
why this looked fine for three months.

**There is one human action.** Everything else is automated below.

---

## What Conner does

1. **Reset the password** in the [Neon console](https://console.neon.tech) —
   project `agentplain` → **Roles** → `neondb_owner` → **Reset password**.
   Then open **Connection Details** and copy the **pooled** connection string
   (its host contains `-pooler`).

2. **Run one command**, pasting that string between the quotes:

   ```bash
   NEW_DATABASE_URL='PASTE_THE_POOLED_STRING_HERE' \
     node scripts/ops/restore-db-credential.mjs
   ```

3. **Done.** The script prints a ledger of exactly what changed and ends with
   the production deployment state. If it says `READY`, confirm with:

   ```bash
   curl -s https://agentplain.com/api/health
   ```

   You want `"status":"ok"` and `"db":{"ok":true,...}`.

> The direct (non-pooled) URL is derived automatically by removing `-pooler`
> from the host, so only one string is needed. Pass
> `NEW_DATABASE_URL_DIRECT='...'` to override.

---

## What the command actually does

| Step | Action | Needs |
|---|---|---|
| 1 | Validate the string, derive the direct URL | — |
| 2 | **Verify the credential against Neon** | — |
| 3 | Set `DATABASE_URL` + `DATABASE_URL_DIRECT` in Vercel Production | Vercel session |
| 4 | Set the 5 GitHub Actions secrets | `GH_SECRETS_TOKEN` |
| 5 | Deploy to production and watch to a terminal state | Vercel session |

**Step 2 is the safety property.** The likely failure is a mistyped or wrong
password, so it is checked *before any system is modified*. If Neon rejects it
the script exits non-zero having changed nothing, and says so.

Vercel and GitHub writes cannot be made atomic with each other, so the ledger at
the end names every step `APPLIED`, `SKIPPED`, or `FAILED`. A partial run is
never ambiguous.

Secrets are read from the environment (never argv, so they stay out of shell
history and out of `ps`), and every printed line passes through a redactor
seeded with the real values. The script prints hostnames, never credentials.

---

## Step 4 needs a token Conner must supply

The `agentplain-fleet` GitHub App token **cannot write Actions secrets** — it has
no secrets scope and returns **403** on `actions/secrets/public-key`. Verified
2026-09-24.

Without `GH_SECRETS_TOKEN`, step 4 is **skipped loudly** and steps 1-3 and 5
still run — production still gets fixed. What stays broken is the
`production-deploy` workflow, whose five secrets are all currently missing
(`DATABASE_URL`, `DATABASE_URL_DIRECT`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`,
`VERCEL_PROJECT_ID`; the repo's own `key-registry` check reports this on every
PR as `present: <NAME> -> failure`).

That matters because **`vercel.json` sets `git.deploymentEnabled.main = false`**,
so pushing to `main` deploys nothing. Until those five secrets exist, every
production deploy is manual — which is exactly how production goes stale again.

To fix that too, create a fine-grained PAT with **Secrets: read and write** on
`cchambers6/agentplain` and run:

```bash
NEW_DATABASE_URL='...' GH_SECRETS_TOKEN='github_pat_...' \
  node scripts/ops/restore-db-credential.mjs
```

Or set the five by hand at
`https://github.com/cchambers6/agentplain/settings/secrets/actions`.

---

## Why this happened, so it is recognisable next time

Three different failures wore the same costume — "the database is unreachable":

1. **P3009** — a failed migration. Fixed earlier.
2. **P1001** — *not* a connectivity problem with the database. Vercel build
   containers have **no IPv6 route**, Neon publishes **AAAA** records, and
   Prisma's Rust engine took the AAAA path and got an instant `ENETUNREACH`,
   which it reports as "can't reach database server". Measured from inside a
   builder: IPv4 connects in **4ms**; IPv6 is `ENETUNREACH` in **0ms**. Fixed by
   `scripts/with-ipv4-db.mjs`, which rewrites the host to its A record and
   carries the endpoint id in `options` (Neon routes by TLS SNI, unavailable on
   an IP literal).
3. **P1000 / 28P01** — the actual credential problem, which only became visible
   once (2) was fixed. P1001 had been masking it for 96 days.

**Do not test IPv6 reachability from the desktop.** It has no IPv6 egress at all
(Cloudflare, Google DNS and Neon's own console all time out), so a local result
says nothing about Vercel. Measure from inside a builder.

## Rollback is not a fallback here

`dpl_51WDT33qmmVu567GUh8Fp59VGWjF` (`d5fcfad9`) and
`dpl_ELDgiwKvNzz71GMrbAjVHL5Zx448` (`bb8cfcfe`) are flagged as rollback
candidates. Both are 2026-06-17 builds, both read the same Vercel
`DATABASE_URL`, and the first one **is already what production serves** — and it
is already returning 503 with `db.ok=false`. Rolling back changes nothing.
The credential is the only lever.
