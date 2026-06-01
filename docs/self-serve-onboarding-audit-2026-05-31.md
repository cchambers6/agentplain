# Self-serve onboarding audit — 2026-05-31 (wave 9 phase 1)

**Scope:** trace what a non-technical customer (solo realtor / 1-2 person
CPA / single-truck HVAC) actually experiences from clicking "begin with us"
to seeing the fleet do real work on their data. File-cited.

**Brutal-honesty bottom line:** today the signup → first-value latency for
a customer who signs up on a Wednesday afternoon is **18-22 hours** (next
day's 9am cron block). Even on the best path (signup right before a sweep)
the customer waits a minimum of **15 minutes** for the next scheduler
sweep, and there is no UI affordance that tells them so. The 3-step
wizard exists and reads well, but it ends with "the 9am block runs
tomorrow" — the customer leaves the workspace cold. Wave-9 target is
**<15 minutes elapsed, with a live first-fire visible on the Done
screen**. The gap is real and load-bearing.

## The current journey, screen by screen

### Step 0 — `app/(product)/app/sign-up/page.tsx`

`SignUpPage` renders `SignUpForm` (client component). Customer picks
tier (Regular / Partner / Max), vertical (chip row of 10 + "Something
else"), and types brokerage name + email. **Pre-fill works** from
`?vertical=` and `?tier=` query params (vertical-pages CTAs deep-link
correctly).

Form submit → `signUpAction` in `app/(product)/app/actions.ts:44-186`:

1. Validates vertical against the content registry.
2. Calls `signUpBrokerOwner` to create User + Workspace + Membership +
   seed `OnboardingState` (per `lib/auth/flows.ts`).
3. Issues magic link via `requestMagicLink({ purpose: "sign_up" })`.
4. **CC-at-trial branch** (`env.stripeCheckoutEnabled()` true in prod):
   creates Stripe Checkout session and returns `checkoutUrl`; client
   `useEffect` redirects browser to Stripe.

### Step 1 — Stripe Checkout (hosted)

Stripe collects card. On completion Stripe redirects to
`app/(product)/app/sign-up/checkout-success/page.tsx` — informational
only, no DB writes. Tells customer to "wait for Plaino's one-business-
day install" (`checkout-success/page.tsx:42-44`). The webhook
(`app/api/stripe/webhook/...`) lands the `Subscription` row out of
band. **Customer is sitting on a static page with nothing actionable.**

### Step 2 — Magic-link click → workspace landing

`app/(product)/app/verify/route.ts:35-68` validates the token, writes
session, and redirects to `/app/workspace/{defaultWorkspaceId}`.
**Onboarding is not the landing.** Customer lands on the dashboard.

### Step 3 — Workspace overview (`app/(product)/app/workspace/[id]/page.tsx`)

The dashboard renders with empty data:
- "what we did" feed is empty → `ApRootedEmptyState` reads "Nothing yet
  — the fleet needs to know where to read from." with "continue
  onboarding" CTA (`workspace/[id]/page.tsx:316-348`).
- "today's queue" shows 0 drafts, 0 flags.
- "today's briefing" shows "No briefing filed yet" with copy "files one
  each morning after the overnight run. The first one lands tomorrow."
  (`workspace/[id]/page.tsx:453-461`).

Above all that: an **onboarding banner** at lines 183-202 if
`onboardingState.completedAt == null`. The CTA is "continue onboarding"
but is one of three competing top-of-page elements.

**The customer CAN bypass onboarding entirely** — nothing redirects them
back. They can browse `/agents`, `/integrations`, `/approvals` cold and
read the empty-state copy that says "the fleet needs to know where to
read from."

### Step 4 — The existing wizard (`app/(product)/app/workspace/[id]/onboarding/page.tsx`)

If the customer clicks "continue onboarding," they enter the 3-step
state machine defined in `lib/onboarding/steps.ts`:

1. **confirm_details** — read-only display of workspace name + vertical
   + tier. Submit advances. **Zero customer input.**
2. **connect_integration** — Gmail/Outlook OAuth via `oauthStartPath`.
   Has explicit "skip for now" button (per spec §10 — non-blocking).
   The CTA goes dead with an honest "your service partner wires it
   with you" message when `GOOGLE_OAUTH_CLIENT_ID` isn't configured
   (`onboarding/page.tsx:344-347`).
3. **set_preferences** — 3 radio groups (drafting tone, calendar
   window) + free-form categorization notes textarea. Persists via
   `upsertOnboardingPreference` + `recordPreferenceSignal`.

On step 3 submit: `advanceOnboardingAction` sets `completedAt = now()`,
writes the audit row, and `redirect(\`/app/workspace/${id}\`)` back to
the dashboard (`onboarding/actions.ts:135-139`). **No first-fire is
triggered.** The dashboard shows the same empty state but without the
banner.

When the customer returns to `/onboarding` after completion they see
the "Your workspace is rooted" panel (`onboarding/page.tsx:84-121`) —
which says **"The 9am block runs tomorrow."** This is the operative
expectation set by the product today.

### Step 5 — First actual fire

The first concrete output lands when one of the live cron functions
fires for this workspace:
- `scheduler-sweep.ts` — every 15 min, requires at least one ACTIVE
  GOOGLE or M365 credential (`scheduler-sweep.ts:289-292`).
- `briefings-generator-sweep.ts` — Mon-Fri 13:00 UTC (≈9am ET).
- `inbox-triage-general` — webhook-driven via `process-webhook-event`
  when an inbound message lands on the connected Gmail.
- Other sweeps follow similar gating.

**The fastest path to first-value** is a customer who connected Gmail
during onboarding and gets a fresh inbound message that triggers the
webhook fanout. Without an inbound message, the customer waits until
the next sweep (≤15 min for scheduler, ≤24 hours for the morning
briefing).

## Time-to-first-value, honestly

Conditioning on the customer signing up at a randomly chosen weekday
moment and completing wizard in ~3 minutes (the 3 existing steps are
fast):

| Path | Time to first visible fire |
| --- | --- |
| Signs up Tue 2pm, connects Gmail, has inbound in next 15 min | 15-30 min |
| Signs up Tue 2pm, connects Gmail, no inbound today | next scheduler sweep ≤15 min ⇒ slot proposed (if a calendar event is in the 7-day window) |
| Signs up Tue 2pm, skips Gmail | next 9am briefing ⇒ ~19 hours (empty briefing, no real data) |
| Signs up Sun 9pm, connects Gmail | Mon 9am briefing ⇒ ~12 hours |

**P50 on the current product is ~12-19 hours.** The wizard ends with
"the 9am block runs tomorrow" — which is honest, but it is also the
opposite of the wave-9 target.

## The gap list — what wave 9 must add

1. **Auto-redirect to `/onboarding` on first workspace landing**
   when `onboardingState.completedAt == null`. Currently `verify/route.ts`
   sends every customer to the dashboard; a banner can be ignored.

2. **A "pick what to track" step** between connect_integration and
   set_preferences. Customer sees the list of skills that will actually
   fire on their workspace today (filtered to `runtime: 'live'` from
   `lib/skills/registry.ts`), pre-checked, and can opt-out individually.
   Stored as `pickedSkillSlugs Json @default("[]")` on `OnboardingState`.

3. **A "first fire" expectation-setting step** after preferences. Tells
   the customer "we'll run [picked skills] for the first time in the
   next 5 minutes, here's exactly what to expect from each one." Sets
   a precise, testable expectation.

4. **An immediate first-fire trigger** on completion. Fire a new Inngest
   event `agentplain/onboarding.first-fire.requested` with
   `{ workspaceId, pickedSkillSlugs }`. The handler runs each picked
   skill's `run-for-workspace` function once, immediately, off the
   normal cron schedule. Stamps `firstFireRequestedAt` on
   `OnboardingState`.

5. **A live watch panel on the Done screen** that polls `SkillRun` rows
   created since `firstFireRequestedAt` and renders each one as it
   completes ("Plaino just drafted X — open approval queue"). Polls
   every 5 sec for up to 5 min, then falls back to "your fleet is
   running on cron now — check back in 15 min."

6. **Honesty filter on the picked skills list.** The skill registry has
   `runtime: 'live' | 'schema-only'`; many vertical-specific skills are
   NOT live yet (`invoice-chasing-realestate`, `month-end-close-cpa`,
   `law-intake-conflict-screen`, `ria-client-update-draft`,
   `insurance-coi-request`, `mortgage-document-chase`,
   `home-services-estimate-followup`,
   `recruiting-candidate-status-update`,
   `property-management-rent-collection-chase`,
   `title-escrow-closing-doc-chase` — all missing `runtime: 'live'`).
   Show only `runtime === 'live'` so the customer never picks something
   that won't fire.

7. **Vertical pre-selection from signup metadata.** Already exists on
   the workspace record (`Workspace.vertical`); the wizard just needs
   to read it. The brief's "step 1: pick your business" can be
   collapsed to a confirmation rather than a re-pick.

8. **No new outbound writes.** Every new path must respect
   `project_no_outbound_architecture.md` — no emails, no SMS, no
   posts. The first-fire trigger only writes `WorkApprovalQueueItem`
   rows + `SkillRun` audit rows.

## What's already correct (don't break)

- **Service-partnership voice** — `PLAINO_PARTNER` exported from
  `lib/onboarding/service-partner.ts`; `PlainoAvatar` component in the
  wizard header. Reuse on every new screen.
- **CC-at-trial** — `signUpAction` already routes through Stripe
  Checkout before any workspace UI is reachable. Wave-9 wizard runs
  AFTER checkout completes; never bypass.
- **OAuth start path** — `oauthStartPath(entry, workspaceId, returnTo)`
  is the single way to start Gmail/Outlook OAuth. New "pick a tool"
  step uses this; do not write a parallel path.
- **Honest "OAuth not configured" branch** — `isIntegrationConfigured(entry)`
  already returns false when env keys are missing, and the wizard
  copy degrades gracefully ("your service partner wires it with you").
  Carry that same honesty into the new steps.
- **`SkillRun` table** — every skill writes a row here; the polling
  watch reads it.
- **Inngest event-trigger pattern** — every sweep accepts a
  `<id>.requested` event alongside its cron trigger. Adding a new
  event handler is the established seam.

## File-cited inventory

| Surface | File | Notes |
| --- | --- | --- |
| Sign-up form | `app/(product)/app/sign-up/{page,SignUpForm}.tsx` | tier picker + vertical chip row, CC-at-trial redirect |
| Sign-up action | `app/(product)/app/actions.ts:44-186` | calls `signUpBrokerOwner` + `createTrialCheckoutForSignup` |
| Checkout-success landing | `app/(product)/app/sign-up/checkout-success/page.tsx` | informational, no DB |
| Magic-link verify | `app/(product)/app/verify/route.ts` | redirects to `/app/workspace/{id}` |
| Workspace dashboard | `app/(product)/app/workspace/[id]/page.tsx` | onboarding banner @ L183-202; empty-state CTAs |
| Existing wizard | `app/(product)/app/workspace/[id]/onboarding/page.tsx` | 3 steps; "9am tomorrow" done state |
| Wizard actions | `app/(product)/app/workspace/[id]/onboarding/actions.ts` | `advanceOnboardingAction` |
| Step machine | `lib/onboarding/steps.ts` | `STEP_ORDER`, `STEP_META`, `nextStepAfter` |
| Service partner | `lib/onboarding/service-partner.ts` | `PLAINO_PARTNER` constant |
| OnboardingState model | `prisma/schema.prisma:611-620` | `currentStep` String, `completedSteps` Json |
| SkillRun audit | `prisma/schema.prisma:1759-1786` | rows the watch panel reads |
| Skill registry | `lib/skills/registry.ts` | `runtime: 'live' \| 'schema-only'` |
| Discipline registry | `lib/disciplines/index.ts` | 8 disciplines, sortOrder |
| Skill→discipline map | `lib/disciplines/skill-mapping.ts` | `SKILL_DISCIPLINE` |
| Marketplace catalog | `lib/integrations/marketplace.ts` | Gmail + Outlook entries L116-151 |
| Scheduler sweep | `lib/inngest/functions/scheduler-sweep.ts` | trigger event `agentplain/scheduler-sweep.requested` |
| Inngest client | `lib/inngest/client.ts` | `inngest.send({ name, data })` |
| Inngest serve route | `app/api/inngest/route.ts` | register the new first-fire fn here |
