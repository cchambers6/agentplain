# Stripe billing — one-time setup

agentplain bills customers on a three-tier × five-seat-band per-seat ladder
(`project_stripe_both_surfaces.md`). Pricing lives in `lib/pricing/tiers.ts`
and Stripe Products + Prices are provisioned by an idempotent script
(`scripts/stripe/setup-products.ts`). Prices are resolved at runtime by
Stripe `lookup_key`; **no Price ids are hardcoded in the repo or env**.

This doc walks Conner through standing the billing surface up end-to-end.

---

## 1 · Environment variables

Set these in Vercel for **Production** and (test-mode only) **Preview / Development**:

| Key | Where to get it | Notes |
|---|---|---|
| `STRIPE_SECRET_KEY` | Stripe Dashboard → Developers → API keys | `sk_live_…` only in Production. `sk_test_…` everywhere else per `feedback_no_prod_secrets_in_dev`. |
| `STRIPE_WEBHOOK_SECRET` | Stripe Dashboard → Developers → Webhooks → \[endpoint\] → "Reveal" | Different value per environment. |
| `INNGEST_EVENT_KEY` | Inngest Cloud → Manage → Event keys | Required for the trial-expiration cron to fire. |
| `INNGEST_SIGNING_KEY` | Inngest Cloud → Manage → Signing keys | Same. |

**No** `STRIPE_PRICE_*` env vars are required. Older versions of this repo
used 6 — they've been removed in favor of lookup-key resolution
(`lib/pricing/tiers.ts → lookupKeyFor`).

---

## 2 · Provision Products + Prices in Stripe

```bash
# Dry-run first — see what would change.
STRIPE_SECRET_KEY=sk_test_... npx tsx scripts/stripe/setup-products.ts --dry-run

# Apply.
STRIPE_SECRET_KEY=sk_test_... npx tsx scripts/stripe/setup-products.ts
```

The script is **idempotent**: re-running it reuses existing Products + Prices
keyed by `lookup_key`. If the unit amount in the file drifts from what's in
Stripe, the script archives the old Price (renaming its lookup_key so the
new one can claim the original) and creates a fresh Price under the same
lookup key.

After it runs, your Stripe dashboard will hold:

- **3 Products** — `agentplain Regular` / `agentplain Plus` / `agentplain Max`
- **15 Prices** — one per (tier, seat band) at monthly cadence, named
  `agentplain_<tier>_seats_<band>_monthly`

Re-run in production once you're ready to take live cards.

---

## 3 · Wire the webhook endpoint

In Stripe Dashboard → **Developers → Webhooks → Add endpoint**:

- **URL:** `https://<your-vercel-domain>/api/stripe/webhook`
- **API version:** `2026-04-22.dahlia` (pinned in `lib/billing/stripe-provider.ts`)
- **Events to send** (every one we currently dispatch on, plus the
  invoice events we already mirror):
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `customer.subscription.trial_will_end`
  - `invoice.created`
  - `invoice.finalized`
  - `invoice.paid`
  - `invoice.payment_succeeded`
  - `invoice.payment_failed`
  - `invoice.voided`

Click **Reveal signing secret** and copy it into `STRIPE_WEBHOOK_SECRET`.

---

## 4 · Smoke-test with the Stripe CLI

```bash
# Forward webhooks to your local dev server (or any deployment).
stripe listen --forward-to localhost:3000/api/stripe/webhook

# In a second terminal, fire a representative event.
stripe trigger customer.subscription.created
```

The receiver should:

1. Verify the Stripe-Signature header (returns 400 on tamper).
2. Insert one `BillingEvent` row keyed by `evt_*`.
3. Upsert the `Subscription` row mapping `stripeSubscriptionId` to the
   workspace via `stripeCustomerId`.
4. Write one `AuditLog` row.

Re-triggering the same event should return `{received: true, duplicate: true}`
without re-mutating state — that's the BillingEvent idempotency guard.

---

## 5 · Verify the trial flow end-to-end

1. Sign up at `https://<preview>/app/sign-up` — pick any vertical, enter
   a real email you control. No card is requested.
2. Verify the magic link and land at `/app/workspace/<id>/settings/billing`.
   You should see "Trial ends in 30 days" + an "Add payment method" CTA.
3. Click "Add payment method" → Stripe Checkout opens in **setup mode**.
   Use test card `4242 4242 4242 4242`, any future expiry, any CVC.
4. Return to billing — the "Add payment method" CTA flips to "Update
   payment method" once Stripe fires `customer.subscription.updated`.
5. Optional: change tier or seats — Checkout opens in **subscription
   mode** with promotion codes enabled.
6. Cancel — schedules cancel-at-period-end. Banner appears with the
   period-end date.

---

## 6 · Cron schedule

The trial-expiration warning cron runs daily at **10:00 UTC** (≈ 06:00 ET
during EDT). It selects `TRIALING` subscriptions with `trialEndsAt` within
the 7 / 3 / 1-day thresholds (`TRIAL_WARNING_THRESHOLDS_DAYS` in
`lib/pricing/tiers.ts`) and emits one email per threshold per subscription.

`lastTrialWarningDays` on the `Subscription` row guards against double-fire
across cron runs.

To pause the cron without redeploying, set
`INNGEST_FN_DISABLE_AGENTPLAIN_TRIAL_WARNINGS=true` in Vercel
(`lib/inngest/disable-flag.ts` — the in-house disable pattern from
`feedback_no_silent_vendor_lock`).

---

## 7 · Architecture summary

| Layer | File | Notes |
|---|---|---|
| Pricing source of truth | `lib/pricing/tiers.ts` | Mirrors `project_stripe_both_surfaces.md` lines 17–26 |
| Provider seam | `lib/billing/types.ts` | Interface |
| Stripe implementation | `lib/billing/stripe-provider.ts` | All Stripe SDK calls live here |
| Test / preview implementation | `lib/billing/test-provider.ts` | In-memory; satisfies same contract |
| Provisioning at signup | `lib/billing/provisioning.ts` | Customer + trial subscription |
| Webhook receiver | `app/api/stripe/webhook/route.ts` | Signature verify + idempotency |
| Webhook dispatch | `lib/billing/webhook-dispatch.ts` | Per-event handlers |
| Billing UI | `app/(product)/app/workspace/[id]/settings/billing/page.tsx` | Trial banner, change plan, portal, cancel |
| Trial cron | `lib/inngest/functions/trial-expiration-warnings.ts` | 7/3/1-day warnings |
| Inngest serve route | `app/api/inngest/route.ts` | Where future functions register |

## 8 · Open questions for Conner

- `feedback_max_friction_reduction_for_trials` rule #2 says "Card on file at
  signup, $0 charged month 1, per-seat kicks in month 2." The brief
  explicitly overrode to "NEVER at signup" — we shipped the brief
  interpretation (no card at signup, `trial_period_days: 30`).
  The orchestrator memory and the implementation now disagree on this
  point. Confirm the no-card-at-signup path and amend
  `feedback_max_friction_reduction_for_trials.md` rule #2.
- The orchestrator canonical mentions monthly + annual SKUs (Phase 2
  enables annual). This PR ships monthly only (15 Prices). When annual
  goes live, extend `lib/pricing/tiers.ts` and re-run
  `scripts/stripe/setup-products.ts`.
