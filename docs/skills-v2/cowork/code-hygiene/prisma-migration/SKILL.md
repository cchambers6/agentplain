---
name: prisma-migration
description: Generate and commit a Prisma migration with every schema change, mint collision-safe timestamps, and know the production recovery moves. Use after editing prisma/schema.prisma, when CI is red on schema drift, when parallel waves both add migrations, or when production hits P3009.
---

# Prisma migration discipline

Schema-drift is the repo's dominant CI failure — 14 of 17 failed Actions runs in one 60-day window. Every rule below maps to a slice of that count.

## Procedure

1. Edit `prisma/schema.prisma`.
2. Generate — don't hand-write:
   ```
   npx prisma migrate dev --name <snake_case_change>
   ```
3. **Check the timestamp is unique on main.** Hand-minted round numbers collide across parallel waves — 8 duplicated 14-digit stamps (e.g. `20260603000000`) reached main and a dedicated heal pass had to re-mint them. Generated timestamps avoid this; if you must hand-mint, verify against `ls prisma/migrations/`.
4. Commit the schema edit **and** the migration folder in one commit.
5. Apply the drift rules **at authoring time**, not after the red X — the recipe applied at debug time is the recorded pattern; flip it.

## Rules

- **Never a schema edit without its migration** — the mismatch is the #1 drift failure.
- **Raw-SQL index migrations need a drift-baseline entry** — a hand-written `CREATE INDEX` reads as drift unless baselined (`project_schema_drift_baseline_for_raw_indexes`).
- **Production P3009** (failed migration recorded in `_prisma_migrations`) → `prisma migrate resolve`. **Not** resume-the-paused-Neon-branch — the fin-ops retro ruled that explicitly.
- **Deploy-time migrations are gated to `VERCEL_ENV=production`** (`project_vercel_red_neon_outage_fix`) — don't "fix" a red preview by un-gating them.
- **In worktrees:** `PRISMA_GENERATE_NO_ENGINE=true` avoids the shared engine-DLL EPERM under concurrent `prisma generate` ([[isolated-worktree]]).
- Overlapping schema work is a serialization trigger — two waves adding models is exactly the [[sequential-landings]] overlap audit firing.

## Example invocation

> **Input:** "Add the `support_draft_into_review` state to the schema."
>
> **Output shape:** schema edit + `prisma/migrations/<generated-ts>_support_draft_into_review/migration.sql` in one commit, timestamp verified unique, drift check green, PR body notes the migration folder. (Reference: the real `20260603000000_support_draft_into_review` — which is also one of the colliding round-number stamps; the example is the cautionary tale.)

## Compose with

[[isolated-worktree]] · [[sequential-landings]] · [[rebase-first-full-build]] (rebases can union-duplicate migrations too) · [[docs-only-pr]] (its inverse: schema means it is NOT a docs PR)

## Origin

`prisma/migrations/*` + `.github/workflows/schema-drift.yml` + `scripts/check-schema-drift.ts` · failure stats + duplicate stamps: `docs/kaizen/2026-07-02/01-engineering.md` friction-5 · P3009 ruling: `docs/kaizen/2026-07-02/07-finance-ops.md` (kaizen 7).
