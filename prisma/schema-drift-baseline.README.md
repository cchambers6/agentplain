# `schema-drift-baseline.sql` — what it is, why it exists

`prisma/schema-drift-baseline.sql` is the **expected, intentional**
output of:

```sh
prisma migrate diff \
  --from-migrations prisma/migrations \
  --to-schema-datamodel prisma/schema.prisma \
  --shadow-database-url $SHADOW_DATABASE_URL \
  --script
```

`scripts/check-schema-drift.ts` runs that exact command in CI, normalizes
whitespace + line endings, and compares against this file. The check is
**green** when the current diff equals the baseline (no NEW drift) and
**red** when the current diff diverges from the baseline (genuinely new
schema changes that aren't migrated).

The baseline is NOT an empty file — it captures pre-existing,
load-bearing drift that we cannot fix in a single migration without
either (a) regressing a load-bearing pgvector index or (b) churning
every table for cosmetic Prisma-version differences. Categorized:

## What's in the baseline

### 1. `DROP INDEX "Embedding_vector_cosine_idx"` — DO NOT APPLY

This is the load-bearing pgvector ANN index used by
`lib/knowledge/pgvector-store.ts` for every customer-facing
"non-generic answer" path (knowledge substrate retrieval, customer-file
search). The index uses `vector_cosine_ops`, which is a pgvector
operator class. **Prisma's schema language has no representation for
pgvector index types**, so the schema can't declare it; the migration
created it manually. The diff says "schema doesn't declare it → drop
it"; reality is "schema CAN'T declare it; keep it."

Any future reconciliation migration MUST preserve this index by hand-
editing the generated migration to omit the DROP INDEX line.

### 1b. Four `DROP INDEX … _trgm_idx` — DO NOT APPLY

`20260603000000_operator_fleet_activity_indexes` (the /operator/fleet
activity inspector, Stream D.1 / PR #137) creates four **GIN `pg_trgm`
trigram** indexes that back the inspector's free-text `ILIKE %term%`
search:

- `SkillRun_skillSlug_trgm_idx`
- `SkillRun_discipline_trgm_idx`
- `SkillRun_errorMessage_trgm_idx`
- `WorkApprovalQueueItem_agentSlug_trgm_idx`

Each is `USING gin (<col> gin_trgm_ops)`. Like the pgvector ANN index
above, these are created by raw SQL in the migration and are **not
declared in `schema.prisma`** — so `migrate diff` reports them as "schema
doesn't declare it → drop it" when reality is "keep it." (The migration's
btree companion, `SkillRun_firedAt_workspaceId_idx`, IS declared via
`@@index([firedAt(sort: Desc), workspaceId])` and round-trips cleanly, so
it does NOT appear here.) The same hand-edit-out rule applies to any
future reconciliation migration: preserve these four `CREATE INDEX … gin`
statements.

### 2. `ALTER COLUMN "id" DROP DEFAULT` on 21 tables

Migrations declared a Postgres-level `gen_random_uuid()` DEFAULT on every
UUID id column. The current schema declares `@default(uuid())` which
Prisma generates *client-side* (no Postgres-level DEFAULT). Tables
affected: `AuditLog`, `BillingEvent`, `CapabilityProposal`,
`ComplianceFlag`, `Embedding`, `HandoffLogEntry`,
`IntegrationCredential`, `KnowledgeDocument`, `MagicLinkToken`,
`Membership`, `OnboardingState`, `PreferenceFeedback`, `PreferenceSignal`,
`Subscription`, `WebhookEvent`, `WebhookSubscription`,
`WorkApprovalQueueItem`, `WorkThresholdConfig`, `Workspace`,
`WorkspaceInvoice`, `WorkspacePreference`.

This is **cosmetic** — every insert goes through the Prisma client which
supplies the UUID, so the database never relies on the missing default.
Removing the defaults would touch every table; not worth a churn
migration for zero runtime difference.

### 3. All 24 FKs dropped + re-added (identical semantics)

Each `ALTER TABLE … DROP CONSTRAINT … _fkey` is paired with an
`ALTER TABLE … ADD CONSTRAINT … _fkey FOREIGN KEY … REFERENCES …`. Same
columns, same `ON DELETE` / `ON UPDATE` semantics — Prisma's
`migrate diff` re-formats them due to a version difference in how FK
constraints serialize. Effectively a no-op rewrite.

### 4. Two index renames

**`HandoffLogEntry_subject_idx`** → the auto-generated multi-column name
`HandoffLogEntry_workspaceId_relatedSubjectTable_relatedSubj_idx`. The
schema declares the multi-column index; Prisma auto-names it from the
columns; the original migration used a shorter manual name. Cosmetic.

**`TimeSavingsEntry_workspaceId_sourceTable_sourceId_actionType_ke`** →
`TimeSavingsEntry_workspaceId_sourceTable_sourceId_actionTyp_key`. The
`20260618000004_guarantee_time_savings` migration applied a unique-index
name that is 64 characters long; Postgres silently truncates identifiers
at 63 characters (`…_actionType_ke`). Prisma generates its own 63-char
truncation (`…_actionTyp_key`) when reading the schema, so `migrate diff`
proposes a rename. Both names are 63 chars; truncation points differ.
Cosmetic — the index and its uniqueness constraint are unchanged.

## The deeper reconciliation — tracked follow-up

A proper reconciliation migration that:

  - **Preserves** `Embedding_vector_cosine_idx` (hand-edit out the
    DROP INDEX line — pgvector index must survive)
  - Accepts the DROP DEFAULT churn on every id column
  - Accepts the FK reformatting
  - Accepts the index rename

…should be sequenced AFTER PR #68's `WebhookEvent` idempotency+retry
migration merges, so the new `dedupeKey` / `attemptCount` /
`nextAttemptAt` / `deadlettered` columns don't collide. Once that
reconciliation lands, this baseline file shrinks to (or near) zero and
the gate becomes a stricter empty-diff check.

## When to update this baseline

If you intentionally introduce a new piece of drift (e.g. an index type
Prisma can't represent), append the expected SQL to this file with a
comment explaining why it's intentional. Bulk-regeneration via
`npm run check:schema-drift -- --update-baseline` is supported and is
the right path after the reconciliation migration above.

If the CI gate goes red and the new lines look like real, accidental
schema drift (a column you added without `prisma migrate dev`), DO NOT
update the baseline — generate a real migration instead.

## Raw-index auto-heal (Wave-7, theme #19)

The dominant red-gate cause is a NEW raw-SQL index migration
(GIN/trgm/pgvector) whose `DROP INDEX "..."` line isn't yet in this
baseline. The documented fix has always been "append the `DROP INDEX`
line here" — but until that hand-edit happened, the only way to land the
migration was the `HUSKY=0` bypass, which is exactly the jailbreak that
let *un-baselined* drift slip through.

`check-schema-drift.ts` now supports `--auto-heal-raw-indexes`:

```sh
SHADOW_DATABASE_URL=… npm run check:schema-drift -- --auto-heal-raw-indexes
```

When the **only** difference between the current diff and this baseline is
added `-- DropIndex` / `DROP INDEX "..."` pairs, the script rewrites the
baseline to the current diff (so the new lines are captured verbatim, in
Prisma's own ordering) and re-verifies. It is idempotent (a second run is
a clean no-op) and refuses **any** other drift — a forgotten column, a
renamed index, or a removed baseline line all still fail loud. The gate is
never weakened; only the one documented append is automated.

The pre-push hook runs this mode automatically when `SHADOW_DATABASE_URL`
is set, and blocks the push if the auto-heal changed this file (so you
commit the healed baseline) — replacing the `HUSKY=0` bypass for the
raw-index case. The heal logic lives in `lib/ops/schema-drift-autoheal.ts`
(pure, unit-tested without a shadow DB).
