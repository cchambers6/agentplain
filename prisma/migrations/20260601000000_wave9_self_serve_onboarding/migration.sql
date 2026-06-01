-- Wave-9 self-serve onboarding wizard — schema additions.
--
-- Adds three columns to OnboardingState:
--   * pickedSkillSlugs       — JSONB array of skill catalog slugs the
--                              customer ticked in the new "pick what to
--                              track" step.
--   * firstFireRequestedAt   — when the onboarding-first-fire Inngest
--                              event was dispatched (after the customer
--                              finishes set_preferences).
--   * firstFireCompletedAt   — set the first time a SkillRun for this
--                              workspace lands after the request. Lets
--                              the watch panel switch from
--                              "fetching" to "first fire landed."
--
-- Backfill defaults are safe: every existing row keeps an empty pick
-- list and NULL fire timestamps, so the new wizard step is opt-in for
-- in-flight customers (they re-enter at pick_skills if currentStep was
-- set_preferences when they last left).

ALTER TABLE "OnboardingState"
  ADD COLUMN "pickedSkillSlugs" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "firstFireRequestedAt" TIMESTAMP(3),
  ADD COLUMN "firstFireCompletedAt" TIMESTAMP(3);
