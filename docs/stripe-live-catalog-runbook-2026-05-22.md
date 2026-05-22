# Stripe LIVE catalog runbook — 2026-05-22

**Audience:** Conner only. This is the Conner-gated step. The fleet has
prepared everything below; **you run it.** Nothing in this PR created a live
product or attempted a live charge.

**What this does:** provisions the agentplain Products + Prices in your **live**
Stripe account so that customer checkout (which resolves prices at runtime by
`lookup_key`) finds a live Price instead of throwing `Price with lookup_key="…"
not found`.

**Safety:** `scripts/stripe/setup-products.ts` now refuses to touch a live
account unless you pass `--live` AND the key is actually `sk_live_` (and refuses
`--live` against a non-live key). So the live catalog cannot be written by
accident. `--dry-run` writes nothing and bypasses the gate.

---

## 0. Prerequisites (one-time)

1. **Live secret key.** From the Stripe Dashboard (toggle to **live mode**) →
   Developers → API keys → copy the **live** secret key (`sk_live_…`). Keep it
   out of the repo — paste it inline on the command line only (per
   `feedback_no_prod_secrets_in_dev`).
2. **Live webhook endpoint.** In the Stripe Dashboard (live mode) → Developers →
   Webhooks → add endpoint `https://app.agentplain.com/api/stripe/webhook`,
   subscribed to at least: `checkout.session.completed`,
   `customer.subscription.created`, `customer.subscription.updated`,
   `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`.
   Copy its **Signing secret** (`whsec_…`).
3. **Vercel Production env** (Project → Settings → Environment Variables →
   Production):
   - `STRIPE_SECRET_KEY` = your `sk_live_…`
   - `STRIPE_WEBHOOK_SECRET` = the live endpoint's `whsec_…`
   - `BILLING_PROVIDER` = `stripe` (default; confirm it is not `test`)
   Redeploy so the live env is picked up.

> The setup script (step 2) only needs the live **secret key** on your local
> shell. The webhook secret (step 0.2/0.3) is what lets the *deployed app* flip
> the DB row in step 4 — set it before you verify.

---

## 1. Rehearse against the live account (writes nothing)

Confirm the script sees the live account and reports the exact plan:

```bash
STRIPE_SECRET_KEY=sk_live_… npx tsx scripts/stripe/setup-products.ts --dry-run
```

Expect `mode=dry-run target=LIVE`. It lists every Product + Price it *would*
create. No `--live` needed for a dry run. If anything already exists (e.g. you
ran this before), it prints `reuse` — the script is idempotent.

---

## 2. Provision the live catalog (the one command)

```bash
STRIPE_SECRET_KEY=sk_live_… npx tsx scripts/stripe/setup-products.ts --live
```

Expect `mode=apply target=LIVE`. It creates (or reuses) **3 Products** and
**15 Prices** and prints `lookup_key → id` for each. Re-running is safe
(idempotent) — existing rows are reused, price-amount changes archive the old
Price and create a new one carrying the same `lookup_key`.

- Omitting `--live` against a live key → **refused** (clear error).
- Passing `--live` with a test key → **refused** (clear error).

---

## 3. The lookup_keys checkout expects (must match exactly)

Checkout/subscription resolves the Price at runtime via
`prices.list({ lookup_keys: [lookupKeyFor(tier, band)], active: true })`
(`lib/billing/stripe-provider.ts:99-116`). The script produces exactly these
keys from the same `lib/pricing/tiers.ts` source, so they match by construction.
Verify the live dashboard shows active Prices with these `lookup_key`s:

**Products** (`lookup_key` in metadata `agentplain_lookup_key`):
`agentplain_regular`, `agentplain_plus`, `agentplain_max`

**Prices** (`agentplain_<tier>_<band>_monthly`, per-seat USD/month):

| Band | Regular | Partner (`plus`) | Max |
|------|---------|------------------|-----|
| `seats_1`     | $199 | $299 | $499 |
| `seats_2_9`   | $179 | $279 | $449 |
| `seats_10_24` | $149 | $249 | $399 |
| `seats_25_49` | $119 | $219 | $349 |
| `seats_50_99` | $99  | $199 | $299 |

Full key example: `agentplain_regular_seats_1_monthly`.

> Note: only **regular** and **plus** are self-serve (`SELF_SERVE_TIERS`); `max`
> is quote-based and never reaches Checkout, but its Prices are provisioned for
> SDK-contract continuity. Checkout only ever asks for regular/plus keys.

---

## 4. Verify TRIALING → ACTIVE with a ~$1 live charge

A new subscription starts in **TRIALING** (30-day trial, no card required). The
DB row flips to **ACTIVE** when the trial converts: Stripe emits
`customer.subscription.updated` (status `active`) + `invoice.paid`, and our
webhook (`lib/billing/webhook-dispatch.ts:167-193, 378`) writes the new status.
Live mode has **no test cards** — a real card and a real (refundable) charge are
required, so keep the amount tiny:

1. **Create a throwaway $1 live Price** to avoid a full $99 charge. In the
   Stripe Dashboard (live) → Products → `agentplain Regular` → add a price:
   $1.00 / month recurring. (You do **not** need to give it a lookup_key — this
   price is only for the verification, not for checkout.)
2. **Create a test subscription on it.** Dashboard → Customers → create a test
   customer with your own real card → Create subscription → pick the $1 price →
   set **trial period = 1 day** (or none). Confirm the app's DB Subscription row
   for that customer reads **TRIALING** (operator surface, or query
   `Subscription.status`).
3. **Force the trial to end now.** On the subscription → **End trial** (or "Bill
   immediately"). Stripe charges **$1**, fires `customer.subscription.updated`
   (active) + `invoice.paid`.
4. **Confirm the flip.** Stripe Dashboard → your live webhook endpoint → recent
   deliveries show `2xx` for those events. The DB `Subscription.status` for the
   customer should now read **ACTIVE**. (If deliveries show `4xx`, the
   `STRIPE_WEBHOOK_SECRET` in Vercel Production is wrong/missing — fix step
   0.3 and re-send the event from the dashboard.)
5. **Clean up the verification:** refund the $1 charge, cancel the test
   subscription, delete the test customer, and **archive the $1 Price**
   (set inactive) so it can never be selected.

> Alternative (no temp price): run the real signup → Checkout flow and end the
> trial on the resulting **regular 1-seat** subscription — same flip, but the
> charge is **$99**. The $1-price path above is the cheaper verification.

---

## 5. Rollback

The catalog itself needs no rollback — Products/Prices are inert until checkout
references them, and re-running the script is idempotent. To back out:

- **Stop new live subscriptions instantly:** set `BILLING_PROVIDER=test` in
  Vercel Production and redeploy — the app then uses the in-memory test billing
  provider and never calls live Stripe. (Existing live subscriptions are
  unaffected; this only stops new live checkout.)
- **Hide the catalog from checkout:** archive the live Prices (Dashboard →
  set each `agentplain_*` Price inactive). Checkout's `prices.list({active:true})`
  then finds nothing and fails closed (no charge) rather than charging a wrong
  amount.
- **Undo the $1 verification:** see step 4.5 (refund, cancel, delete, archive).
- The provisioning made no code or DB changes — nothing to revert in the repo.

---

## What the fleet did vs. what you do

- **Fleet (this PR):** added the `--live` safety gate to the script (cannot
  write live by accident), confirmed the lookup_keys match what checkout
  resolves, and wrote this runbook. **No live product created, no charge made.**
- **You (Conner):** supply the live key + webhook secret (step 0), run the one
  command (step 2), and do the $1 verification (step 4).
