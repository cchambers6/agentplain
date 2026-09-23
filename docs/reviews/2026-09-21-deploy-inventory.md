# Deploy inventory — what ships when production unfreezes

**Written 2026-09-21. Read ref: `origin/main` @ `2fe80b5`.**
**Range analysed: `d5fcfad9..origin/main` — 292 commits, 90 merges, clean linear ancestry (verified with `git merge-base --is-ancestor`).**

`d5fcfad9` (2026-06-17) is the last commit that ever reached production successfully. Everything below has been merged to `main` and never run against production data.

Nothing in this document was executed against the production database. No deploy was triggered.

---

## The headline

**The batch is much safer than its size suggests, with two exceptions.**

Every schema change is additive — 752 insertions to `schema.prisma`, **zero deletions**, and zero destructive statements across all 11 pending migrations. No `DROP`, no `TRUNCATE`, no `DELETE FROM`, no column removals. There is no data-loss shape here.

The two things that can genuinely bite:

1. **A P3009 landmine in `20260618000003_client_portal`** — the known rename. Details below. This is the one that decides whether the first deploy attempt even starts.
2. **Next.js 14.2.18 → 15.5.25**, a major-version upgrade that has never served production traffic.

---

## 1. Migrations — there are **eleven** pending, not four

| # | migration | lines | notes |
|---|---|---|---|
| 1 | `20260617000000_add_vertical_mcp_providers` | 16 | 5× `IF NOT EXISTS` — replay-safe |
| 2 | `20260617000000_memory_scale_rls_tiering_byo` | 245 | no `IF NOT EXISTS` |
| 3 | `20260617120000_knowledge_jurisdiction_refresh` | 25 | |
| 4 | `20260618000000_chat_retention_and_data_minimization` | 24 | |
| 5 | `20260618000001_add_connector_write_action_kind` | 14 | |
| 6 | `20260618000002_voice_recording_and_action_item_kinds` | 21 | |
| 7 | **`20260618000003_client_portal`** | **270** | **⚠ the landmine — see below** |
| 8 | `20260618000004_guarantee_time_savings` | 63 | |
| 9 | `20260703000000_outreach_crm_lite` | 59 | |
| 10 | `20260711000000_pilot_p0_partner_prefs` | 20 | |
| 11 | `20260830000000_portal_team_outreach_rls` | 421 | enables RLS on 12 tables |

Two share the prefix `20260617000000`. That is safe — Prisma keys its ledger on the full directory name, and the names differ. (The repo has 8 duplicate-prefix pairs overall; none are a hazard for the same reason.)

### ⚠ The one that decides whether the deploy starts at all

`20260618000003_client_portal` contains **4 bare `CREATE TYPE` statements with no `IF NOT EXISTS`**:

```
CREATE TYPE "PortalActor"
CREATE TYPE "PortalCaseStatus"      <-- the exact type in the recorded 42710 error
CREATE TYPE "PortalMessageDelivery"
CREATE TYPE "PortalScanStatus"
```

This directory was renamed from `20260617000000_client_portal` **after** it had already been applied to production. If the ledger still carries a row under the old name and nothing carries the new one, `migrate deploy` replays this script and dies on `CREATE TYPE "PortalCaseStatus" already exists` (42710 → P3009).

**Verified:** the old directory `20260617000000_client_portal` exists on no `origin` branch, and `git log --diff-filter=R` finds no rename in `prisma/migrations/` history — the rename was squashed away. So the repo cannot tell you whether the ledger was repaired.

**Unverified — and this is the gating question:** whether `prisma migrate resolve --applied` was actually run against production. I could not check; reading `_prisma_migrations` requires the production connection string, which is correctly not available on this machine. **Conner's `prisma migrate status` run answers this and nothing else can.**

- If it reports a failed migration / P3009 → resolve it **before** any deploy attempt.
- If it reports only pending migrations → the lane is clear.

### The other direction of the same trap

`migrate status` also reports *applied migrations with no directory*. I found no evidence of any on `origin/main`, but only the ledger can confirm that direction. Treat it as **unverified**.

---

## 2. Schema — 14 new models, 12 new enums, nothing removed

New models: `MemoryAuditLog`, `OutreachProspect`, `OutreachTouch`, `PortalCase`, `PortalCaseEvent`, `PortalClient`, `PortalConfig`, `PortalDocument`, `PortalInvite`, `PortalMessage`, `PortalSession`, `PortalThread`, `TimeSavingsEntry`, `WorkspaceStorageConfig`.

New enums: `DataRegion`, `MemoryAuditAction`, `MemoryAuditActorType`, `MemoryStorageProvider`, `MemoryTier`, `OutreachStage`, `OutreachTouchKind`, `PortalActor`, `PortalCaseStatus`, `PortalMessageDelivery`, `PortalScanStatus`, `StorageKmsProvider`.

Entirely new subsystems (client portal, outreach CRM, memory tiering). They add tables rather than reshaping existing ones, which is why the risk is concentrated in *migration replay*, not in *data migration*.

### A gap this closes

`20260830000000_portal_team_outreach_rls` enables row-level security on 12 tables, **`PortalConfig` among them**. Memory recorded "PortalConfig has NO RLS" as an open gap. It is closed in code — and still open in production, because this migration has never been applied. Deploying closes it.

---

## 3. Next.js 14.2.18 → 15.5.25 — the biggest runtime unknown

A major-version framework upgrade (PR #575, the tip commit) sitting undeployed. `postcss` 8.4 → 8.5 and `eslint-config-next` moved with it.

**What is proven:** it compiles and typechecks. Preview deployments run the full `next build` and have been green throughout — including on `2fe80b5` itself. Build-time risk is genuinely low, and that is evidence, not optimism.

**What is not proven:** Next 15 runtime behaviour under production traffic and production data. Previews exercise the build; they do not exercise production load, real sessions, or the production database — previews have no database URL at all (both DB vars are Production-scope-only in Vercel). Next 15's async request APIs (`cookies()`, `headers()`, `params`, `searchParams`) are the usual source of first-contact surprises.

**This is the item I would watch hardest in the first ten minutes after a green deploy.**

---

## 4. Environment variables — no missing hard requirement

`lib/env.ts` hard-fails on 8 variables:

`DATABASE_URL`, `DATABASE_URL_DIRECT`, `ENCRYPTION_KEY`, `NOTION_API_KEY`, `RESEND_API_KEY`, `SESSION_PASSWORD`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`

**All 8 are present in Vercel Production** (verified via `vercel env ls production`). **No new `required()` entry was added anywhere in the range** — verified by diffing `lib/env.ts` across `d5fcfad9..origin/main`.

So there is no "deploy goes green then every route 500s on a missing secret" failure waiting. That was worth ruling out.

~29 *new* env vars are referenced in the range (voice/Twilio, Cartesia, ElevenLabs, Clio OAuth, knowledge-store selection, blob storage, demo seeding). All are optional or feature-gated — absent means the feature stays off, not that the app breaks.

### One thing that looked alarming and is not

`SESSION_SECRET` and `CRON_SECRET` appear in the range and are **not** set in Vercel Production. `chiron/lib/auth.ts` even throws at module load when `SESSION_SECRET` is unset.

Both live **only under `chiron/`**, which has its own `next.config.mjs` and `package-lock.json` and carries `MOVE-TO-DEDICATED-REPO.md` / `MOVED-TO-FLATSBO.md`. The root Next build only picks up the root `app/` directory, so chiron routes are not deployed. The main app uses `SESSION_PASSWORD`, which is set.

Chiron `.ts` files *are* still typechecked at build time — a build concern, not a runtime one, and previews prove it passes.

---

## 5. Content — deploying **fixes** a live violation

Memory recorded that production serves the banned phrase "first month free". **Checked against live production today, and the memory was half right:**

| live page | occurrences |
|---|---|
| `agentplain.com/` | 0 |
| `agentplain.com/pricing` | 0 |
| `agentplain.com/real-estate` | **4** |
| `agentplain.com/cpa` | **4** |

On `origin/main` the phrase survives only in `tests/marketing-banned-strings.test.ts`, `tests/vertical-value-bar.test.ts`, `lib/knowledge/corpus-claim-safety.test.ts` and `lib/knowledge/seed-data.ts` — i.e. in the gate that asserts its absence, not in shipped copy.

The gate is `tests/marketing-banned-strings.test.ts` (`BANNED_PRICING_REGEX`), which describes it as a *"dead billing mechanic — the on-ramp is a trial; a card IS captured at signup."*

**So the pricing content fix is already written and merely undeployed.** Deploying removes a live, customer-visible pricing claim that the repo considers banned. This is an argument *for* shipping, not a risk of shipping.

---

## 6. What ships, by shape

90 merges: 27 `fix`, 14 `feat`, 10 `kaizen`, 10 `audit`, 5 `ops`, 5 `chore`, plus planning/synthesis/docs. Fixes outnumber features roughly 2:1, which is the healthier ratio for a batch this size — most of it is correction of things already live, not new surface area.

Also in the batch: the build command itself changed from
`prisma generate && prisma migrate deploy && next build`
to
`prisma generate && node scripts/prisma-migrate-gate.mjs && node tools/brand/brand-gate.mjs && next build`.
PR #641 changes this line again.

15 new API routes, including `app/api/health/ready/route.ts`.

---

## 7. What I could not assess without a deploy

Named plainly, because these are the real unknowns:

1. **Whether the P3009 ledger repair was actually applied.** Needs `_prisma_migrations`. Gating.
2. **Whether applied-migrations-with-no-directory exist.** Same source. Unverified in that direction.
3. **How the 11 migrations behave against production data volume.** They are additive and index-creating; `20260830000000_portal_team_outreach_rls` adds 9 indexes and 12 policies. On a large table, index creation locks. I have no production row counts and did not attempt to obtain any.
4. **Next 15 runtime behaviour against production traffic.** Only a real deploy shows this.
5. **Whether RLS policies behave correctly against real multi-tenant rows.** `rls-live.yml` exercises them against a throwaway local Postgres, never production.
6. **Anything requiring the production DB connection string.** Not available here by design; `vercel env pull` correctly returns nothing for real secrets.

---

## 8. Suggested order for tomorrow

1. **Read `prisma migrate status` output first.** It gates everything. If P3009 → `prisma migrate resolve` before anything else.
2. **Add the five GitHub repo secrets** (verified absent 2026-09-21 — see PR #641). Nothing can run without them.
3. **Merge #641**, then let `production-deploy` run. Its preflight step reports Neon reachability per address family before touching migrations, so the first run is diagnostic either way.
4. **If migrations apply cleanly, watch the first ten minutes** — Next 15 is the unknown, not the schema.
5. **Re-check `/real-estate` and `/cpa`** for "first month free" to confirm the content fix actually landed. That is a cheap, concrete proof the deploy was real.

---

*Every claim here is either backed by a command run against `origin/main` @ `2fe80b5`, against the live production site, or against Vercel/GitHub APIs — or is explicitly marked unverified. Nothing was inferred from a previous session's memory without re-checking; where memory disagreed with evidence (the "first month free" scope, the count of pending migrations), the evidence is what is recorded above.*
