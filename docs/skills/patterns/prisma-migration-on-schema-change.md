# Pattern: Prisma migration on every schema change

**Group:** code/process · **Seeded by:** `prisma/migrations/*` (e.g. `20260603000000_support_draft_into_review`), `.github/workflows/schema-drift.yml`, `scripts/check-schema-drift.ts`; memory: project_schema_drift_baseline_for_raw_indexes, kaizen fin-ops P3009.

## When to use — trigger phrases
- "I changed `prisma/schema.prisma`"
- "add a column / table / index / enum value"
- "CI is red on schema drift" / "P3009 in production"

## Inputs
- An edited `prisma/schema.prisma`.
- A migration name in snake_case describing the change.

## Procedure
1. Edit `schema.prisma`.
2. Generate the migration (do **not** hand-write SQL unless it's a raw index — see guardrail):
   ```bash
   npx prisma migrate dev --name <snake_case_change>
   ```
   This writes `prisma/migrations/<timestamp>_<name>/migration.sql` and updates the client.
3. If CI runs the drift check, confirm `scripts/check-schema-drift.ts` / `schema-drift.yml` passes.
4. Commit the schema **and** the generated migration folder together — never one without the other.

## Output
A `prisma/migrations/<timestamp>_<name>/` directory checked in alongside the schema edit; drift check green.

## Guardrails
- **Never ship a schema edit without its migration.** A schema/migration mismatch is the #1 CI schema-drift failure (kaizen eng: "CI 14/17 schema-drift").
- **Raw-SQL index migrations need a drift-baseline entry.** A hand-written `CREATE INDEX` migration will read as drift unless you add it to the baseline (memory: project_schema_drift_baseline_for_raw_indexes).
- **Production P3009** (a failed migration recorded in `_prisma_migrations`) is resolved with `prisma migrate resolve`, **not** by resuming a paused Neon branch (memory: kaizen7 fin-ops — "migrate resolve, NOT resume-Neon").
- Migrations are gated to `VERCEL_ENV=production` on deploy (memory: project_vercel_red_neon_outage_fix).

## Worked example
`prisma/migrations/20260603000000_support_draft_into_review/` accompanied the support "draft into review" schema change; the migration folder and the `schema.prisma` edit shipped in the same commit, keeping the drift check green.
