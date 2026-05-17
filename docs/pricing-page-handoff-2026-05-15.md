# Pricing-page handoff — Max-tier intake URLs

**Date:** 2026-05-15
**Author:** feat/max-quote-intake task
**Companion task:** `local_86959c45` (app tier picker rebuild)

## What shipped here

`feat/max-quote-intake` extended the existing `/custom` intake form to handle
**both** Custom-skill-build inquiries AND Max-tier quote inquiries through one
queue, one inbox, one operator surface. Max is now an ad-hoc / quote-based
tier per the just-ratified `memory/project_stripe_both_surfaces.md`:

- No new Stripe Product / Price for Max.
- No self-serve Max checkout.
- Max prospects submit via `/custom`, with `inquiry_type = "max_service_engagement"` selected (manually or via deep link).
- Conner triages on `/operator/inquiries` and routes to manual workspace
  provisioning (via the existing `lib/billing/provisioning.ts` flow with the
  custom-build product) once the quote is signed.

## URL contract — what other surfaces should link to

These are the canonical URLs other tasks should wire when they touch the
Max-tier CTA. The `?type=` query param pre-selects the inquiry-type toggle.

| Surface | Target URL | Owner task |
|---|---|---|
| `/pricing` page → Max card "Talk to a service partner" CTA | `/custom?type=max#custom-contact` | (future /pricing rebuild) |
| Billing settings page → "Talk to us about Max" link (when added) | `/custom?type=max#custom-contact` | `local_86959c45` |
| Marketing nav → "Custom" link (already wired) | `/custom` | (already shipped) |
| External / docs / Notion deep-link to confirmation | `/inquiry-received?type=max` | n/a |

The form **respects** the following query param values for `type`:

- `max` or `max_service_engagement` → pre-selects "Max-tier service engagement"
- `not_sure` or `both` → pre-selects "Not sure / both"
- `custom_skill_build` (or no param) → default "Custom skill build"
- Anything else → falls back to "Custom skill build"

## Why this task did NOT touch /pricing or the billing-settings page

1. **`/pricing`** — the locked memory rule (`project_stripe_both_surfaces.md`)
   says NO 3-column tier comparisons and NO Plus/Max marketing copy. The
   existing `/pricing` page already complies. Adding a "Talk to a service
   partner" CTA for Max is a future task — when it happens, point it at
   `/custom?type=max#custom-contact`.

2. **`/app/workspace/[id]/settings/billing/page.tsx`** — `local_86959c45`
   (app tier picker) owns this file. To avoid merge conflict, this task left
   it untouched. When `local_86959c45` removes Plus/Max from the
   `ChangePlanCard` form (current state surfaces all three tiers — a known
   drift from the locked memory rule), it should add a single "Talk to us
   about Max" link routing to `/custom?type=max#custom-contact`.

## Schema discipline preserved

Per `project_stripe_both_surfaces.md`:

- `prisma/schema.prisma` `WorkspaceVerticalTier` enum (REGULAR / PLUS / MAX)
  is **not** touched. Future productization stays unblocked.
- `lib/pricing/tiers.ts` `PER_SEAT_MONTHLY_USD_CENTS.max` rows are **not**
  touched. The SDK contract that `tests/billing-pricing.test.ts` exercises
  is unchanged.
- `tests/billing-pricing.test.ts` continues to test the three-tier SDK
  contract; no test edits.

The model on disk supports three tiers; the customer surface ships Max as
quote-based. When Max productizes later, unhide and wire the existing tier
codepath.

## Inquiry queue ownership

- **DB table:** `Inquiry` (new, RLS = operator-only)
- **Submit handler:** `lib/custom-inquiry/index.ts` (persist → email)
- **Operator surface:** `/operator/inquiries`
- **Triage server actions:** `app/(operator)/operator/inquiries/actions.ts`
- **Confirmation surfaces:** inline (form sent state) + `/inquiry-received`
  (standalone)

## Open items for future tasks

- [ ] `local_86959c45` to wire `/custom?type=max#custom-contact` from the
      billing-settings Max link (when added).
- [ ] Future `/pricing` rebuild to wire the Max card CTA to
      `/custom?type=max#custom-contact`.
- [ ] When the manual workspace-provisioning flow exists for Max engagements,
      replace the "Mark workspace as Max" quick action on
      `/operator/inquiries` with a flow that actually creates the workspace
      + invoice; today it only flips status.
- [ ] Memory update: `project_stripe_both_surfaces.md` should be amended to
      reflect that Max is now a customer-visible *quote-based* path (the
      current locked rule banishes the word "Max" from customer surfaces;
      the just-ratified version surfaces it as the intake toggle label).
