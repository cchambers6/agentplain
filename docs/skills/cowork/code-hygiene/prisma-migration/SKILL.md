---
name: prisma-migration
description: Generate and commit a Prisma migration whenever the schema changes, so CI schema-drift stays green. Use after editing prisma/schema.prisma or when CI is red on drift / production hits P3009. Never ship a schema edit without its migration folder.
---

# Prisma migration on every schema change

A schema edit and its generated migration ship together — always. A mismatch is the #1 schema-drift CI failure.

## Procedure

1. Edit `prisma/schema.prisma`.
2. Generate the migration:
   ```
   npx prisma migrate dev --name <snake_case_change>
   ```
   → writes `prisma/migrations/<timestamp>_<name>/migration.sql` and updates the client.
3. Confirm the drift check passes (if CI runs one).
4. Commit the schema edit **and** the migration folder in the same commit.

## Rules

- **Never ship a schema edit without its migration** — schema/migration mismatch = schema-drift red.
- **Raw-SQL index migrations need a drift-baseline entry** — a hand-written `CREATE INDEX` reads as drift unless baselined.
- **Production P3009** (a failed migration in `_prisma_migrations`) is resolved with `prisma migrate resolve`, NOT by resuming a paused database branch.
- Deploy-time migrations are gated to the production environment.

## Origin

`prisma/migrations/*` (e.g. `20260603000000_support_draft_into_review`), `.github/workflows/schema-drift.yml`, `scripts/check-schema-drift.ts`. The "migrate resolve, not resume-branch" rule came from the fin-ops kaizen retro.
