-- feat(retention) — weekly customer report email opt-in toggle.
-- (feat/weekly-customer-report-email)
--
-- Adds one boolean to WorkspacePreference: weeklyReportEnabled. The Friday
-- 8am ET weekly-customer-report cron reads it per workspace and skips any
-- workspace that opted out. The email's one-click unsubscribe link and the
-- /reports/weekly toggle both flip it.
--
-- DEFAULT TRUE so every existing workspace is opted IN on backfill — the
-- report is a retention/ROI surface we want on by default; customers opt
-- OUT, not in. NOT NULL with a column default means the ALTER backfills
-- every existing row in one statement (no data migration pass needed) and
-- creates no schema-drift baseline entry (this is a plain Prisma-modeled
-- column, not a raw-SQL index — see project_schema_drift_baseline_for_raw_indexes).

ALTER TABLE "WorkspacePreference"
  ADD COLUMN "weeklyReportEnabled" BOOLEAN NOT NULL DEFAULT true;
