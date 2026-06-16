-- First-run Plaino welcome tour — per-member "seen" stamp.
-- (feat/welcome-tour-2026-06-15)
--
-- New first-run walkthrough fires on a member's FIRST load of a workspace
-- and guides them through the workspace IA (Overview / Talk to Plaino /
-- Connections / Approvals / Settings). It must fire exactly once per
-- *user, per workspace* and survive device changes, so the "seen" state is
-- a nullable timestamp on Membership (the user×workspace join) rather than
-- localStorage, a global User flag, or a shared WorkspacePreference.
--
--   welcomeTourSeenAt — NULL until the member finishes or skips the tour;
--                       set to now() by the complete route. The workspace
--                       layout renders <WelcomeTour /> only while this is
--                       NULL, so a returning member never re-triggers it.
--
-- Backfill: every existing Membership row keeps welcomeTourSeenAt = NULL,
-- so current customers would see the tour on their next workspace load.
-- That is the intended behavior — nobody has been oriented yet — and the
-- tour is fully skippable from its first step.

ALTER TABLE "Membership"
  ADD COLUMN "welcomeTourSeenAt" TIMESTAMP(3);
