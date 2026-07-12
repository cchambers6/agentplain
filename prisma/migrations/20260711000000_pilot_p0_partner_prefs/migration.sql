-- Pilot P0 bundle (fix/agentplain-pilot-p0-bundle-2026-07-11): per-partner
-- notification + first-report preferences.
--
-- approvalEmailMode — how approval-ready notifications reach the
-- broker-owner by email: 'always' (default; the after-hours ping is the
-- sold premise), 'business_hours' (immediate 8am–6pm ET weekdays, held
-- items ride the weekday-morning digest), or 'digest' (morning summary
-- only). Read by lib/push/notify.ts and the approval-digest sweep.
--
-- firstReportMode — what the Friday weekly-report cron does for a
-- workspace without a full business week yet: 'note' (default) sends a
-- first-week note; 'delay' sends nothing until the first full week
-- completes. Read by lib/reports/weekly-report.ts.
--
-- Plain ADD COLUMN with defaults: existing rows backfill to the defaults,
-- no table rewrite beyond the metadata update, zero drift-baseline impact.

ALTER TABLE "WorkspacePreference"
  ADD COLUMN "approvalEmailMode" TEXT NOT NULL DEFAULT 'always',
  ADD COLUMN "firstReportMode" TEXT NOT NULL DEFAULT 'note';
